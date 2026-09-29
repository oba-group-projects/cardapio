const encoder = new TextEncoder();

const COOKIE_NAME = "__Host-oba_admin";
const CSRF_COOKIE = "__Host-oba_csrf";

const SESSION_SECONDS = 60 * 60 * 8;

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

/*
 * Rate limit local por isolate.
 *
 * Serve como primeira barreira e permite testes locais.
 * Antes da abertura publica, a camada de rate limiting distribuida
 * sera validada separadamente.
 */
const loginAttempts = new Map();

function response(body, status = 200, headers = {}) {
  /*
   * IMPORTANTE:
   *
   * headers pode ser um Headers real, inclusive contendo multiplos
   * Set-Cookie. Object spread de um objeto Headers nao preserva corretamente
   * esses valores.
   *
   * Portanto trabalhamos diretamente com Headers.
   */
  const finalHeaders =
    headers instanceof Headers
      ? headers
      : new Headers(headers);

  if (!finalHeaders.has("Cache-Control")) {
    finalHeaders.set("Cache-Control", "no-store");
  }

  if (!finalHeaders.has("X-Content-Type-Options")) {
    finalHeaders.set("X-Content-Type-Options", "nosniff");
  }

  if (!finalHeaders.has("Referrer-Policy")) {
    finalHeaders.set("Referrer-Policy", "no-referrer");
  }

  if (!finalHeaders.has("X-Frame-Options")) {
    finalHeaders.set("X-Frame-Options", "DENY");
  }

  if (!finalHeaders.has("Content-Security-Policy")) {
    finalHeaders.set(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "style-src 'unsafe-inline'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'none'"
    );
  }

  return new Response(body, {
    status,
    headers: finalHeaders,
  });
}

function json(data, status = 200, headers = {}) {
  return response(JSON.stringify(data), status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
}

function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  const out = {};

  for (const part of raw.split(";")) {
    const index = part.indexOf("=");

    if (index <= 0) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    out[key] = value;
  }

  return out;
}

function toBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return toBase64Url(data);
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const aa = encoder.encode(a);
  const bb = encoder.encode(b);

  const max = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;

  for (let i = 0; i < max; i++) {
    diff |= (aa[i] || 0) ^ (bb[i] || 0);
  }

  return diff === 0;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value)
  );

  return toBase64Url(new Uint8Array(signature));
}

function getClientKey(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "local"
  ).split(",")[0].trim();
}

function pruneAttempts(now) {
  if (loginAttempts.size < 1000) return;

  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.startedAt >= LOGIN_WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }
}

function rateState(request) {
  const now = Date.now();
  const key = getClientKey(request);

  pruneAttempts(now);

  let state = loginAttempts.get(key);

  if (!state || now - state.startedAt >= LOGIN_WINDOW_MS) {
    state = {
      startedAt: now,
      failures: 0,
    };

    loginAttempts.set(key, state);
  }

  return { key, state, now };
}

function isRateLimited(request) {
  const { state } = rateState(request);
  return state.failures >= LOGIN_MAX_ATTEMPTS;
}

function registerFailure(request) {
  const { key, state } = rateState(request);
  state.failures += 1;
  loginAttempts.set(key, state);
}

function clearFailures(request) {
  loginAttempts.delete(getClientKey(request));
}

async function createSession(env) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_SECONDS;

  const nonce = crypto.randomUUID();

  const payload = `${issuedAt}.${expiresAt}.${nonce}`;
  const signature = await hmac(env.AUTH_SESSION_SECRET, payload);

  return `${payload}.${signature}`;
}

async function validateSession(request, env) {
  if (!env.AUTH_SESSION_SECRET) return false;

  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];

  if (!token) return false;

  const pieces = token.split(".");

  if (pieces.length !== 4) return false;

  const [issuedAtRaw, expiresAtRaw, nonce, signature] = pieces;

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);

  if (
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    !nonce ||
    !signature
  ) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  if (issuedAt > now + 60) return false;
  if (expiresAt <= now) return false;
  if (expiresAt - issuedAt > SESSION_SECONDS) return false;

  const payload = `${issuedAt}.${expiresAt}.${nonce}`;
  const expected = await hmac(env.AUTH_SESSION_SECRET, payload);

  return constantTimeEqual(expected, signature);
}

function csrfValid(request) {
  const cookies = parseCookies(request);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = request.headers.get("X-CSRF-Token");

  return (
    typeof cookieToken === "string" &&
    typeof headerToken === "string" &&
    cookieToken.length >= 32 &&
    constantTimeEqual(cookieToken, headerToken)
  );
}

function loginPage(error = "") {
  const safeError = error
    ? '<p role="alert" class="error">Acesso nao autorizado.</p>'
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Oba Doceria - Gestao</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;
  min-height:100vh;
  display:grid;
  place-items:center;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#f6f3ee;
  color:#28231f
}
main{
  width:min(92vw,420px);
  background:#fff;
  padding:32px;
  border-radius:18px;
  box-shadow:0 12px 40px rgba(0,0,0,.10)
}
h1{margin-top:0}
label{display:block;margin:18px 0 8px}
input{
  width:100%;
  padding:13px;
  font:inherit;
  border:1px solid #bbb;
  border-radius:9px
}
button{
  width:100%;
  margin-top:20px;
  padding:13px;
  border:0;
  border-radius:9px;
  font:inherit;
  font-weight:700;
  cursor:pointer
}
.error{color:#a00}
.small{font-size:.85rem;opacity:.7}
</style>
</head>
<body>
<main>
<h1>Gestao Oba Doceria</h1>
<p>Acesso administrativo.</p>
${safeError}
<form method="post" action="/__auth/login" autocomplete="off">
<label for="password">Senha</label>
<input
  id="password"
  name="password"
  type="password"
  required
  minlength="12"
  autocomplete="current-password">
<button type="submit">Entrar</button>
</form>
<p class="small">Area privada.</p>
</main>
</body>
</html>`;
}

async function handleLogin(request, env) {
  if (!env.AUTH_PASSWORD || !env.AUTH_SESSION_SECRET) {
    return response("Authentication not configured", 503);
  }

  if (isRateLimited(request)) {
    return response("Too Many Requests", 429, {
      "Retry-After": "60",
    });
  }

  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return response("Unsupported Media Type", 415);
  }

  const form = await request.formData();
  const password = String(form.get("password") || "");

  if (!constantTimeEqual(password, env.AUTH_PASSWORD)) {
    registerFailure(request);

    return response(loginPage("invalid"), 401, {
      "Content-Type": "text/html; charset=utf-8",
    });
  }

  clearFailures(request);

  const session = await createSession(env);
  const csrf = randomToken();

  const headers = new Headers();

  headers.set("Location", "/");

  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
  );

  /*
   * CSRF precisa estar disponivel ao JavaScript administrativo
   * para ser enviado no header X-CSRF-Token.
   * Nao e credencial de autenticacao.
   */
  headers.append(
    "Set-Cookie",
    `${CSRF_COOKIE}=${csrf}; Path=/; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
  );

  return response("", 303, headers);
}

function handleLogout() {
  const headers = new Headers();

  headers.set("Location", "/__auth/login");

  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );

  headers.append(
    "Set-Cookie",
    `${CSRF_COOKIE}=; Path=/; Secure; SameSite=Strict; Max-Age=0`
  );

  return response("", 303, headers);
}

function isUnsafeMethod(method) {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}



/* OBA_CATALOG_READ_API_BEGIN */

const OBA_CATALOG_FILES = Object.freeze({
  "loja": "config.json",
  "combos": "combos.json",
  "categorias": "categories.json",
  "caixas": "boxes.json",
  "sabores": "flavors.json",
  "produtos": "products.json",
  "opcionais": "options.json",
  "tema": "theme.json"
});

const OBA_CATALOG_ALIASES = Object.freeze({
  sabor: "sabores",
  sabores: "sabores",
  flavor: "sabores",
  flavors: "sabores",
  flavour: "sabores",
  flavours: "sabores",

  categoria: "categorias",
  categorias: "categorias",
  category: "categorias",
  categories: "categorias",

  caixa: "caixas",
  caixas: "caixas",
  box: "caixas",
  boxes: "caixas",

  produto: "produtos",
  produtos: "produtos",
  product: "produtos",
  products: "produtos",

  opcional: "opcionais",
  opcionais: "opcionais",
  option: "opcionais",
  options: "opcionais",

  combo: "combos",
  combos: "combos",

  loja: "loja",
  config: "loja",
  store: "loja",

  tema: "tema",
  theme: "tema"
});

async function obaReadCatalogFile(
  request,
  env,
  fileName
) {

  const assetUrl =
    new URL(request.url);

  assetUrl.pathname =
    "/data/catalog-v1/" +
    encodeURIComponent(fileName);

  assetUrl.search = "";
  assetUrl.hash = "";

  const assetRequest =
    new Request(
      assetUrl.toString(),
      {
        method: "GET",
        headers: request.headers
      }
    );

  const response =
    await env.ASSETS.fetch(
      assetRequest
    );

  if (!response.ok) {
    return {
      ok: false,
      status: response.status
    };
  }

  const text =
    await response.text();

  try {
    return {
      ok: true,
      value: JSON.parse(text)
    };
  }
  catch {
    return {
      ok: false,
      status: 500
    };
  }
}

function obaApiJson(
  value,
  status = 200
) {

  return new Response(
    JSON.stringify(value),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store"
      }
    }
  );
}

async function obaCatalogSnapshot(
  request,
  env
) {

  const snapshot = {};

  for (
    const [key, fileName]
    of Object.entries(
      OBA_CATALOG_FILES
    )
  ) {

    const result =
      await obaReadCatalogFile(
        request,
        env,
        fileName
      );

    if (!result.ok) {
      return null;
    }

    snapshot[key] =
      result.value;
  }

  /*
   * Aliases para compatibilidade da UI existente.
   */
  snapshot.flavors =
    snapshot.sabores;

  snapshot.categories =
    snapshot.categorias;

  snapshot.boxes =
    snapshot.caixas;

  snapshot.products =
    snapshot.produtos;

  snapshot.options =
    snapshot.opcionais;

  snapshot.store =
    snapshot.loja;

  return snapshot;
}

async function obaHandleCatalogReadApi(
  request,
  env
) {

  /*
   * ESTA FASE E EXCLUSIVAMENTE GET.
   */
  if (request.method !== "GET") {
    return null;
  }

  const url =
    new URL(request.url);

  if (
    !url.pathname.startsWith(
      "/api/"
    )
  ) {
    return null;
  }

  const segments =
    url.pathname
      .split("/")
      .filter(Boolean)
      .slice(1);

  if (!segments.length) {
    return null;
  }

  const first =
    segments[0]
      .toLowerCase();

  const aggregateNames =
    new Set([
      "catalog",
      "catalogo",
      "catalog-v1",
      "bootstrap",
      "state",
      "data"
    ]);

  /*
   * /api/catalog
   * /api/catalogo
   * /api/bootstrap
   * /api/state
   */
  if (
    segments.length === 1 &&
    aggregateNames.has(first)
  ) {

    /*
     * Lê o slot PUBLISHED do D1.
     * Fallback para assets estáticos se o slot estiver vazio.
     */
    let catalog = null;

    try {
      const published =
        await obaLoadCatalogSlot(env, "PUBLISHED");
      if (published && published.payload) {
        catalog = published.payload;
      }
    }
    catch {
      /* fallback abaixo */
    }

    if (!catalog) {
      catalog =
        await obaCatalogSnapshot(
          request,
          env
        );
    }

    if (!catalog) {
      return obaApiJson(
        {
          ok: false,
          error:
            "catalog_read_failed"
        },
        500
      );
    }

    /*
     * Mantemos varios envelopes COMPATIVEIS
     * apontando para o mesmo snapshot.
     */
    return obaApiJson({
      ok: true,
      data: catalog,
      catalog,
      state: catalog,

      sabores:
        catalog.sabores,
      flavors:
        catalog.sabores,

      categorias:
        catalog.categorias,
      categories:
        catalog.categorias,

      caixas:
        catalog.caixas,
      boxes:
        catalog.caixas,

      produtos:
        catalog.produtos,
      products:
        catalog.produtos,

      opcionais:
        catalog.opcionais,
      options:
        catalog.opcionais,

      combos:
        catalog.combos,

      loja:
        catalog.loja,
      store:
        catalog.loja
    });
  }

  /*
   * Tambem aceitar:
   *
   * /api/sabores
   * /api/flavors
   * /api/catalog/sabores
   * /api/catalog/flavors
   */
  let entityName = null;

  if (segments.length === 1) {

    entityName =
      segments[0];
  }
  else if (
    segments.length === 2 &&
    aggregateNames.has(first)
  ) {

    entityName =
      segments[1];
  }

  if (!entityName) {
    return null;
  }

  const canonical =
    OBA_CATALOG_ALIASES[
      entityName.toLowerCase()
    ];

  if (!canonical) {
    return null;
  }

  const fileName =
    OBA_CATALOG_FILES[
      canonical
    ];

  if (!fileName) {
    return null;
  }

  const entity =
    await obaReadCatalogFile(
      request,
      env,
      fileName
    );

  if (!entity.ok) {

    return obaApiJson(
      {
        ok: false,
        error:
          "catalog_read_failed",
        entity:
          canonical
      },
      entity.status || 500
    );
  }

  return obaApiJson(
    entity.value
  );
}

/* OBA_CATALOG_READ_API_END */




/* OBA_DRAFT_API_BEGIN */

function obaDraftStableJson(value) {

  if (Array.isArray(value)) {

    return "[" +
      value
        .map(
          obaDraftStableJson
        )
        .join(",") +
      "]";
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {

    return "{" +
      Object.keys(value)
        .sort()
        .map(
          key =>
            JSON.stringify(key) +
            ":" +
            obaDraftStableJson(
              value[key]
            )
        )
        .join(",") +
      "}";
  }

  return JSON.stringify(value);
}

async function obaDraftSha256(
  text
) {

  const encoded =
    new TextEncoder()
      .encode(text);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return Array
    .from(
      new Uint8Array(
        digest
      )
    )
    .map(
      value =>
        value
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}

function obaDraftPayloadValid(
  payload
) {

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return false;
  }

  const required = [
    "sabores",
    "categorias",
    "caixas",
    "produtos",
    "opcionais",
    "combos",
    "loja"
  ];

  return required.every(
    key =>
      Object.prototype
        .hasOwnProperty
        .call(
          payload,
          key
        )
  );
}

async function obaHandleDraftApi(
  request,
  env,
  url
) {

  if (
    url.pathname !== "/api/draft"
  ) {
    return null;
  }

  /*
   * GET /api/draft
   */

  if (
    request.method === "GET"
  ) {

    const sql =
      [
        "SELECT",
        "s.slot,",
        "s.revision_id,",
        "s.updated_at,",
        "r.payload_json,",
        "r.payload_sha256,",
        "r.created_at",
        "FROM catalog_slots s",
        "LEFT JOIN catalog_revisions r",
        "ON r.revision_id = s.revision_id",
        "WHERE s.slot = 'DRAFT'",
        "LIMIT 1"
      ].join(" ");

    const row =
      await env.DB
        .prepare(sql)
        .first();

    if (
      !row ||
      !row.revision_id
    ) {

      return obaApiJson({
        ok: true,
        slot: "DRAFT",
        revision_id: null,
        payload_sha256: null,
        payload: null
      });
    }

    let payload;

    try {

      payload =
        JSON.parse(
          row.payload_json
        );
    }
    catch {

      return obaApiJson(
        {
          ok: false,
          error:
            "draft_payload_corrupt"
        },
        500
      );
    }

    return obaApiJson({
      ok: true,
      slot: "DRAFT",
      revision_id:
        row.revision_id,
      updated_at:
        row.updated_at,
      payload_sha256:
        row.payload_sha256,
      payload
    });
  }

  /*
   * Somente POST grava.
   */

  if (
    request.method !== "POST"
  ) {

    return obaApiJson(
      {
        ok: false,
        error:
          "method_not_allowed"
      },
      405
    );
  }

  let body;

  try {

    body =
      await request.json();
  }
  catch {

    return obaApiJson(
      {
        ok: false,
        error:
          "invalid_json"
      },
      400
    );
  }

  const payload =
    body &&
    body.payload &&
    typeof body.payload === "object"
      ? body.payload
      : body;

  if (
    !obaDraftPayloadValid(
      payload
    )
  ) {

    return obaApiJson(
      {
        ok: false,
        error:
          "invalid_catalog_payload"
      },
      400
    );
  }

  const payloadJson =
    obaDraftStableJson(
      payload
    );

  const sha =
    await obaDraftSha256(
      payloadJson
    );

  const now =
    new Date()
      .toISOString();

  const existing =
    await env.DB
      .prepare(
        [
          "SELECT revision_id",
          "FROM catalog_revisions",
          "WHERE payload_sha256 = ?",
          "LIMIT 1"
        ].join(" ")
      )
      .bind(sha)
      .first();

  const revisionId =
    (
      existing &&
      existing.revision_id
    )
      ? existing.revision_id
      : (
          "draft_" +
          sha.slice(
            0,
            24
          )
        );

  const previous =
    await env.DB
      .prepare(
        [
          "SELECT revision_id",
          "FROM catalog_slots",
          "WHERE slot = 'DRAFT'",
          "LIMIT 1"
        ].join(" ")
      )
      .first();

  const statements = [];

  /*
   * Conteudo novo:
   * cria revisao.
   *
   * Conteudo ja existente:
   * reutiliza a revisao imutavel.
   */

  if (
    !existing ||
    !existing.revision_id
  ) {

    statements.push(
      env.DB
        .prepare(
          [
            "INSERT INTO catalog_revisions",
            "(",
            "revision_id,",
            "payload_json,",
            "payload_sha256,",
            "source,",
            "created_at,",
            "created_by",
            ")",
            "VALUES (?, ?, ?, ?, ?, ?)"
          ].join(" ")
        )
        .bind(
          revisionId,
          payloadJson,
          sha,
          "CENTRAL_ONLINE_DRAFT",
          now,
          "admin"
        )
    );
  }

  /*
   * Somente DRAFT muda.
   */

  statements.push(
    env.DB
      .prepare(
        [
          "UPDATE catalog_slots",
          "SET revision_id = ?,",
          "updated_at = ?",
          "WHERE slot = 'DRAFT'"
        ].join(" ")
      )
      .bind(
        revisionId,
        now
      )
  );

  /*
   * Auditoria append-only.
   */

  statements.push(
    env.DB
      .prepare(
        [
          "INSERT INTO catalog_promotions",
          "(",
          "promotion_id,",
          "action,",
          "from_revision_id,",
          "to_revision_id,",
          "created_at,",
          "created_by",
          ")",
          "VALUES (?, ?, ?, ?, ?, ?)"
        ].join(" ")
      )
      .bind(
        "promotion_" +
          crypto.randomUUID()
            .replaceAll(
              "-",
              ""
            ),
        "DRAFT_SAVED",
        previous
          ? previous.revision_id
          : null,
        revisionId,
        now,
        "admin"
      )
  );

  await env.DB.batch(
    statements
  );

  /*
   * Gate pós-write:
   * conferir os três slots.
   */

  const slotsResult =
    await env.DB
      .prepare(
        [
          "SELECT slot, revision_id",
          "FROM catalog_slots",
          "ORDER BY slot"
        ].join(" ")
      )
      .all();

  const slots = {
    DRAFT: null,
    PREVIEW: null,
    PUBLISHED: null
  };

  for (
    const row of
    slotsResult.results || []
  ) {

    if (
      Object.prototype
        .hasOwnProperty.call(
          slots,
          row.slot
        )
    ) {

      slots[row.slot] =
        row.revision_id ?? null;
    }
  }

  return obaApiJson({
    ok: true,
    slot: "DRAFT",
    revision_id:
      revisionId,
    payload_sha256:
      sha,
    reused:
      Boolean(
        existing &&
        existing.revision_id
      ),
    slots
  });
}

/* OBA_DRAFT_API_END */

/* OBA_PREVIEW_API_BEGIN */

async function obaLoadCatalogSlot(env, slot) {
  const row =
    await env.DB
      .prepare(
        [
          "SELECT",
          "s.slot,",
          "s.revision_id,",
          "s.updated_at,",
          "r.payload_json,",
          "r.payload_sha256,",
          "r.created_at",
          "FROM catalog_slots s",
          "LEFT JOIN catalog_revisions r",
          "ON r.revision_id = s.revision_id",
          "WHERE s.slot = ?",
          "LIMIT 1"
        ].join(" ")
      )
      .bind(slot)
      .first();

  if (!row || !row.revision_id) {
    return {
      slot,
      revision_id: null,
      updated_at: row ? row.updated_at : null,
      payload_sha256: null,
      payload: null
    };
  }

  let payload;
  try {
    payload = JSON.parse(row.payload_json);
  }
  catch {
    throw new Error("slot_payload_corrupt");
  }

  return {
    slot,
    revision_id: row.revision_id,
    updated_at: row.updated_at,
    payload_sha256: row.payload_sha256,
    payload
  };
}

async function obaCatalogSlotsState(env) {
  const rows =
    await env.DB
      .prepare(
        [
          "SELECT slot, revision_id",
          "FROM catalog_slots",
          "ORDER BY slot"
        ].join(" ")
      )
      .all();

  const slots = { DRAFT: null, PREVIEW: null, PUBLISHED: null };
  for (const row of rows.results || []) {
    if (Object.prototype.hasOwnProperty.call(slots, row.slot)) {
      slots[row.slot] = row.revision_id ?? null;
    }
  }
  return slots;
}

async function obaHandlePreviewApi(request, env, url) {
  if (url.pathname !== "/api/preview") return null;

  if (request.method === "GET") {
    const preview = await obaLoadCatalogSlot(env, "PREVIEW");
    const slots = await obaCatalogSlotsState(env);
    return obaApiJson({ ok: true, ...preview, slots });
  }

  if (request.method !== "POST") {
    return obaApiJson({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body;
  try { body = await request.json(); }
  catch { return obaApiJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body || body.confirm !== "PREVIEW") {
    return obaApiJson({ ok: false, error: "preview_confirmation_required" }, 400);
  }

  const draft = await obaLoadCatalogSlot(env, "DRAFT");
  if (!draft.revision_id) {
    return obaApiJson({ ok: false, error: "draft_required" }, 409);
  }

  const before = await obaLoadCatalogSlot(env, "PREVIEW");
  const published = await obaLoadCatalogSlot(env, "PUBLISHED");

  if (before.revision_id === draft.revision_id) {
    return obaApiJson({
      ok: true,
      slot: "PREVIEW",
      revision_id: draft.revision_id,
      payload_sha256: draft.payload_sha256,
      reused: true,
      slots: {
        DRAFT: draft.revision_id,
        PREVIEW: before.revision_id,
        PUBLISHED: published.revision_id
      }
    });
  }

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB
      .prepare(
        [
          "UPDATE catalog_slots",
          "SET revision_id = ?,",
          "updated_at = ?",
          "WHERE slot = 'PREVIEW'"
        ].join(" ")
      )
      .bind(draft.revision_id, now),

    env.DB
      .prepare(
        [
          "INSERT INTO catalog_promotions",
          "(",
          "promotion_id,",
          "action,",
          "from_revision_id,",
          "to_revision_id,",
          "created_at,",
          "created_by",
          ")",
          "VALUES (?, ?, ?, ?, ?, ?)"
        ].join(" ")
      )
      .bind(
        "promotion_" + crypto.randomUUID().replaceAll("-", ""),
        "PREVIEW_CREATED",
        before.revision_id,
        draft.revision_id,
        now,
        "admin"
      )
  ]);

  return obaApiJson({
    ok: true,
    slot: "PREVIEW",
    revision_id: draft.revision_id,
    payload_sha256: draft.payload_sha256,
    reused: false,
    slots: {
      DRAFT: draft.revision_id,
      PREVIEW: draft.revision_id,
      PUBLISHED: published.revision_id
    }
  });
}


/* OBA_GITHUB_SYNC_BEGIN */

/*
 * Sincroniza o payload PUBLISHED com o repositório GitHub.
 * Chamada após gravação bem-sucedida no D1.
 * Falha silenciosa: não impede a publicação se o GitHub estiver
 * indisponível ou o GITHUB_PAT não estiver configurado.
 *
 * Requer secret GITHUB_PAT com permissão Contents: Read and write
 * no repositório oba-group-projects/cardapio.
 */

const OBA_GITHUB_REPO  = "oba-group-projects/cardapio";
const OBA_GITHUB_BRANCH = "feature/gestao-online-segura";

/*
 * Mapa: chave do payload → caminho do arquivo no repositório
 * Os JSONs que o cardápio público lê ficam em data/catalog-v1/ na raiz do branch.
 */
const OBA_GITHUB_FILE_MAP = Object.freeze({
  loja:       "data/catalog-v1/config.json",
  categorias: "data/catalog-v1/categories.json",
  caixas:     "data/catalog-v1/boxes.json",
  sabores:    "data/catalog-v1/flavors.json",
  produtos:   "data/catalog-v1/products.json",
  opcionais:  "data/catalog-v1/options.json",
  combos:     "data/catalog-v1/combos.json",
  tema:       "data/catalog-v1/theme.json"
});

async function obaGitHubGetFileSha(token, path) {
  const url =
    `https://api.github.com/repos/${OBA_GITHUB_REPO}/contents/${path}` +
    `?ref=${OBA_GITHUB_BRANCH}`;

  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oba-cardapio-worker"
    }
  });

  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub GET ${path}: HTTP ${resp.status}`);

  const data = await resp.json();
  return data.sha || null;
}

async function obaGitHubPutFile(token, path, content, sha, message) {
  const utf8Bytes = new TextEncoder().encode(content);
  const binStr = Array.from(utf8Bytes, b => String.fromCharCode(b)).join('');
  const body = {
    message,
    content: btoa(binStr),
    branch: OBA_GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  const resp = await fetch(
    `https://api.github.com/repos/${OBA_GITHUB_REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "oba-cardapio-worker"
      },
      body: JSON.stringify(body)
    }
  );

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`GitHub PUT ${path}: HTTP ${resp.status} — ${err.slice(0, 200)}`);
  }
  return true;
}

async function obaGitHubSyncPublished(env, payload, revisionId) {
  const token = env.GITHUB_PAT;

  if (!token) {
    console.warn("[9D] GITHUB_PAT nao configurado — sync ignorado.");
    return { ok: false, reason: "pat_missing" };
  }

  if (!payload || typeof payload !== "object") {
    console.warn("[9D] Payload invalido — sync ignorado.");
    return { ok: false, reason: "payload_invalid" };
  }

  const message =
    `chore(sync): publicacao via Central [${revisionId?.slice(0, 12) || "unknown"}]`;

  /* Helper que faz PUT para um branch específico (reutilizável) */
  async function putFileToBranch(branch, filePath, content) {
    const shaUrl = `https://api.github.com/repos/${OBA_GITHUB_REPO}/contents/${filePath}?ref=${branch}`;
    const shaResp = await fetch(shaUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "oba-cardapio-worker"
      }
    });
    const shaData = shaResp.ok ? await shaResp.json() : {};
    const sha = shaData.sha || null;

    const utf8Bytes = new TextEncoder().encode(content);
    const binStr = Array.from(utf8Bytes, b => String.fromCharCode(b)).join('');
    const body = { message, content: btoa(binStr), branch };
    if (sha) body.sha = sha;

    const resp = await fetch(
      `https://api.github.com/repos/${OBA_GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "oba-cardapio-worker"
        },
        body: JSON.stringify(body)
      }
    );
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`GitHub PUT ${filePath}@${branch}: HTTP ${resp.status} — ${err.slice(0, 200)}`);
    }
  }

  const results = {};
  let errors = 0;

  /* Sync para o branch de trabalho (feature) — mantém histórico de desenvolvimento */
  for (const [key, filePath] of Object.entries(OBA_GITHUB_FILE_MAP)) {
    const value = payload[key];
    if (value === undefined) continue;
    try {
      const content = JSON.stringify(value, null, 2);
      const sha = await obaGitHubGetFileSha(token, filePath);
      await obaGitHubPutFile(token, filePath, content, sha, message);
      results[key] = "ok";
    } catch (err) {
      console.error(`[9D] Erro ao sincronizar ${key} no feature:`, String(err));
      results[key] = "error";
      errors++;
    }
  }

  /* Sync para o main — onde o GitHub Pages serve o cardápio público */
  const mainResults = {};
  let mainErrors = 0;
  for (const [key, filePath] of Object.entries(OBA_GITHUB_FILE_MAP)) {
    const value = payload[key];
    if (value === undefined) continue;
    try {
      const content = JSON.stringify(value, null, 2);
      await putFileToBranch("main", filePath, content);
      mainResults[key] = "ok";
    } catch (err) {
      console.error(`[9D] Erro ao sincronizar ${key} no main:`, String(err));
      mainResults[key] = "error";
      mainErrors++;
    }
  }

  console.info(`[9D] Sync feature: erros=${errors} | Sync main: erros=${mainErrors}`);
  return { ok: errors === 0 && mainErrors === 0, errors, mainErrors, results, mainResults };
}

/* OBA_GITHUB_SYNC_CARDAPIO_HTML — sincroniza ui-desenvolvimento/index.html para main */

async function obaGitHubSyncCardapioHtml(env, request) {
  const token = env.GITHUB_PAT;
  if (!token) return { ok: false, reason: "pat_missing" };

  try {
    // Lê o HTML atual dos assets do Worker
    const assetUrl = new URL(request.url);
    assetUrl.pathname = "/ui-desenvolvimento/index.html";
    assetUrl.search = "";
    const assetResp = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: "GET" }));
    if (!assetResp.ok) return { ok: false, reason: "asset_not_found" };

    const htmlContent = await assetResp.text();
    const filePath = "ui-desenvolvimento/index.html";
    const targetBranch = "main";
    const message = "chore(auto-sync): cardapio publico atualizado via Worker [skip-sync]";

    // Busca SHA atual do arquivo no main (pode não existir ainda)
    const shaUrl = `https://api.github.com/repos/${OBA_GITHUB_REPO}/contents/${filePath}?ref=${targetBranch}`;
    const shaResp = await fetch(shaUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "oba-cardapio-worker"
      }
    });
    const shaData = shaResp.ok ? await shaResp.json() : {};
    const sha = shaData.sha || null;

    // Codifica o HTML em base64 com suporte completo a UTF-8 (TextEncoder é nativo no Workers)
    const utf8Bytes = new TextEncoder().encode(htmlContent);
    const binStr = Array.from(utf8Bytes, b => String.fromCharCode(b)).join('');
    const encoded = btoa(binStr);

    const body = { message, content: encoded, branch: targetBranch };
    if (sha) body.sha = sha;

    const putResp = await fetch(
      `https://api.github.com/repos/${OBA_GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "oba-cardapio-worker"
        },
        body: JSON.stringify(body)
      }
    );

    if (!putResp.ok) {
      const err = await putResp.text();
      console.error("[9D-HTML] Erro ao sincronizar HTML:", err);
      return { ok: false, reason: "put_failed", status: putResp.status };
    }

    console.info("[9D-HTML] ui-desenvolvimento/index.html sincronizado para main.");
    return { ok: true };
  } catch (err) {
    console.error("[9D-HTML] Excecao:", String(err));
    return { ok: false, reason: String(err) };
  }
}

/* OBA_GITHUB_SYNC_CARDAPIO_HTML_END */

/* OBA_PUBLISH_API_BEGIN */

async function obaHandlePublishApi(request, env, url) {
  if (
    url.pathname !== "/api/publish" &&
    url.pathname !== "/api/publish/rollback" &&
    url.pathname !== "/api/publish/history"
  ) {
    return null;
  }

  if (
    url.pathname === "/api/publish/history" &&
    request.method === "GET"
  ) {
    const published =
      await obaLoadCatalogSlot(env, "PUBLISHED");
    const preview =
      await obaLoadCatalogSlot(env, "PREVIEW");
    const draft =
      await obaLoadCatalogSlot(env, "DRAFT");

    const rows =
      await env.DB
        .prepare(
          [
            "SELECT",
            "p.promotion_id,",
            "p.action,",
            "p.from_revision_id,",
            "p.to_revision_id,",
            "p.created_at,",
            "p.created_by,",
            "r.payload_sha256",
            "FROM catalog_promotions p",
            "LEFT JOIN catalog_revisions r",
            "ON r.revision_id = p.to_revision_id",
            "ORDER BY p.created_at DESC",
            "LIMIT 30"
          ].join(" ")
        )
        .all();

    const history =
      (rows.results || []).map(row => ({
        promotion_id: row.promotion_id,
        action: row.action,
        from_revision_id: row.from_revision_id,
        to_revision_id: row.to_revision_id,
        revision_id: row.to_revision_id,
        payload_sha256: row.payload_sha256,
        created_at: row.created_at,
        created_by: row.created_by,
        is_published:
          Boolean(published.revision_id && row.to_revision_id === published.revision_id)
      }));

    return obaApiJson({
      ok: true,
      current_published_id: published.revision_id,
      current_preview_id: preview.revision_id,
      current_draft_id: draft.revision_id,
      history,
      slots: await obaCatalogSlotsState(env)
    });
  }

  if (
    url.pathname === "/api/publish" &&
    request.method === "GET"
  ) {
    const preview =
      await obaLoadCatalogSlot(env, "PREVIEW");

    const published =
      await obaLoadCatalogSlot(env, "PUBLISHED");

    return obaApiJson({
      ok: true,
      preview: {
        revision_id: preview.revision_id,
        payload_sha256: preview.payload_sha256
      },
      published: {
        revision_id: published.revision_id,
        payload_sha256: published.payload_sha256
      },
      slots: await obaCatalogSlotsState(env)
    });
  }

  if (request.method !== "POST") {
    return obaApiJson(
      { ok: false, error: "method_not_allowed" },
      405
    );
  }

  let body;
  try {
    body = await request.json();
  }
  catch {
    return obaApiJson(
      { ok: false, error: "invalid_json" },
      400
    );
  }

  if (url.pathname === "/api/publish") {
    if (!body || body.confirm !== "PUBLISH") {
      return obaApiJson(
        {
          ok: false,
          error: "publish_confirmation_required"
        },
        400
      );
    }

    const preview =
      await obaLoadCatalogSlot(env, "PREVIEW");

    const published =
      await obaLoadCatalogSlot(env, "PUBLISHED");

    if (!preview.revision_id || !preview.payload) {
      return obaApiJson(
        { ok: false, error: "preview_missing" },
        409
      );
    }

    if (
      !body.expected_revision_id ||
      body.expected_revision_id !== preview.revision_id
    ) {
      return obaApiJson(
        {
          ok: false,
          error: "preview_stale",
          expected_revision_id:
            body.expected_revision_id || null,
          current_preview_revision_id:
            preview.revision_id
        },
        409
      );
    }

    if (published.revision_id === preview.revision_id) {
      return obaApiJson({
        ok: true,
        slot: "PUBLISHED",
        revision_id: preview.revision_id,
        payload_sha256: preview.payload_sha256,
        previous_revision_id: published.revision_id,
        reused: true,
        slots: await obaCatalogSlotsState(env)
      });
    }

    const now = new Date().toISOString();
    const promotionId =
      "promotion_" +
      crypto.randomUUID().replaceAll("-", "");

    await env.DB.batch([
      env.DB
        .prepare(
          [
            "UPDATE catalog_slots",
            "SET revision_id = ?,",
            "updated_at = ?",
            "WHERE slot = 'PUBLISHED'"
          ].join(" ")
        )
        .bind(preview.revision_id, now),

      env.DB
        .prepare(
          [
            "INSERT INTO catalog_promotions",
            "(",
            "promotion_id,",
            "action,",
            "from_revision_id,",
            "to_revision_id,",
            "created_at,",
            "created_by",
            ")",
            "VALUES (?, ?, ?, ?, ?, ?)"
          ].join(" ")
        )
        .bind(
          promotionId,
          "PUBLISHED",
          published.revision_id,
          preview.revision_id,
          now,
          "admin"
        )
    ]);

    const after =
      await obaLoadCatalogSlot(env, "PUBLISHED");

    if (after.revision_id !== preview.revision_id) {
      throw new Error("published_post_write_mismatch");
    }

    /* R9D — Sincronizar JSONs do cardápio público no GitHub após publicação */
    const syncResult = await obaGitHubSyncPublished(
      env,
      after.payload,
      after.revision_id
    ).catch(err => {
      console.error("[9D] Sync GitHub falhou:", String(err));
      return { ok: false, reason: "sync_exception", detail: String(err) };
    });

    /* R9D-HTML — Sincronizar HTML do cardápio para main (GitHub Pages) */
    const syncHtmlResult = await obaGitHubSyncCardapioHtml(env, request).catch(err => {
      console.error("[9D-HTML] Sync HTML falhou:", String(err));
      return { ok: false, reason: "sync_html_exception", detail: String(err) };
    });

    return obaApiJson({
      ok: true,
      slot: "PUBLISHED",
      revision_id: after.revision_id,
      payload_sha256: after.payload_sha256,
      previous_revision_id: published.revision_id,
      promotion_id: promotionId,
      reused: false,
      github_sync: syncResult,
      github_sync_html: syncHtmlResult,
      slots: await obaCatalogSlotsState(env)
    });
  }

  /* /api/publish/rollback */

  if (
    !body ||
    body.confirm !== "ROLLBACK" ||
    !body.revision_id
  ) {
    return obaApiJson(
      {
        ok: false,
        error: "rollback_confirmation_required"
      },
      400
    );
  }

  const target =
    await env.DB
      .prepare(
        [
          "SELECT",
          "revision_id,",
          "payload_sha256",
          "FROM catalog_revisions",
          "WHERE revision_id = ?",
          "LIMIT 1"
        ].join(" ")
      )
      .bind(body.revision_id)
      .first();

  if (!target) {
    return obaApiJson(
      {
        ok: false,
        error: "rollback_revision_not_found"
      },
      404
    );
  }

  const published =
    await obaLoadCatalogSlot(env, "PUBLISHED");

  if (published.revision_id === target.revision_id) {
    return obaApiJson({
      ok: true,
      slot: "PUBLISHED",
      revision_id: target.revision_id,
      payload_sha256: target.payload_sha256,
      previous_revision_id: published.revision_id,
      reused: true,
      rolled_back: true,
      slots: await obaCatalogSlotsState(env)
    });
  }

  const now = new Date().toISOString();
  const promotionId =
    "promotion_" +
    crypto.randomUUID().replaceAll("-", "");

  await env.DB.batch([
    env.DB
      .prepare(
        [
          "UPDATE catalog_slots",
          "SET revision_id = ?,",
          "updated_at = ?",
          "WHERE slot = 'PUBLISHED'"
        ].join(" ")
      )
      .bind(target.revision_id, now),

    env.DB
      .prepare(
        [
          "INSERT INTO catalog_promotions",
          "(",
          "promotion_id,",
          "action,",
          "from_revision_id,",
          "to_revision_id,",
          "created_at,",
          "created_by",
          ")",
          "VALUES (?, ?, ?, ?, ?, ?)"
        ].join(" ")
      )
      .bind(
        promotionId,
        "ROLLBACK",
        published.revision_id,
        target.revision_id,
        now,
        "admin"
      )
  ]);

  const after =
    await obaLoadCatalogSlot(env, "PUBLISHED");

  if (after.revision_id !== target.revision_id) {
    throw new Error("rollback_post_write_mismatch");
  }

  return obaApiJson({
    ok: true,
    slot: "PUBLISHED",
    revision_id: after.revision_id,
    payload_sha256: after.payload_sha256,
    previous_revision_id: published.revision_id,
    promotion_id: promotionId,
    reused: false,
    rolled_back: true,
    slots: await obaCatalogSlotsState(env)
  });
}

/* OBA_MEDIA_API_BEGIN */

async function obaHandleMediaServe(request, env, url) {
  const mediaId = url.pathname.slice("/api/media/".length).trim();
  if (!mediaId) {
    return json({ ok: false, error: "media_id_required" }, 400);
  }

  const row = await env.DB
    .prepare(
      "SELECT media_id, mime_type, data_base64, size_bytes FROM catalog_media WHERE media_id = ? LIMIT 1"
    )
    .bind(mediaId)
    .first();

  if (!row) {
    return json({ ok: false, error: "media_not_found" }, 404);
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  const etag = `"${row.media_id}"`;

  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        "ETag": etag,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  try {
    const raw = atob(row.data_base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": row.mime_type || "image/jpeg",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return json({ ok: false, error: "media_corrupted" }, 500);
  }
}

async function obaHandleMediaApi(request, env, url) {
  // DELETE /api/media/:id — exclusão de mídia
  if (url.pathname.startsWith("/api/media/") && request.method === "DELETE") {
    const mediaId = url.pathname.slice("/api/media/".length).trim();
    if (!mediaId || mediaId === "upload" || mediaId === "github") {
      return obaApiJson({ ok: false, error: "media_id_required" }, 400);
    }
    try {
      const row = await env.DB.prepare("SELECT media_id FROM catalog_media WHERE media_id = ?").bind(mediaId).first();
      if (!row) return obaApiJson({ ok: false, error: "media_not_found" }, 404);
      await env.DB.prepare("DELETE FROM catalog_media WHERE media_id = ?").bind(mediaId).run();
      return obaApiJson({ ok: true, deleted: mediaId });
    } catch (err) {
      return obaApiJson({ ok: false, error: String(err) }, 500);
    }
  }

  if (
    url.pathname !== "/api/media" &&
    url.pathname !== "/api/media/upload" &&
    url.pathname !== "/api/upload-image"
  ) {
    return null;
  }

  if (url.pathname === "/api/media" && request.method === "GET") {
    const rows = await env.DB
      .prepare(
        "SELECT media_id, mime_type, size_bytes, created_at, created_by FROM catalog_media ORDER BY created_at DESC LIMIT 50"
      )
      .all();

    return obaApiJson({
      ok: true,
      media: rows.results || []
    });
  }

  if (
    (url.pathname === "/api/media/upload" || url.pathname === "/api/upload-image") &&
    request.method === "POST"
  ) {
    let body;
    try {
      body = await request.json();
    } catch {
      return obaApiJson({ ok: false, error: "invalid_json_body" }, 400);
    }

    if (!body || (!body.base64 && !body.data)) {
      return obaApiJson({ ok: false, error: "base64_data_required" }, 400);
    }

    // aceita tanto body.base64 (legado) quanto body.data (aba Mídia)
    const rawData = body.base64 || body.data || "";
    const cleanBase64 = String(rawData).replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, "").trim();
    if (cleanBase64.length < 10) {
      return obaApiJson({ ok: false, error: "base64_too_short" }, 400);
    }

    if (cleanBase64.length > 2000000) {
      return obaApiJson({ ok: false, error: "image_too_large_max_1mb" }, 413);
    }

    let mimeType = String(body.mime_type || body.mime || "").toLowerCase();
    if (!mimeType && (body.fileName || body.name)) {
      const ext = String(body.fileName || body.name).split(".").pop().toLowerCase();
      if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
      else if (ext === "webp") mimeType = "image/webp";
      else if (ext === "gif") mimeType = "image/gif";
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
      mimeType = "image/jpeg";
    }

    const sizeBytes = Math.floor((cleanBase64.length * 3) / 4);
    const mediaId = "media_" + crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const now = new Date().toISOString();

    await env.DB
      .prepare(
        [
          "INSERT INTO catalog_media",
          "(media_id, mime_type, data_base64, size_bytes, created_at, created_by)",
          "VALUES (?, ?, ?, ?, ?, ?)"
        ].join(" ")
      )
      .bind(
        mediaId,
        mimeType,
        cleanBase64,
        sizeBytes,
        now,
        "admin"
      )
      .run();

    const mediaPath = `/api/media/${mediaId}`;

    return obaApiJson({
      ok: true,
      media_id: mediaId,
      path: mediaPath,
      mime_type: mimeType,
      size_bytes: sizeBytes
    });
  }

  return obaApiJson({ ok: false, error: "method_not_allowed" }, 405);
}

/* OBA_GITHUB_IMAGES_API_BEGIN */

/*
 * GET /api/media/github — Lista imagens do repositório GitHub (pasta Images/)
 * Usa env.GITHUB_PAT para autenticar na GitHub Contents API.
 * Retorna array de { name, url, path } para exibição na galeria.
 */
async function obaHandleGithubImagesApi(request, env, url) {
  if (url.pathname !== "/api/media/github") return null;
  if (request.method !== "GET") return obaApiJson({ ok: false, error: "method_not_allowed" }, 405);

  const token = env.GITHUB_PAT;
  if (!token) return obaApiJson({ ok: false, error: "github_pat_missing" }, 500);

  const repo   = "oba-group-projects/cardapio";
  const branch = "main";
  const folder = "Images";

  async function listarRecursivo(path) {
    const resp = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
      { headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "oba-cardapio-worker" } }
    );
    if (!resp.ok) return [];
    const items = await resp.json();
    if (!Array.isArray(items)) return [];
    const result = [];
    for (const item of items) {
      if (item.type === "file" && /\.(png|jpe?g|gif|webp|svg)$/i.test(item.name)) {
        result.push({ name: item.name, path: item.path, url: item.download_url });
      } else if (item.type === "dir") {
        const sub = await listarRecursivo(item.path);
        result.push(...sub);
      }
    }
    return result;
  }

  try {
    const images = await listarRecursivo(folder);
    return obaApiJson({ ok: true, items: images });
  } catch (err) {
    return obaApiJson({ ok: false, error: String(err) }, 500);
  }
}

/* OBA_GITHUB_IMAGES_API_END */

/* OBA_MEDIA_API_END */

async function obaPrivatePreviewPage(request, env) {
  const preview = await obaLoadCatalogSlot(env, "PREVIEW");
  if (!preview.revision_id || !preview.payload) {
    return new Response(
      "<!doctype html><html lang='pt-BR'><meta charset='utf-8'><title>Preview indisponivel</title><body><h1>Preview ainda nao foi criado.</h1><p>Volte a Central e clique em Visualizar cardapio.</p></body></html>",
      { status: 409, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }
    );
  }

  const assetUrl = new URL(request.url);
  assetUrl.pathname = "/ui-desenvolvimento/index.html";
  assetUrl.search = "";
  assetUrl.hash = "";
  const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: "GET", headers: request.headers }));
  if (!asset.ok) return new Response("Preview asset unavailable", { status: 502 });

  const source = await asset.text();
  const inject = "<base href='/'><script src='/preview-bootstrap.js'></script>";
  const html = source.includes("<head>") ? source.replace("<head>", "<head>" + inject) : inject + source;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; img-src * data: blob:; connect-src 'self' https:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'"
    }
  });
}

/* OBA_PREVIEW_API_END */

// ============================================================
// FASE 12A — PROPOSTAS DE ORCAMENTO
// ============================================================

function obaProposalId() {
  return "prop_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
function obaScenarioId() {
  return "scen_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
function obaItemId() {
  return "item_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

async function obaUpsertProposal(env, proposalId, data, now) {
  const {
    cliente = "",
    data_evento = null,
    convidados = null,
    tipo_evento = null,
    resumo = null,
    abertura = null,
    validade = null,
    status = "rascunho",
    whatsapp = null,
    template = "evento",
    empresa = null,
    demanda = null,
    frequencia = null,
    orcamento_ref = null,
    observacoes = null,
    prazo_pedido = null,
    prazo_entrega = null,
    cond_pagamento = null,
    pedido_minimo = null,
    qtd_solicitada = null,
    orcamento_max = null,
    data_entrega = null,
    data_comemorativa = null,
  } = data;

  await env.DB.prepare(`
    INSERT INTO proposals (proposal_id, cliente, whatsapp, data_evento, convidados, tipo_evento,
      resumo, abertura, validade, status, template, empresa, demanda, frequencia, orcamento_ref,
      observacoes, prazo_pedido, prazo_entrega, cond_pagamento, pedido_minimo,
      qtd_solicitada, orcamento_max, data_entrega, data_comemorativa,
      criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(proposal_id) DO UPDATE SET
      cliente=excluded.cliente, whatsapp=excluded.whatsapp,
      data_evento=excluded.data_evento,
      convidados=excluded.convidados, tipo_evento=excluded.tipo_evento,
      resumo=excluded.resumo, abertura=excluded.abertura,
      validade=excluded.validade, status=excluded.status,
      template=excluded.template, empresa=excluded.empresa,
      demanda=excluded.demanda, frequencia=excluded.frequencia,
      orcamento_ref=excluded.orcamento_ref, observacoes=excluded.observacoes,
      prazo_pedido=excluded.prazo_pedido, prazo_entrega=excluded.prazo_entrega,
      cond_pagamento=excluded.cond_pagamento, pedido_minimo=excluded.pedido_minimo,
      qtd_solicitada=excluded.qtd_solicitada, orcamento_max=excluded.orcamento_max,
      data_entrega=excluded.data_entrega, data_comemorativa=excluded.data_comemorativa,
      atualizado_em=excluded.atualizado_em
  `).bind(
    proposalId, cliente, whatsapp, data_evento, convidados, tipo_evento,
    resumo, abertura, validade, status, template, empresa, demanda, frequencia,
    orcamento_ref, observacoes, prazo_pedido, prazo_entrega, cond_pagamento, pedido_minimo,
    qtd_solicitada, orcamento_max, data_entrega, data_comemorativa,
    now, now
  ).run();
}

async function obaUpsertScenarios(env, proposalId, scenarios) {
  // Apaga cenários existentes e recria — abordagem simples e segura
  await env.DB.prepare("DELETE FROM proposal_items WHERE scenario_id IN (SELECT scenario_id FROM proposal_scenarios WHERE proposal_id = ?)").bind(proposalId).run();
  await env.DB.prepare("DELETE FROM proposal_scenarios WHERE proposal_id = ?").bind(proposalId).run();

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const scenarioId = s.scenario_id || obaScenarioId();
    await env.DB.prepare(`
      INSERT INTO proposal_scenarios (scenario_id, proposal_id, nome, descricao, texto_publico, desconto_tipo, desconto_valor, doces_por_convidado, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      scenarioId, proposalId,
      s.nome || `Cenário ${i + 1}`,
      s.descricao || null,
      s.texto_publico || null,
      s.desconto_tipo || "none",
      Number(s.desconto_valor) || 0,
      s.docespor != null ? Number(s.docespor) : null,
      i + 1
    ).run();

    const items = Array.isArray(s.items) ? s.items : [];
    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      await env.DB.prepare(`
        INSERT INTO proposal_items (item_id, scenario_id, tipo, ref_id, descricao, qtd, preco_unit, ordem)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        obaItemId(), scenarioId,
        it.tipo || "livre",
        it.ref_id || null,
        it.descricao || "",
        Number(it.qtd) || 1,
        Number(it.preco_unit) || 0,
        j + 1
      ).run();
    }
  }
}

async function obaLoadProposal(env, proposalId) {
  const proposal = await env.DB.prepare("SELECT * FROM proposals WHERE proposal_id = ?").bind(proposalId).first();
  if (!proposal) return null;

  const scenarios = await env.DB.prepare(
    "SELECT * FROM proposal_scenarios WHERE proposal_id = ? ORDER BY ordem"
  ).bind(proposalId).all();

  const result = { ...proposal, scenarios: [] };
  for (const s of scenarios.results) {
    const items = await env.DB.prepare(
      "SELECT * FROM proposal_items WHERE scenario_id = ? ORDER BY ordem"
    ).bind(s.scenario_id).all();
    result.scenarios.push({ ...s, items: items.results });
  }

  // Carrega options (corporativo/sazonal) com faixas e imagens
  const optRows = await env.DB.prepare(
    "SELECT * FROM proposal_options WHERE proposal_id = ? ORDER BY ordem"
  ).bind(proposalId).all();

  result.options = [];
  for (const opt of (optRows.results||[])) {
    const faixas = await env.DB.prepare(
      "SELECT * FROM proposal_option_faixas WHERE option_id = ? ORDER BY ordem"
    ).bind(opt.option_id).all();
    const medias = await env.DB.prepare(
      "SELECT media_id, mime, tamanho, legenda, ordem FROM proposal_media WHERE option_id = ? ORDER BY ordem"
    ).bind(opt.option_id).all();
    result.options.push({ ...opt, faixas: faixas.results||[], medias: medias.results||[] });
  }

  return result;
}

async function obaHandleProposalsApi(request, env, url) {
  if (!url.pathname.startsWith("/api/proposals")) return null;

  const now = new Date().toISOString();

  // GET /api/proposals — listar todas
  if (url.pathname === "/api/proposals" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT proposal_id, cliente, empresa, data_evento, data_comemorativa, convidados, tipo_evento, template, status, criado_em, atualizado_em FROM proposals ORDER BY criado_em DESC"
    ).all();
    return json({ ok: true, proposals: rows.results });
  }

  // POST /api/proposals — criar nova proposta
  if (url.pathname === "/api/proposals" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }

    const proposalId = obaProposalId();
    await obaUpsertProposal(env, proposalId, body, now);
    if (Array.isArray(body.scenarios) && body.scenarios.length > 0) {
      await obaUpsertScenarios(env, proposalId, body.scenarios);
    }
    const saved = await obaLoadProposal(env, proposalId);
    return json({ ok: true, proposal: saved }, 201);
  }

  // GET /api/proposals/:id — carregar proposta completa
  const matchGet = url.pathname.match(/^\/api\/proposals\/([^/]+)$/);
  if (matchGet && request.method === "GET") {
    const proposal = await obaLoadProposal(env, matchGet[1]);
    if (!proposal) return json({ ok: false, error: "nao_encontrada" }, 404);
    return json({ ok: true, proposal });
  }

  // PUT /api/proposals/:id — atualizar proposta + cenários
  const matchPut = url.pathname.match(/^\/api\/proposals\/([^/]+)$/);
  if (matchPut && request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }

    const existing = await env.DB.prepare("SELECT proposal_id FROM proposals WHERE proposal_id = ?").bind(matchPut[1]).first();
    if (!existing) return json({ ok: false, error: "nao_encontrada" }, 404);

    await obaUpsertProposal(env, matchPut[1], body, now);
    if (Array.isArray(body.scenarios)) {
      await obaUpsertScenarios(env, matchPut[1], body.scenarios);
    }
    const saved = await obaLoadProposal(env, matchPut[1]);
    return json({ ok: true, proposal: saved });
  }

  // PATCH /api/proposals/:id/status — atualizar só o status
  const matchStatus = url.pathname.match(/^\/api\/proposals\/([^/]+)\/status$/);
  if (matchStatus && request.method === "PATCH") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }

    const allowed = ["rascunho", "enviada", "em_negociacao", "aceita", "recusada", "arquivada"];
    if (!allowed.includes(body.status)) {
      return json({ ok: false, error: "status_invalido" }, 400);
    }
    const result = await env.DB.prepare(
      "UPDATE proposals SET status = ?, atualizado_em = ? WHERE proposal_id = ?"
    ).bind(body.status, now, matchStatus[1]).run();

    if (result.meta.changes === 0) return json({ ok: false, error: "nao_encontrada" }, 404);
    return json({ ok: true, proposal_id: matchStatus[1], status: body.status });
  }

  // DELETE /api/proposals/:id — excluir proposta (apenas rascunhos)
  const matchDel = url.pathname.match(/^\/api\/proposals\/([^/]+)$/);
  if (matchDel && request.method === "DELETE") {
    const existing = await env.DB.prepare(
      "SELECT status FROM proposals WHERE proposal_id = ?"
    ).bind(matchDel[1]).first();
    if (!existing) return json({ ok: false, error: "nao_encontrada" }, 404);
    if (existing.status !== "rascunho") {
      return json({ ok: false, error: "apenas_rascunhos_podem_ser_excluidos" }, 403);
    }
    // ON DELETE CASCADE apaga cenarios e itens automaticamente
    await env.DB.prepare("DELETE FROM proposals WHERE proposal_id = ?").bind(matchDel[1]).run();
    return json({ ok: true, deleted: matchDel[1] });
  }

  // POST /api/proposals/:id/duplicate — duplicar proposta completa
  const matchDup = url.pathname.match(/^\/api\/proposals\/([^/]+)\/duplicate$/);
  if (matchDup && request.method === "POST") {
    const src = await obaLoadProposal(env, matchDup[1]);
    if (!src) return json({ ok: false, error: "nao_encontrada" }, 404);

    const newId = obaProposalId();
    // Copia todos os campos, reset status para rascunho
    const copy = Object.assign({}, src, { status: "rascunho" });
    delete copy.proposal_id;
    await obaUpsertProposal(env, newId, copy, now);
    if (Array.isArray(src.scenarios) && src.scenarios.length > 0) {
      const scenariosLimpos = src.scenarios.map(function(s) {
        const sc = Object.assign({}, s);
        delete sc.scenario_id; // force novo ID
        return sc;
      });
      await obaUpsertScenarios(env, newId, scenariosLimpos);
    }
    // Copia imagens globais da proposta (sem option_id)
    const medias = await env.DB.prepare(
      "SELECT dados,mime,tamanho,legenda,ordem FROM proposal_media WHERE proposal_id = ? AND (option_id IS NULL OR option_id = '') ORDER BY ordem"
    ).bind(matchDup[1]).all();
    for (const m of (medias.results||[])) {
      const mid = "pmid_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
      await env.DB.prepare(
        "INSERT INTO proposal_media (media_id,proposal_id,dados,mime,tamanho,legenda,ordem,criado_em) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(mid, newId, m.dados, m.mime, m.tamanho, m.legenda, m.ordem, now).run();
    }
    // Copia proposal_options + faixas + imagens por opção (corporativo/sazonal)
    const optRows = await env.DB.prepare(
      "SELECT * FROM proposal_options WHERE proposal_id = ? ORDER BY ordem"
    ).bind(matchDup[1]).all();
    for (const opt of (optRows.results||[])) {
      const newOptId = "opt_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
      await env.DB.prepare(
        "INSERT INTO proposal_options (option_id,proposal_id,nome,descricao,valor_unit,ordem,criado_em) VALUES (?,?,?,?,?,?,?)"
      ).bind(newOptId, newId, opt.nome, opt.descricao, opt.valor_unit, opt.ordem, now).run();
      // Copia faixas
      const faixas = await env.DB.prepare(
        "SELECT ate,preco,ordem FROM proposal_option_faixas WHERE option_id = ? ORDER BY ordem"
      ).bind(opt.option_id).all();
      for (const f of (faixas.results||[])) {
        const fid = "fxa_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
        await env.DB.prepare(
          "INSERT INTO proposal_option_faixas (faixa_id,option_id,de,ate,preco,ordem) VALUES (?,?,?,?,?,?)"
        ).bind(fid, newOptId, f.de??null, f.ate, f.preco, f.ordem).run();
      }
      // Copia imagens da opção
      const optMedias = await env.DB.prepare(
        "SELECT dados,mime,tamanho,legenda,ordem FROM proposal_media WHERE option_id = ? ORDER BY ordem"
      ).bind(opt.option_id).all();
      for (const m of (optMedias.results||[])) {
        const mid = "pmid_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
        await env.DB.prepare(
          "INSERT INTO proposal_media (media_id,proposal_id,option_id,dados,mime,tamanho,legenda,ordem,criado_em) VALUES (?,?,?,?,?,?,?,?,?)"
        ).bind(mid, newId, newOptId, m.dados, m.mime, m.tamanho, m.legenda, m.ordem, now).run();
      }
    }
    const saved = await obaLoadProposal(env, newId);
    return json({ ok: true, proposal: saved }, 201);
  }

  // POST /api/proposals/:id/media — upload de imagem (max 8 por proposta)
  const matchMedia = url.pathname.match(/^\/api\/proposals\/([^/]+)\/media$/);
  if (matchMedia && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }

    // Verifica limite de 8 imagens
    const count = await env.DB.prepare(
      "SELECT COUNT(*) as n FROM proposal_media WHERE proposal_id = ?"
    ).bind(matchMedia[1]).first();
    if ((count?.n||0) >= 8) return json({ ok: false, error: "limite_8_imagens" }, 400);

    const mid = "pmid_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
    await env.DB.prepare(
      "INSERT INTO proposal_media (media_id,proposal_id,dados,mime,tamanho,legenda,ordem,criado_em) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(
      mid, matchMedia[1],
      body.dados||"", body.mime||"image/jpeg",
      Number(body.tamanho)||0, body.legenda||null,
      Number(body.ordem)||1, now
    ).run();
    return json({ ok: true, media_id: mid });
  }

  // GET /api/proposals/:id/media — listar imagens
  const matchMediaGet = url.pathname.match(/^\/api\/proposals\/([^/]+)\/media$/);
  if (matchMediaGet && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT media_id,mime,tamanho,legenda,ordem FROM proposal_media WHERE proposal_id = ? ORDER BY ordem"
    ).bind(matchMediaGet[1]).all();
    return json({ ok: true, media: rows.results||[] });
  }

  // DELETE /api/proposals/:id/media/:media_id — remover imagem
  const matchMediaDel = url.pathname.match(/^\/api\/proposals\/([^/]+)\/media\/([^/]+)$/);
  if (matchMediaDel && request.method === "DELETE") {
    await env.DB.prepare(
      "DELETE FROM proposal_media WHERE media_id = ? AND proposal_id = ?"
    ).bind(matchMediaDel[2], matchMediaDel[1]).run();
    return json({ ok: true, deleted: matchMediaDel[2] });
  }

  // GET /api/proposals/:id/media/:media_id/dados — servir imagem (rota publica)
  const matchMediaServe = url.pathname.match(/^\/api\/proposals\/([^/]+)\/media\/([^/]+)\/dados$/);
  if (matchMediaServe && request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT dados,mime FROM proposal_media WHERE media_id = ?"
    ).bind(matchMediaServe[2]).first();
    if (!row) return new Response("not found", { status: 404 });
    const buf = Uint8Array.from(atob(row.dados.replace(/^data:[^,]+,/,"")), c => c.charCodeAt(0));
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  // ---- ROTAS DE OPTIONS (corporativo/sazonal) ----
  // POST /api/proposals/:id/options — criar option
  const matchOptPost = url.pathname.match(/^\/api\/proposals\/([^/]+)\/options$/);
  if (matchOptPost && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }
    const count = await env.DB.prepare("SELECT COUNT(*) as n FROM proposal_options WHERE proposal_id=?").bind(matchOptPost[1]).first();
    if ((count?.n||0) >= 5) return json({ ok: false, error: "limite_5_opcoes" }, 400);
    const oid = "opt_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
    await env.DB.prepare(
      "INSERT INTO proposal_options (option_id,proposal_id,nome,descricao,valor_unit,ordem,criado_em) VALUES (?,?,?,?,?,?,?)"
    ).bind(oid, matchOptPost[1], body.nome||"Opção", body.descricao||null, body.valor_unit||null, Number(body.ordem)||1, now).run();
    // Salva faixas se enviadas
    if (Array.isArray(body.faixas)) {
      for (let fi=0; fi<body.faixas.length; fi++) {
        const f = body.faixas[fi];
        const fid = "fxa_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
        await env.DB.prepare("INSERT INTO proposal_option_faixas (faixa_id,option_id,de,ate,preco,ordem) VALUES (?,?,?,?,?,?)").bind(fid,oid,f.de??null,f.ate??null,Number(f.preco)||0,fi+1).run();
      }
    }
    return json({ ok: true, option_id: oid });
  }

  // PUT /api/proposals/:id/options/:option_id — atualizar option
  const matchOptPut = url.pathname.match(/^\/api\/proposals\/([^/]+)\/options\/([^/]+)$/);
  if (matchOptPut && request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }
    await env.DB.prepare(
      "UPDATE proposal_options SET nome=?,descricao=?,valor_unit=?,ordem=? WHERE option_id=? AND proposal_id=?"
    ).bind(body.nome||"Opção", body.descricao||null, body.valor_unit||null, Number(body.ordem)||1, matchOptPut[2], matchOptPut[1]).run();
    // Recria faixas
    if (Array.isArray(body.faixas)) {
      await env.DB.prepare("DELETE FROM proposal_option_faixas WHERE option_id=?").bind(matchOptPut[2]).run();
      for (let fi=0; fi<body.faixas.length; fi++) {
        const f = body.faixas[fi];
        const fid = "fxa_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
        await env.DB.prepare("INSERT INTO proposal_option_faixas (faixa_id,option_id,de,ate,preco,ordem) VALUES (?,?,?,?,?,?)").bind(fid,matchOptPut[2],f.de??null,f.ate??null,Number(f.preco)||0,fi+1).run();
      }
    }
    return json({ ok: true });
  }

  // DELETE /api/proposals/:id/options/:option_id
  const matchOptDel = url.pathname.match(/^\/api\/proposals\/([^/]+)\/options\/([^/]+)$/);
  if (matchOptDel && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM proposal_media WHERE option_id=?").bind(matchOptDel[2]).run();
    await env.DB.prepare("DELETE FROM proposal_options WHERE option_id=? AND proposal_id=?").bind(matchOptDel[2], matchOptDel[1]).run();
    return json({ ok: true, deleted: matchOptDel[2] });
  }

  // POST /api/proposals/:id/options/:option_id/media — upload imagem para option
  const matchOptMedia = url.pathname.match(/^\/api\/proposals\/([^/]+)\/options\/([^/]+)\/media$/);
  if (matchOptMedia && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }
    const countOm = await env.DB.prepare("SELECT COUNT(*) as n FROM proposal_media WHERE option_id=?").bind(matchOptMedia[2]).first();
    if ((countOm?.n||0) >= 5) return json({ ok: false, error: "limite_5_imagens_por_opcao" }, 400);
    const mid = "pmid_" + crypto.randomUUID().replace(/-/g,"").slice(0,12);
    await env.DB.prepare(
      "INSERT INTO proposal_media (media_id,proposal_id,option_id,dados,mime,tamanho,legenda,ordem,criado_em) VALUES (?,?,?,?,?,?,?,?,?)"
    ).bind(mid, matchOptMedia[1], matchOptMedia[2], body.dados||"", body.mime||"image/jpeg", Number(body.tamanho)||0, body.legenda||null, Number(body.ordem)||1, now).run();
    return json({ ok: true, media_id: mid });
  }

  // DELETE /api/proposals/:id/options/:option_id/media/:media_id
  const matchOptMediaDel = url.pathname.match(/^\/api\/proposals\/([^/]+)\/options\/([^/]+)\/media\/([^/]+)$/);
  if (matchOptMediaDel && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM proposal_media WHERE media_id=? AND option_id=?").bind(matchOptMediaDel[3], matchOptMediaDel[2]).run();
    return json({ ok: true });
  }

  return null;
}

// ============================================================
// ROTA PUBLICA: GET /proposta/:id
// Retorna JSON com a proposta completa (sem autenticacao)
// O HTML da pagina publica sera servido pela Fase 12A-3
// ============================================================
async function obaHandlePropostaPublica(request, env, url) {
  const match = url.pathname.match(/^\/proposta\/([^/]+)$/);
  if (!match) return null;
  if (request.method !== "GET") return null;

  const proposal = await obaLoadProposal(env, match[1]);
  if (!proposal) {
    return new Response(
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposta nao encontrada</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FAF7F4;color:#3B2A1E;text-align:center;padding:32px}.logo{font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#C8922A;margin-bottom:20px}h2{font-size:20px;font-weight:500;margin-bottom:10px}p{color:#aaa;font-size:13px;line-height:1.6}</style><body><div><div class="logo">Oba Doceria</div><h2>Proposta n&atilde;o encontrada</h2><p>O link pode ter expirado.<br>Entre em contato com a Oba Doceria.</p></div></body></html>`,
      { status:404, headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"} }
    );
  }

  let cats=[], flavors=[], obaWpp="";
  try {
    const pub = await obaLoadCatalogSlot(env, "PUBLISHED");
    if (pub && pub.payload) {
      cats    = pub.payload.categorias || pub.payload.categories || [];
      flavors = pub.payload.sabores    || pub.payload.flavors    || [];
      const lj = pub.payload.loja || {};
      obaWpp = (lj.whatsapp || lj.store?.whatsapp || "").replace(/\D/g,"");
    }
  } catch(e) {}

  const catPM={}, saborPM={};
  cats.forEach(c    => { catPM[String(c.id)]   = Number(c.precoReferencia||0); });
  flavors.forEach(f => { saborPM[String(f.id)] = Number(f.preco||0); });

  // Bifurca por template
  const tmpl = proposal.template || "evento";
  if (tmpl === "corporativo") return obaHandlePropostaCorporativo(proposal, obaWpp, env, match[1]);
  if (tmpl === "sazonal")     return obaHandlePropostaSazonal(proposal, obaWpp, env, match[1]);

  const R = (v) => {
    const n = Number(v||0).toFixed(2), [i,d]=n.split(".");
    return "R$\u00a0"+i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+d;
  };
  const MESES=["janeiro","fevereiro","mar\u00e7o","abril","maio","junho",
               "julho","agosto","setembro","outubro","novembro","dezembro"];
  const fmtD=(d)=>{ if(!d)return null; try{const[y,m,dy]=d.split("-");return parseInt(dy)+" de "+MESES[parseInt(m)-1]+" de "+y;}catch{return d;} };

  const META=[
    { rotulo:"Econ\u00f4mico",
      intro:"A op\u00e7\u00e3o que equilibra qualidade e custo, garantindo o essencial para um evento especial e inesquec\u00edvel." },
    { rotulo:"Equilibrado",
      intro:"A escolha mais completa, pensada para oferecer variedade e sabor com a quantidade certa para cada convidado." },
    { rotulo:"Generoso",
      intro:"Para quem quer garantir que n\u00e3o vai faltar nada \u2014 uma experi\u00eancia farta, diversificada e verdadeiramente memor\u00e1vel." },
  ];

  const PAL=[
    {acento:"#B8860B",fundo:"#FFFDF8",topo:"#C8922A"},
    {acento:"#9B3A5C",fundo:"#FFF8FA",topo:"#B05070"},
    {acento:"#5B4A9A",fundo:"#F9F7FF",topo:"#6B5BAA"},
    {acento:"#2E7A50",fundo:"#F5FBF7",topo:"#3A8A5A"},
  ];

  const dataEvento = fmtD(proposal.data_evento);
  const validade   = fmtD(proposal.validade);
  const nomeCliente   = proposal.cliente||"";
  const nomeEvento    = (proposal.tipo_evento||"evento").toLowerCase();
  const numConvidados = proposal.convidados ? Number(proposal.convidados) : null;
  const numCenarios   = (proposal.scenarios||[]).length;

  // Data curta para o bloco de info (dd/mm/aaaa)
  const fmtDCurta=(d)=>{ if(!d)return null; try{const[y,m,dy]=d.split("-");return dy+"/"+m+"/"+y;}catch{return d;} };
  const dataEventoCurta = fmtDCurta(proposal.data_evento);

  // Evento com nome: "Casamento de Fofa"
  const eventoComNome = proposal.tipo_evento
    ? (proposal.tipo_evento + (nomeCliente ? " de "+nomeCliente : ""))
    : "";

  // Texto de abertura: campo abertura tem prioridade maxima (editavel na Central)
  // Fallback: campo resumo; Fallback final: texto automatico
  const textoAberturaPersonalizado = (proposal.abertura||proposal.resumo||"").trim();

  const paraA = textoAberturaPersonalizado
    ? textoAberturaPersonalizado
    : ( dataEvento && nomeCliente
        ? nomeCliente+", <strong>"+dataEvento+"</strong> vai ser um dia que voc\u00ea vai querer lembrar em cada detalhe."
        : nomeCliente
          ? nomeCliente+", que data linda essa que se aproxima."
          : "Que data linda essa que se aproxima." );

  const paraB = textoAberturaPersonalizado ? "" :
    "A mesa de doces \u00e9 onde os olhos brilham antes mesmo da primeira mordida. \u00c9 onde as pessoas param, fotografam, chamam algu\u00e9m \u2014 e \u00e9 exatamente nesse momento que a Oba Doceria entra.";

  const paraC = textoAberturaPersonalizado ? "" : (
    "Preparamos <strong>"+numCenarios+" op\u00e7\u00e3o"+(numCenarios!==1?"es":"")+"</strong>"+
    (numConvidados?" com carinho para voc\u00ea e seus <strong>"+numConvidados+" convidados</strong>.":" com carinho para o seu "+nomeEvento+".")+
    " Cada uma reflete um cuidado diferente \u2014 escolha a que mais parece com o que voc\u00ea sonhou."
  );

  const paraD = textoAberturaPersonalizado ? "" :
    "Do come\u00e7o ao fim, cada detalhe \u00e9 pensado com o mesmo cuidado que voc\u00ea dedicou a esse dia.";

  // Calcula totais e monta dados de cada cenario
  const cenariosData = (proposal.scenarios||[]).map(function(s,si){
    const pal  = PAL[si]||PAL[PAL.length-1];
    const meta = META[si]||{rotulo:"",intro:""};

    let sub=0;
    (s.items||[]).forEach(function(it){
      if(it.tipo==="catalogo"&&it.ref_id){
        const parts=(it.ref_id||"").split(":");
        const cid=parts[0], sid=parts[1];
        sub+=Number(it.qtd||0)*(sid==="__total__"?(catPM[cid]||0):(Number(it.preco_unit||0)||(saborPM[sid]||0)));
      } else sub+=Number(it.qtd||0)*Number(it.preco_unit||0);
    });
    let desc=0;
    if(s.desconto_tipo==="reais") desc=Number(s.desconto_valor||0);
    else if(s.desconto_tipo==="percentual") desc=sub*(Number(s.desconto_valor||0)/100);
    const total=Math.max(0,sub-desc);

    const totalDoces = s.doces_por_convidado && proposal.convidados
      ? Number(s.doces_por_convidado)*Number(proposal.convidados)
      : null;

    const porCat={}, livres=[];
    (s.items||[]).forEach(function(it){
      if(it.tipo==="catalogo"&&it.ref_id){
        const parts=(it.ref_id||"").split(":");
        const cid=parts[0], sid=parts[1];
        if(!porCat[cid])porCat[cid]={cid,items:[]};
        if(sid!=="__total__")porCat[cid].items.push(it);
        else porCat[cid].total=it.qtd;
      } else livres.push(it);
    });

    const catLinhas=Object.values(porCat).map(function(c){
      const nm=c.cid.split("-").map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(" ");
      // toTitleCase: converte CAPS para Caixa Mista preservando textos ja corretos
      var toTC=function(s){return s?s.toLowerCase().replace(/(?:^|\s)\S/g,function(a){return a.toUpperCase();}):s;};
      if(c.items&&c.items.length){
        return c.items.map(function(it){
          const parts2=(it.ref_id||"").split(":");
          const p=Number(it.preco_unit||0)||(saborPM[parts2[1]]||0);
          return "<tr><td class=\"td-n\">"+toTC(it.descricao)+"</td><td class=\"td-q\">"+it.qtd+"&nbsp;doces</td><td class=\"td-v\">"+R(it.qtd*p)+"</td></tr>";
        }).join("");
      } else if(c.total){
        const ref=catPM[c.cid]||0;
        return "<tr><td class=\"td-n\">"+nm+"</td><td class=\"td-q\">"+c.total+"&nbsp;doces</td><td class=\"td-v\">"+(ref>0?R(c.total*ref):"&mdash;")+"</td></tr>";
      }
      return "";
    }).join("");

    const livreLinhas=livres.map(function(it){
      var toTC=function(s){return s?s.toLowerCase().replace(/(?:^|\s)\S/g,function(a){return a.toUpperCase();}):s;};
      return "<tr><td class=\"td-n\">"+toTC(it.descricao)+"</td><td class=\"td-q\"></td><td class=\"td-v\">"+R(it.preco_unit)+"</td></tr>";
    }).join("");

    const descLinha=desc>0?"<tr class=\"tr-d\"><td colspan=\"2\">Desconto</td><td>&minus;&nbsp;"+R(desc)+"</td></tr>":"";
    const introTexto=(s.texto_publico||"").trim()||meta.intro;

    const ctaMsg=encodeURIComponent(
      "Ol\u00e1, Oba Doceria! Gostei do Cen\u00e1rio "+(si+1)+" \u2013 "+meta.rotulo+
      ". E agora, quais os pr\u00f3ximos passos?"
    );
    const ctaHref=obaWpp?"https://wa.me/55"+obaWpp+"?text="+ctaMsg:"";

    return {s:s,si:si,pal:pal,meta:meta,total:total,totalDoces:totalDoces,
            desc:desc,catLinhas:catLinhas,livreLinhas:livreLinhas,
            descLinha:descLinha,introTexto:introTexto,ctaHref:ctaHref};
  });

  // PG1 — Cards compactos de resumo
  const resumoCards = cenariosData.map(function(d){
    const s=d.s,si=d.si,pal=d.pal,meta=d.meta,total=d.total,totalDoces=d.totalDoces;
    const pills =
      (s.doces_por_convidado?"<span class=\"rc-pill\">"+s.doces_por_convidado+" doces/pessoa</span>":"")+
      (totalDoces?"<span class=\"rc-pill\">"+totalDoces+" doces</span>":"");
    return (
      "<div class=\"rc\" style=\"border-left-color:"+pal.acento+"\">"+
        "<div class=\"rc-linha\">"+
          "<div class=\"rc-esq\">"+
            "<span class=\"rc-num\" style=\"color:"+pal.acento+"\">"+(si+1)+"</span>"+
            "<div>"+
              "<span class=\"rc-badge\">"+meta.rotulo+"</span>"+
              "<div class=\"rc-pills\">"+pills+"</div>"+
            "</div>"+
          "</div>"+
          "<div class=\"rc-dir\">"+
            "<span class=\"rc-valor\" style=\"color:"+pal.acento+"\">"+R(total)+"</span>"+
            "<button class=\"rc-cta\" style=\"background:"+pal.acento+"\" onclick=\"obaShowPage("+(si+2)+")\">Ver detalhes &rarr;</button>"+
          "</div>"+
        "</div>"+
      "</div>"
    );
  }).join("\n");

  // PG2/3/4 — Detalhe por cenario
  const detalhePages = cenariosData.map(function(d){
    const s=d.s,si=d.si,pal=d.pal,meta=d.meta,total=d.total;
    const catLinhas=d.catLinhas,livreLinhas=d.livreLinhas,descLinha=d.descLinha;
    const introTexto=d.introTexto,ctaHref=d.ctaHref;

    const navBtns = cenariosData
      .filter(function(x){return x.si!==si;})
      .map(function(x){
        return "<button class=\"nav-outro\" style=\"color:"+x.pal.acento+";border-color:"+x.pal.acento+"60\" onclick=\"obaShowPage("+(x.si+2)+")\">Cen\u00e1rio "+(x.si+1)+" \u2013 "+x.meta.rotulo+"</button>";
      }).join("");

    const ctaBtnHtml = ctaHref
      ? "<a href=\""+ctaHref+"\" target=\"_blank\" class=\"cta-btn\" style=\"background:"+pal.acento+"\">Escolhi este cen\u00e1rio \u2014 vamos conversar</a>"
      : "";

    return (
      "<div id=\"pg"+(si+2)+"\" class=\"det-page\" style=\"display:none\">"+
        "<div class=\"det-topbar\">"+
          "<button class=\"det-voltar\" onclick=\"obaShowPage(1)\">&#8592; Todos os cen\u00e1rios</button>"+
          "<div class=\"det-navbtns\">"+navBtns+"</div>"+
        "</div>"+
        "<div class=\"c-card\" style=\"border-top-color:"+pal.topo+";background:"+pal.fundo+"\">"+
          "<div class=\"c-cabecalho\">"+
            "<div class=\"c-esq\">"+
              "<span class=\"c-rotulo\" style=\"color:"+pal.acento+"\">Cen\u00e1rio "+(si+1)+" &ensp;&middot;&ensp; "+meta.rotulo+"</span>"+
              "<h2 class=\"c-nome\">"+(s.nome||("Cen\u00e1rio "+(si+1)))+"</h2>"+
            "</div>"+
            "<div class=\"c-dir\">"+
              (s.doces_por_convidado?"<span class=\"c-dpc\">"+s.doces_por_convidado+" doces/pessoa</span>":"")+
              "<span class=\"c-total\" style=\"color:"+pal.acento+"\">"+R(total)+"</span>"+
            "</div>"+
          "</div>"+
          "<div class=\"c-intro\"><p>"+introTexto+"</p></div>"+
          "<div class=\"c-corpo\">"+
            "<table class=\"tab\"><tbody>"+
              catLinhas+livreLinhas+descLinha+
              "<tr class=\"tr-tot\"><td colspan=\"2\">Total</td><td style=\"color:"+pal.acento+"\">"+R(total)+"</td></tr>"+
            "</tbody></table>"+
            ctaBtnHtml+
          "</div>"+
        "</div>"+
        "<div class=\"det-rodape-nav\">"+
          "<button class=\"det-voltar-rodape\" onclick=\"obaShowPage(1)\">&#8592; Todos os cen\u00e1rios</button>"+
          (navBtns?"<div class=\"det-navbtns-rodape\">"+navBtns+"</div>":"")+
        "</div>"+
      "</div>"
    );
  }).join("\n");

  // Bloco de info do evento (usado em pg0 e pg1)
  const infoEventoPg0 = (eventoComNome||dataEventoCurta||proposal.convidados) ? (
    "<div class=\"ab-evento\">"+
    (eventoComNome?"<div class=\"ab-ev-item\"><span class=\"ab-ev-label\">Evento</span><span class=\"ab-ev-val\">"+eventoComNome+"</span></div>":"")+
    (dataEventoCurta?"<div class=\"ab-ev-item\"><span class=\"ab-ev-label\">Data</span><span class=\"ab-ev-val\">"+dataEventoCurta+"</span></div>":"")+
    (proposal.convidados?"<div class=\"ab-ev-item\"><span class=\"ab-ev-label\">Convidados</span><span class=\"ab-ev-val\">"+proposal.convidados+"</span></div>":"")+
    "</div>"
  ) : "";

  const infoEventoPg1 = (proposal.tipo_evento||dataEvento||proposal.convidados) ? (
    "<div class=\"res-ev\">"+
    (proposal.tipo_evento?"<div class=\"res-ev-item\"><span class=\"res-ev-lbl\">Evento</span><span class=\"res-ev-val\">"+proposal.tipo_evento+"</span></div>":"")+
    (dataEvento?"<div class=\"res-ev-item\"><span class=\"res-ev-lbl\">Data</span><span class=\"res-ev-val\">"+dataEventoCurta+"</span></div>":"")+
    (proposal.convidados?"<div class=\"res-ev-item\"><span class=\"res-ev-lbl\">Convidados</span><span class=\"res-ev-val\">"+proposal.convidados+"</span></div>":"")+
    "</div>"
  ) : "";

  // Citacao so aparece quando o texto e automatico (resumo ja foi usado como texto principal)
  const citacaoHtml = "";

  const validadeHtml = validade
    ? "<p>Proposta v&aacute;lida at&eacute; <strong style=\"color:#5D3A1A\">"+validade+"</strong></p>"
    : "";

  const wppHtml = obaWpp
    ? "<p>D&uacute;vidas? <a href=\"https://wa.me/55"+obaWpp+"\">fale pelo WhatsApp</a></p>"
    : "";

  const resSub = nomeCliente
    ? "Para <strong>"+nomeCliente+"</strong>"+(dataEvento?" &middot; "+dataEvento:"")
    : (dataEvento?dataEvento:"");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Proposta ${nomeCliente ? "para "+nomeCliente : ""} &middot; Oba Doceria</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,300;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#F7F2EC;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#3B2A1E;line-height:1.5}
.page{max-width:600px;margin:0 auto;padding:0 16px}

/* PG0 — ABERTURA */
#pg0{min-height:100svh;display:flex;flex-direction:column;background:linear-gradient(160deg,#FFF8EE 0%,#FDF0D8 55%,#F9E4BE 100%)}
.ab-topo{padding:36px 24px 0;text-align:center}
.ab-logo{height:38px;object-fit:contain;opacity:.85;margin-bottom:10px}
.ab-label{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C8922A;margin-bottom:16px;display:block}
/* Bloco evento: caixinha discreta sem backdrop */
.ab-evento{display:flex;justify-content:center;background:#FFFCF5;border:1px solid #EDD9C0;border-radius:10px;overflow:hidden;margin:0 auto;max-width:320px}
.ab-ev-item{flex:1;text-align:center;padding:9px 8px;border-right:1px solid #EDD9C0}
.ab-ev-item:last-child{border-right:none}
.ab-ev-label{font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C8922A;display:block;margin-bottom:2px}
.ab-ev-val{font-size:11px;font-weight:500;color:#5D3A1A;display:block}
.ab-sep{border:none;border-top:1px solid #EDD9C0;margin:20px auto 0;width:36px}
/* Texto: destaque centrado, corpo alinhado à esquerda */
.ab-corpo{padding:24px 28px 0;flex:1}
.ab-p-destaque{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(20px,5.5vw,25px);font-weight:600;color:#3B2A1E;line-height:1.45;margin-bottom:20px;font-style:italic;text-align:center}
.ab-p{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(14px,3.8vw,16px);color:#6B4A2A;line-height:1.85;margin-bottom:14px;text-align:left}
.ab-p:last-of-type{margin-bottom:0}
.ab-p strong{font-weight:600;color:#3B2A1E}
.ab-citacao{margin-top:18px;padding:14px 16px;border-left:2px solid #C8922A;background:#FFFCF4;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-style:italic;color:#9B6A3A;line-height:1.7;text-align:left}
.ab-rodape{padding:24px 24px 40px;text-align:center}
.ab-ornamento{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#C8922A;opacity:.4;letter-spacing:10px;margin-bottom:14px;display:block}
.ab-assinatura{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-style:italic;color:#C8922A;margin-bottom:24px;display:block}
.ab-btn{display:inline-block;background:#3B2A1E;color:#F9E8C8;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:.8px;padding:14px 36px;border-radius:50px;border:none;cursor:pointer;text-transform:uppercase}
.ab-btn:hover{opacity:.85}

/* PG1 — RESUMO */
.ab-p-encerramento{font-style:italic;color:#9B6A3A}
#pg1{display:none}.res-hero{padding:20px 20px 14px;text-align:center;background:#FFFDF8;border-bottom:1px solid #EDD9C0}
.res-logo{height:28px;object-fit:contain;opacity:.82;margin-bottom:10px}
.res-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:19px;font-weight:400;color:#3B2A1E;margin-bottom:2px}
.res-sub{font-size:10px;color:#9B7A60}
.res-sub strong{color:#5D3A1A;font-weight:600}
.res-ev{display:flex;justify-content:center;border-bottom:1px solid #EDD9C0;background:#FFFDF8}
.res-ev-item{flex:1;text-align:center;padding:8px 10px;border-right:1px solid #EDD9C0}
.res-ev-item:last-child{border-right:none}
.res-ev-lbl{font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ccc;display:block}
.res-ev-val{font-size:11px;font-weight:600;color:#3B2A1E;display:block}
.res-secao{padding:36px 16px 10px;font-size:11px;font-weight:400;color:#9B7A60;text-align:center;font-style:italic}
/* Cards de cenario — mais delicados */
.rc{margin:0 16px 8px;border-radius:10px;border:1px solid #EDD9C0;border-left-width:2px;background:#fff;padding:10px 14px;box-shadow:none}
.rc-linha{display:flex;align-items:center;gap:10px;justify-content:space-between}
.rc-esq{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.rc-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:400;line-height:1;flex-shrink:0;opacity:.3;font-style:italic}
.rc-badge{display:block;font-size:13px;font-weight:500;color:#3B2A1E;margin-bottom:2px}
.rc-pills{display:flex;flex-wrap:wrap;gap:3px}
.rc-pill{font-size:9px;font-weight:400;background:#FAF5EE;color:#9B7A60;padding:1px 6px;border-radius:20px}
.rc-dir{text-align:right;flex-shrink:0}
.rc-valor{display:block;font-size:14px;font-weight:500;line-height:1;margin-bottom:6px}
.rc-cta{display:block;padding:5px 11px;border-radius:20px;border:none;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:500;cursor:pointer;white-space:nowrap;opacity:.85}
.rc-cta:hover{opacity:1}
.res-footer-nav{padding:10px 16px 0;text-align:center}
.res-voltar-ab{background:none;border:none;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;color:#bbb;cursor:pointer;text-decoration:underline;text-underline-offset:3px}

/* DETALHE */
.det-page{padding-top:24px;padding-bottom:8px}
.det-topbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 14px;background:#fff;border-bottom:1px solid #EDD9C0;position:sticky;top:0;z-index:10}
.det-voltar{background:none;border:1.5px solid #EDD9C0;border-radius:24px;padding:5px 13px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;color:#7A5A40;cursor:pointer;white-space:nowrap}
.det-voltar:hover{background:#FAF5EE}
.det-navbtns{display:flex;gap:5px;flex-wrap:wrap}
.nav-outro{background:none;border:1.5px solid;border-radius:24px;padding:4px 11px;font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap}
.nav-outro:hover{opacity:.75}
.c-card{margin:10px auto 0;max-width:480px;border-radius:14px;border:1px solid #EDD9C0;border-top-width:3px;overflow:hidden;background:#fff;box-shadow:0 1px 8px rgba(60,35,20,.05)}
.c-cabecalho{padding:18px 20px 13px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.c-esq{flex:1;min-width:0}
.c-rotulo{font-size:9px;font-weight:500;letter-spacing:.5px;display:block;margin-bottom:3px;opacity:.7}
.c-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:400;color:#3B2A1E;line-height:1.2}
.c-dir{text-align:right;flex-shrink:0}
.c-dpc{display:block;font-size:10px;color:#ccc;margin-bottom:3px}
.c-total{font-size:18px;font-weight:600;display:block;line-height:1}
.c-intro{padding:0 20px 13px;border-bottom:1px solid #F0E8DE}
.c-intro p{font-size:12px;color:#7A5A40;line-height:1.65;font-style:italic}
.c-corpo{padding:13px 20px 18px}
.tab{width:100%;border-collapse:collapse}
.tab td{padding:7px 0;border-bottom:1px solid #F5EDE4;font-size:12px;vertical-align:middle}
.td-n{color:#3B2A1E;font-weight:400}
.td-q{text-align:center;color:#ccc;font-size:11px;padding:7px 8px;white-space:nowrap}
.td-v{text-align:right;font-weight:500;color:#5D3A1A;white-space:nowrap}
.tr-d td{border-bottom:none;padding:7px 0 0;font-size:11px;color:#059669}
.tr-d td:last-child{text-align:right}
.tr-tot td{border:none;padding:12px 0 0;font-size:13px;font-weight:600;border-top:1px solid #EDD9C0}
.tr-tot td:last-child{text-align:right;font-size:17px;font-weight:700}
.cta-btn{display:block;margin:14px 0 0;padding:12px;border-radius:11px;text-align:center;color:#fff;font-weight:500;font-size:12px;text-decoration:none;letter-spacing:.3px;opacity:.9}
.cta-btn:hover{opacity:1}
.det-rodape-nav{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 14px;margin-top:4px}
.det-voltar-rodape{background:none;border:1.5px solid #EDD9C0;border-radius:24px;padding:5px 13px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;color:#7A5A40;cursor:pointer}
.det-voltar-rodape:hover{background:#FAF5EE}
.det-navbtns-rodape{display:flex;gap:5px;flex-wrap:wrap}

/* FOOTER */
.footer{margin:20px 16px 0;text-align:center;padding:18px 0 28px;border-top:1px solid #EDD9C0}
.footer p{font-size:11px;color:#bbb;margin-bottom:4px}
.footer a{color:#8B4513;font-weight:500;text-decoration:none}
.footer-brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;font-style:italic;color:#bbb;margin-top:6px}
.btn-pdf{margin-top:14px;background:#3B2A1E;color:#fff;border:none;border-radius:11px;padding:10px 26px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer}

/* PRINT */
@page{margin:14mm 18mm}
@media print{
  body{background:#fff}
  /* Pagina 1: capa + resumo */
  #pg0{display:block!important;min-height:0!important;background:none!important}
  .ab-btn,.ab-ornamento,.ab-assinatura,.ab-citacao{display:none!important}
  .ab-rodape{padding:4px 0 8px}
  #pg1{display:block!important}
  #pg1::before{content:"";display:block;border-top:1px solid #EDD9C0;margin:14px 0}
  .res-voltar-ab,.res-footer-nav,.rc-cta{display:none!important}
  /* Cenarios: nova pagina com padding-top para centralizar visualmente */
  .det-page{display:block!important;page-break-before:always;padding-top:55mm}
  .det-topbar,.det-rodape-nav,.cta-btn,.btn-pdf{display:none!important}
  .page{max-width:100%;padding:0}
  /* Card ocupa largura disponivel — margens do @page ja enquadram */
  .c-card{margin:0 auto;max-width:100%;box-shadow:none;border-color:#ddd;page-break-inside:avoid}
  .rc{margin:0 0 8px;page-break-inside:avoid}
  .footer{border-top:1px solid #EDD9C0;padding:10px 0 0;margin-top:14px}
  #print-hint{display:block!important}
}
#print-hint{display:none;font-size:9px;color:#bbb;text-align:center;padding:4px 0 0;font-family:'Plus Jakarta Sans',sans-serif}
</style>
</head>
<body>
<div class="page">

<div id="pg0">
  <div class="ab-topo">
    <img class="ab-logo" src="https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png" alt="Oba Doceria" onerror="this.style.display='none'">
    <span class="ab-label">Proposta de Or&ccedil;amento</span>
    ${infoEventoPg0}
    <hr class="ab-sep">
  </div>
  <div class="ab-corpo">
    ${paraA ? `<p class="ab-p-destaque">${paraA}</p>` : ""}
    ${paraB ? `<p class="ab-p">${paraB}</p>` : ""}
    ${paraC ? `<p class="ab-p">${paraC}</p>` : ""}
    ${paraD ? `<p class="ab-p ab-p-encerramento">${paraD}</p>` : ""}
    ${citacaoHtml}
  </div>
  <div class="ab-rodape">
    <span class="ab-ornamento">&middot;&ensp;&middot;&ensp;&middot;</span>
    <span class="ab-assinatura">Feito com cuidado. Servido com amor.</span>
    <button class="ab-btn" onclick="obaShowPage(1)">Ver minha proposta &rarr;</button>
  </div>
</div>

<div id="pg1" style="display:none">
  <div class="res-hero">
    <img class="res-logo" src="https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png" alt="Oba Doceria" onerror="this.style.display='none'">
    <p class="res-titulo">Cen&aacute;rios preparados para voc&ecirc;</p>
  </div>
  ${infoEventoPg1}
  <p class="res-secao">Escolha o seu cen&aacute;rio</p>  ${resumoCards}
  <div class="res-footer-nav">
    <button class="res-voltar-ab" onclick="obaShowPage(0)">&#8592; Voltar &agrave; apresenta&ccedil;&atilde;o</button>
  </div>
  <div class="footer">
    ${validadeHtml}
    ${wppHtml}
    <p class="footer-brand">Oba Doceria &middot; Um jeito doce de expressar felicidade</p>
    <button class="btn-pdf" onclick="window.print()">Salvar como PDF</button>
    <p id="print-hint">Dica: no di&aacute;logo de impress&atilde;o, desmarque &ldquo;Cabe&ccedil;alhos e rodap&eacute;s&rdquo; para o PDF mais limpo.</p>
  </div>
</div>

${detalhePages}

</div>
<script>
function obaShowPage(n){
  var ids=['pg0','pg1'];
  var total=${numCenarios};
  for(var i=2;i<=total+1;i++)ids.push('pg'+i);
  ids.forEach(function(id,idx){
    var el=document.getElementById(id);
    if(!el)return;
    if(idx===n){
      // pg0 usa flex; pg1 e detalhes usam block
      el.style.display=(idx===0)?'flex':'block';
    } else {
      el.style.display='none';
    }
  });
  window.scrollTo({top:0,behavior:'smooth'});
}
</script>
</body>
</html>`;

  return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}

// ============================================================
// PAGINA PUBLICA — TEMPLATE CORPORATIVO
// ============================================================
// ============================================================
// PAGINA PUBLICA — TEMPLATE CORPORATIVO (redesign 12B-rev2)
// Paleta: esmeralda escuro + cobre dourado
// ============================================================
// ============================================================
// PAGINA PUBLICA — CORPORATIVO (12B-rev3)
// Fundo creme claro. Tipografia editorial. Scroll único.
// Textos emocionais aprovados. Botão "← Início" em todas as pgs.
// ============================================================
// ============================================================
// PAGINA PUBLICA — CORPORATIVO (12B-rev4)
// Tipografia Cormorant unificada em pg0.
// Uma opção por página (pg2, pg3...) + índice em pg1.
// Layout @media print profissional — uma opção por página A4.
// ============================================================
// ============================================================
// PAGINA PUBLICA — CORPORATIVO (12B-rev5)
// Pg0: Plus Jakarta Sans para ambos os parágrafos.
//      Sem chips de briefing. Tudo em 1 tela.
// Pg1: header off-white+borda; nome empresa em Cormorant;
//      label curto "OPÇÕES"; rodapé separado com PDF outline.
// Pg2+: header off-white+borda.
// ============================================================
// ============================================================
// PAGINA PUBLICA — CORPORATIVO (12B-rev5c)
// 1. Logo real PNG centralizada, opacity:1, height:48px
// 2. Assinatura em Cormorant italico suave
// 3. Pg1: sem observacoes, validade+WhatsApp em 1 linha
// 4. Pg1: tipografia maior
// 5. Pg1: sem logo no header
// 6. Pg2+: conteudo centralizado apos a foto
// ============================================================
async function obaHandlePropostaCorporativo(proposal, obaWpp, env, propId) {
  const R = (v) => { const n=Number(v||0).toFixed(2),[i,d]=n.split("."); return "R$\u00a0"+i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+d; };
  const MESES=["janeiro","fevereiro","mar\u00e7o","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const fmtD =(d)=>{ if(!d)return null; try{const[y,m,dy]=d.split("-");return parseInt(dy)+" de "+MESES[parseInt(m)-1]+" de "+y;}catch{return d;} };

  const VERDE = "#2A5240";
  const BORDA = "#C8E0D0";
  const FUNDO = "#F5F8F5";
  const TXT   = "#1A2E22";
  const LOGO  = "https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png";

  const nomeEmpresa = (proposal.empresa||proposal.cliente||"").trim();
  const options     = (proposal.options&&proposal.options.length) ? proposal.options : [];
  const numOpts     = options.length;
  const validade    = fmtD(proposal.validade);
  const qtd         = proposal.qtd_solicitada;

  // ---- Textos pg0 ----
  let p1, p2;
  if (qtd && nomeEmpresa) {
    const qtdFmt = Number(qtd).toLocaleString("pt-BR");
    p1 = qtdFmt+" pessoas. "+qtdFmt+" hist\u00f3rias, rotinas, prefer\u00eancias \u2014 cada uma diferente. E num determinado dia, todas elas v\u00e3o receber algo que a sua empresa escolheu com cuidado. Esse detalhe diz muito sobre quem voc\u00eas s\u00e3o como organiza\u00e7\u00e3o.";
    p2 = "A Oba Doceria preparou esta proposta pensando nesse momento espec\u00edfico: no instante em que algu\u00e9m abre a caixa, sorri e pensa em voc\u00ea. Cada op\u00e7\u00e3o foi desenvolvida para que esse momento aconte\u00e7a da forma mais bonita poss\u00edvel \u2014 dentro do prazo, dentro do or\u00e7amento, e muito al\u00e9m do esperado.";
  } else if (proposal.abertura && proposal.abertura.trim()) {
    const partes = proposal.abertura.trim().split(/\n\n+/);
    p1 = partes[0]||""; p2 = partes[1]||"";
  } else {
    p1 = "Existe algo muito espec\u00edfico no gesto de presentear quem trabalhou junto com voc\u00ea o ano inteiro. N\u00e3o \u00e9 s\u00f3 um agrado \u2014 \u00e9 um reconhecimento. \u00c9 dizer, de um jeito concreto e bonito, que aquela pessoa importa, que o esfor\u00e7o dela foi visto, que h\u00e1 gratid\u00e3o real por tudo que foi constru\u00eddo em equipe.";
    p2 = "A Oba Doceria nasceu acreditando que cada caixa conta uma hist\u00f3ria. Por isso, antes de montar qualquer proposta, a gente pensa nas pessoas que v\u00e3o receb\u00ea-la \u2014 nos seus gostos, no momento que v\u00e3o viver ao abrir, na mem\u00f3ria que vai ficar. O que voc\u00ea vai encontrar aqui foi feito exatamente assim: com cuidado, com inten\u00e7\u00e3o e com muito carinho.";
  }

  // ---- Índice pg1 ----
  const indiceHtml = options.map(function(opt, oi){
    const faixas   = opt.faixas||[];
    const precoMin = faixas.length ? faixas.reduce((a,f)=>f.preco<a?f.preco:a, faixas[0].preco) : Number(opt.valor_unit||0);
    const precoLabel = precoMin>0
      ? R(precoMin)+(faixas.length?" <span class=\"idx-unit\">/ un. a partir</span>":" <span class=\"idx-unit\">/ un.</span>")
      : "<span style=\"color:#AAA\">sob consulta</span>";
    const imgSrc = (opt.medias&&opt.medias.length)
      ? "/api/proposals/"+propId+"/media/"+opt.medias[0].media_id+"/dados"
      : null;
    return (
      "<div class=\"idx-card\" onclick=\"obaShowPage("+(oi+2)+")\">"
      +(imgSrc
        ?"<img src=\""+imgSrc+"\" class=\"idx-img\" loading=\"lazy\" alt=\"\">"
        :"<div class=\"idx-img idx-empty\"></div>")
      +"<div class=\"idx-body\">"
      +  "<span class=\"idx-num\">Op\u00e7\u00e3o "+(oi+1)+"</span>"
      +  "<p class=\"idx-nome\">"+(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</p>"
      +  (opt.descricao?"<p class=\"idx-desc\">"+opt.descricao+"</p>":"")
      +  "<p class=\"idx-preco\">"+precoLabel+"</p>"
      +"</div>"
      +"<span class=\"idx-chevron\">&#10095;</span>"
      +"</div>"
    );
  }).join("\n");

  // ---- Páginas de detalhe ----
  const detalhePages = options.map(function(opt, oi){
    const faixas = opt.faixas||[];
    const imgs   = opt.medias||[];
    const prevOi = oi > 0 ? oi-1 : null;
    const nextOi = oi < numOpts-1 ? oi+1 : null;

    const heroHtml = imgs.length
      ? "<img src=\"/api/proposals/"+propId+"/media/"+imgs[0].media_id+"/dados\" class=\"det-hero\" loading=\"lazy\" alt=\""+(opt.nome||"")+"\">"
      : "";
    const galeriaExtra = imgs.length > 1
      ? "<div class=\"det-galeria\">"+imgs.slice(1).map(m=>"<img src=\"/api/proposals/"+propId+"/media/"+m.media_id+"/dados\" class=\"det-gal-img\" loading=\"lazy\" alt=\"\">").join("")+"</div>"
      : "";

    const tabelaFaixas = faixas.length
      ? "<div class=\"faixas-bloco\"><p class=\"faixas-titulo\">Faixas de quantidade</p><table class=\"faixas-tab\"><tbody>"
        +faixas.map(function(f){
          const lbl = f.de!=null&&f.ate!=null?"De "+f.de+" a "+f.ate+" un."
            :f.de!=null&&f.ate==null?"A partir de "+f.de+" un."
            :f.ate!=null?"At\u00e9 "+f.ate+" un.":"Demais";
          return "<tr><td class=\"ft-l\">"+lbl+"</td><td class=\"ft-p\">"+R(f.preco)+"<span class=\"ft-un\"> / un.</span></td></tr>";
        }).join("")
        +"</tbody></table></div>"
      : (Number(opt.valor_unit||0)>0
        ? "<div class=\"faixas-bloco\"><table class=\"faixas-tab\"><tbody><tr><td class=\"ft-l\">Pre\u00e7o por unidade</td><td class=\"ft-p\">"+R(opt.valor_unit)+"</td></tr></tbody></table></div>"
        : "");

    const ctaMsg  = encodeURIComponent("Ol\u00e1, Oba Doceria! Analisei a proposta para "+nomeEmpresa+" e gostei da op\u00e7\u00e3o \u201c"+(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"\u201d. Quero conversar sobre os pr\u00f3ximos passos.");
    const ctaHref = obaWpp ? "https://wa.me/55"+obaWpp+"?text="+ctaMsg : "";
    const ctaBtn  = ctaHref ? "<a href=\""+ctaHref+"\" target=\"_blank\" class=\"cta-btn\">Quero esta op\u00e7\u00e3o \u2014 vamos conversar</a>" : "";

    const navPrev = prevOi!==null
      ? "<button class=\"nav-btn\" onclick=\"obaShowPage("+(prevOi+2)+")\">&#8592; "+(options[prevOi].nome||("Op\u00e7\u00e3o "+(prevOi+1)))+"</button>"
      : "<span></span>";
    const navNext = nextOi!==null
      ? "<button class=\"nav-btn nav-right\" onclick=\"obaShowPage("+(nextOi+2)+")\">"+( options[nextOi].nome||("Op\u00e7\u00e3o "+(nextOi+1)))+" &#8594;</button>"
      : "<span></span>";

    return (
      "<div id=\"pg"+(oi+2)+"\" class=\"det-page\" style=\"display:none\">"
      // header off-white, sem logo (ponto 5), só botão + contador
      +"<header class=\"det-header\">"
      +"  <button class=\"det-back\" onclick=\"obaShowPage(1)\">&#8592; Todas as op\u00e7\u00f5es</button>"
      +"  <span class=\"det-counter\">"+(oi+1)+" de "+numOpts+"</span>"
      +"</header>"
      // foto hero
      +heroHtml
      +galeriaExtra
      // conteúdo centralizado (ponto 6)
      +"<div class=\"det-corpo\">"
      +  "<span class=\"det-num\">Op\u00e7\u00e3o "+(oi+1)+"</span>"
      +  "<h2 class=\"det-nome\">"+(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</h2>"
      +  (opt.descricao?"<p class=\"det-desc\">"+opt.descricao+"</p>":"")
      +  tabelaFaixas
      +  ctaBtn
      +"</div>"
      +"<div class=\"det-nav\">"+navPrev+navNext+"</div>"
      +"</div>"
    );
  }).join("\n");

  // ---- Rodapé pg1 — sem obs, validade+WhatsApp em 1 linha (ponto 3) ----
  const corpValidadeHtml = validade ? "V\u00e1lida at\u00e9 <strong>"+validade+"</strong>" : "";
  const corpWppHtml      = obaWpp   ? "<a href=\"https://wa.me/55"+obaWpp+"\" class=\"rod-wpp\">D\u00favidas? WhatsApp</a>" : "";
  const rodMetaHtml = (corpValidadeHtml||corpWppHtml)
    ? "<p class=\"rod-meta\">"+(corpValidadeHtml+(corpValidadeHtml&&corpWppHtml?" &middot; ":"")+corpWppHtml)+"</p>"
    : "";
  const obsHtml = "";  // removido de pg1 (ponto 3)

  // ---- CSS ----
  const css = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{scroll-behavior:smooth}
body{background:${FUNDO};font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:${TXT};line-height:1.6}
.wrap{max-width:620px;margin:0 auto;background:${FUNDO}}

/* ===================== PG0 ===================== */
#pg0{min-height:100svh;display:flex;flex-direction:column;background:#F5F8F5}
.pg0-inner{padding:32px 28px 0;flex:1;display:flex;flex-direction:column;justify-content:center}
/* Logo real centralizada — ponto 1 */
.pg0-logo{height:64px;object-fit:contain;opacity:1;display:block;margin:0 auto 24px}
.pg0-eyebrow{font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${VERDE};opacity:.6;margin-bottom:8px;display:block;text-align:center}
.pg0-empresa{font-size:clamp(22px,5.8vw,28px);font-weight:700;color:${TXT};line-height:1.2;margin-bottom:20px;text-align:center}
.pg0-sep{border:none;border-top:1px solid ${BORDA};width:40px;margin:0 auto 20px}
.pg0-p{font-size:13px;font-weight:400;color:#3D5A48;line-height:1.7;margin-bottom:12px}
.pg0-p:last-of-type{margin-bottom:0}
.pg0-foot{padding:24px 28px 36px;border-top:1px solid ${BORDA};margin-top:24px}
/* Assinatura Cormorant italic suave — ponto 2 */
.pg0-sign{
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:14px;font-style:italic;font-weight:400;
  color:${VERDE};opacity:.5;
  display:block;text-align:center;margin-bottom:18px
}
.pg0-btn{display:block;width:100%;background:${VERDE};color:#F5F8F5;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:.8px;padding:16px;border-radius:12px;border:none;cursor:pointer;text-align:center;text-transform:uppercase}

/* ===================== PG1 ===================== */
#pg1{display:none;background:${FUNDO};min-height:100svh;display:flex;flex-direction:column;padding-top:10vh}}
.pg1-hdr{background:#fff;border-bottom:1px solid ${BORDA};padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.btn-inicio{background:none;border:1.5px solid ${BORDA};border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;color:${VERDE};cursor:pointer}
/* Sem logo no header pg1 — ponto 5: espaço reservado para balancear visualmente */
.pg1-hdr-spacer{width:80px}
/* tipografia maior — ponto 4 */
.pg1-intro{padding:24px 24px 6px}
.pg1-empresa{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(26px,6.5vw,34px);font-weight:600;color:${TXT};line-height:1.15;margin-bottom:7px}
.pg1-sub{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:400;font-style:italic;color:#7A9A88}
.pg1-secao{padding:18px 24px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${VERDE};opacity:.55}
/* cards maiores */
.idx-card{display:flex;align-items:center;gap:13px;margin:0 16px 9px;padding:13px;background:#fff;border-radius:12px;border:1px solid ${BORDA};cursor:pointer;transition:box-shadow .15s}
.idx-card:hover,.idx-card:active{box-shadow:0 2px 14px rgba(42,82,64,.13)}
.idx-img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid ${BORDA};flex-shrink:0}
.idx-empty{background:#EDF3EF}
.idx-body{flex:1;min-width:0}
.idx-num{font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${VERDE};opacity:.6;display:block;margin-bottom:3px}
.idx-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:600;color:${TXT};line-height:1.2;margin-bottom:3px}
.idx-desc{font-size:11px;color:#9AB0A0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
.idx-preco{font-size:13px;font-weight:600;color:${VERDE}}
.idx-unit{font-size:10px;font-weight:400;color:#9AB0A0}
.idx-chevron{font-size:14px;color:${BORDA};flex-shrink:0}
.pg1-opcoes-wrap{flex:1}
/* rodapé pg1 simplificado — ponto 3 */
..pg1-sep{border:none;border-top:1px solid ${BORDA};margin-top:auto;margin-left:24px;margin-right:24px;padding-top:0};margin:20px 24px 0}
.pg1-rod{padding:12px 24px 32px}
.rod-meta{font-size:11px;color:#A0BAA8;margin-bottom:10px}
.rod-meta strong{color:#5A7A62}
.rod-wpp{color:${VERDE};font-weight:600;text-decoration:none}
.rod-brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;font-style:italic;font-weight:400;color:${VERDE};opacity:.5;display:block;text-align:center;margin-bottom:16px}
.btn-pdf{display:block;width:100%;background:${VERDE};color:#F5F8F5;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:.8px;padding:16px;border-radius:12px;border:none;cursor:pointer;text-align:center;text-transform:uppercase}

/* ===================== DETALHE ===================== */
.det-page{background:${FUNDO};display:flex;flex-direction:column;min-height:100svh;padding-top:14vh};display:flex;flex-direction:column;min-height:100svh}
.det-header{background:#fff;border-bottom:1px solid ${BORDA};padding:10px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.det-back{background:none;border:1.5px solid ${BORDA};border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;color:${VERDE};cursor:pointer}
.det-counter{font-size:11px;color:#9AB0A0;font-weight:500}
.det-hero{width:100%;max-height:340px;object-fit:cover;display:block}
.det-galeria{display:flex;gap:6px;padding:8px 20px 0}
.det-gal-img{width:calc(33.33% - 4px);aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid ${BORDA}}
/* conteúdo centralizado — ponto 6 */
.det-corpo{padding:24px 28px 28px;text-align:left}
.det-num{font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${VERDE};opacity:.6;display:block;margin-bottom:8px}
.det-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:600;color:${TXT};line-height:1.2;margin-bottom:8px}
.det-desc{font-size:13px;color:#7A9A84;font-style:italic;margin-bottom:20px;line-height:1.5}
.faixas-bloco{margin-bottom:22px;text-align:left}
.faixas-titulo{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${VERDE};opacity:.6;margin-bottom:10px}
.faixas-tab{width:100%;border-collapse:collapse}
.faixas-tab td{padding:9px 0;border-bottom:1px solid #E8F0EA;font-size:13px}
.ft-l{color:#3D5A48}
.ft-p{text-align:right;font-weight:600;color:${TXT}}
.ft-un{font-size:10px;font-weight:400;color:#9AB0A0}
.cta-btn{display:block;padding:15px;border-radius:12px;text-align:center;background:${VERDE};color:#fff;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:.3px}
.det-nav{display:flex;justify-content:space-between;align-items:center;padding:12px 20px 32px;gap:10px}
.nav-btn{background:none;border:1.5px solid ${BORDA};border-radius:20px;padding:7px 14px;font-size:11px;font-weight:600;color:${VERDE};cursor:pointer;white-space:nowrap;max-width:46%;overflow:hidden;text-overflow:ellipsis}
.nav-right{margin-left:auto;text-align:right}

/* ===================== PRINT ===================== */
@page{size:A4 portrait;margin:16mm 20mm}
@media print{
  .pg0-btn,.pg0-sign,
  .pg1-hdr,.btn-inicio,
  .det-header,.det-nav,.cta-btn,.btn-pdf,
  .pg1-secao,.pg1-rod,.pg1-sep,
  #pg1{display:none!important}
  body{background:#fff;font-size:11pt}
  .wrap{max-width:100%;margin:0;background:#fff}
  #pg0{display:block!important;min-height:0!important;background:#fff!important;page-break-after:always}
  .pg0-inner{padding:0;justify-content:flex-start;display:block}
  .pg0-logo{height:36px;margin:0 auto 16pt;opacity:1;display:block}
  .pg0-eyebrow{font-size:7pt;margin-bottom:5pt;opacity:1;color:${VERDE}}
  .pg0-empresa{font-size:16pt;color:#1A1A1A;margin-bottom:12pt}
  .pg0-sep{display:block;margin:0 auto 12pt;border-top:1px solid #DDD;width:40px}
  .pg0-p{font-size:11pt;color:#3D3D3D;margin-bottom:8pt;line-height:1.7}
  .pg0-foot{display:block!important;border-top:1px solid #DDD;padding:10pt 0 0;margin-top:14pt}
  .det-page{display:block!important;min-height:0!important;background:#fff!important;page-break-before:always}
  .det-hero{width:100%;max-height:190pt;object-fit:cover;border:1px solid #EEE;border-radius:3pt;display:block;margin-bottom:10pt}
  .det-galeria{display:flex;gap:5pt;margin-bottom:10pt}
  .det-gal-img{width:calc(33.33% - 4pt);aspect-ratio:1;object-fit:cover;border-radius:3pt;border:1px solid #EEE}
  .det-corpo{padding:0;text-align:left}
  .det-num{font-size:7pt;color:${VERDE};opacity:1;margin-bottom:4pt}
  .det-nome{font-size:18pt;color:#1A1A1A;margin-bottom:4pt}
  .det-desc{font-size:10pt;color:#666;margin-bottom:10pt}
  .faixas-titulo{font-size:7pt;color:${VERDE};opacity:1}
  .faixas-tab td{padding:5pt 0;border-bottom:1px solid #EEE;font-size:10pt}
  .ft-p{color:#1A1A1A}
}`;

  const html = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n"
    +"<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
    +"<meta name=\"robots\" content=\"noindex,nofollow\">\n"
    +"<title>Proposta para "+nomeEmpresa+" \u00b7 Oba Doceria</title>\n"
    +"<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
    +"<link href=\"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">\n"
    +"<style>"+css+"</style>\n</head>\n<body>\n<div class=\"wrap\">\n\n"

    // PG0 — logo real, sem chips, parágrafos uniformes
    +"<div id=\"pg0\">\n"
    +"  <div class=\"pg0-inner\">\n"
    +"    <img class=\"pg0-logo\" src=\""+LOGO+"\" alt=\"Oba Doceria\" onerror=\"this.style.display='none'\">\n"
    +"    <span class=\"pg0-eyebrow\">Proposta Exclusiva</span>\n"
    +(nomeEmpresa?"    <h1 class=\"pg0-empresa\">"+nomeEmpresa+"</h1>\n":"")
    +"    <hr class=\"pg0-sep\">\n"
    +"    <p class=\"pg0-p\">"+p1+"</p>\n"
    +"    <p class=\"pg0-p\">"+p2+"</p>\n"
    +"  </div>\n"
    +"  <div class=\"pg0-foot\">\n"
    // assinatura Cormorant italic suave
    +"    <span class=\"pg0-sign\">Feito com cuidado. Servido com amor.</span>\n"
    +"    <button class=\"pg0-btn\" onclick=\"obaShowPage(1)\">Ver o que preparamos &rarr;</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    // PG1 — sem logo no header, tipografia maior
    +"<div id=\"pg1\">\n"
    +"  <div class=\"pg1-hdr\">\n"
    +"    <button class=\"btn-inicio\" onclick=\"obaShowPage(0)\">\u2190 In\u00edcio</button>\n"
    +"    <span class=\"pg1-hdr-spacer\"></span>\n"
    +"  </div>\n"
    +"  <div class=\"pg1-intro\">\n"
    +(nomeEmpresa
      ?"    <h1 class=\"pg1-empresa\">"+nomeEmpresa+"</h1>\n"
      :"    <h1 class=\"pg1-empresa\">Nossa proposta</h1>\n")
    +(numOpts
      ?"    <p class=\"pg1-sub\">"+(numOpts===1?"Uma op\u00e7\u00e3o elaborada":numOpts+" op\u00e7\u00f5es elaboradas")+" com muito cuidado para voc\u00ea</p>\n"
      :"")
    +"  </div>\n"
    +"  <p class=\"pg1-secao\">Op\u00e7\u00f5es</p>\n"
    +(indiceHtml||"  <p style=\"text-align:center;color:#9AB0A0;padding:32px;font-size:13px\">Nenhuma op\u00e7\u00e3o cadastrada.</p>")
    // rodapé: só validade + WhatsApp numa linha, sem observações
    +"\n  <hr class=\"pg1-sep\">\n"
    +"  <div class=\"pg1-rod\">\n"
    + rodMetaHtml
    +"    <span class=\"rod-brand\">Oba Doceria \u00b7 Um jeito doce de expressar felicidade</span>\n"
    +"    <button class=\"btn-pdf\" onclick=\"window.print()\">Salvar como PDF</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    + detalhePages

    +"\n</div>\n<script>\n"
    +"function obaShowPage(n){\n"
    +"  var pg0=document.getElementById('pg0');\n"
    +"  var pg1=document.getElementById('pg1');\n"
    +"  var pages=[pg0,pg1];\n"
    +"  for(var i=2;i<="+(numOpts+1)+";i++){ var el=document.getElementById('pg'+i); if(el) pages.push(el); }\n"
    +"  pages.forEach(function(el,idx){\n"
    +"    if(!el) return;\n"
    +"    el.style.display=(idx===n)?((idx===0)?'flex':'block'):'none';\n"
    +"  });\n"
    +"  window.scrollTo({top:0,behavior:'smooth'});\n"
    +"}\n"
    +"<\/script>\n</body>\n</html>";

  return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}

async function obaHandlePropostaSazonal(proposal, obaWpp, env, propId) {
  const R = (v) => { const n=Number(v||0).toFixed(2),[i,d]=n.split("."); return "R$\u00a0"+i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+d; };
  const toTC = (s) => s ? s.toLowerCase().replace(/(?:^|\s)\S/g,a=>a.toUpperCase()) : s;
  const MESES=["janeiro","fevereiro","mar\u00e7o","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const fmtD=(d)=>{ if(!d)return null; try{const[y,m,dy]=d.split("-");return parseInt(dy)+" de "+MESES[parseInt(m)-1]+" de "+y;}catch{return d;} };

  const dataCom     = (proposal.data_comemorativa||"").trim();
  const nomeEmpresa = (proposal.empresa||"").trim();
  const options     = (proposal.options&&proposal.options.length) ? proposal.options : [];
  const numOpts     = options.length;
  const validade    = fmtD(proposal.validade);

  // ---- Paletas temáticas — fundo claro ----
  const TEMAS = {
    "Natal":             { fundo:"#FDF5EC", acento:"#8B1A2F", acentoBtn:"#A02035", borda:"#F0D8B0", verde:"#6B1A2F" },
    "P\u00e1scoa":       { fundo:"#F8F5FF", acento:"#5B3D8A", acentoBtn:"#7055AA", borda:"#D8C8F0", verde:"#5B3D8A" },
    "Dia das M\u00e3es": { fundo:"#FFF5F8", acento:"#8B2A4A", acentoBtn:"#A84060", borda:"#F0C8D8", verde:"#8B2A4A" },
    "Dia dos Pais":      { fundo:"#F3F7FF", acento:"#1A3860", acentoBtn:"#2A5080", borda:"#B8CCE8", verde:"#1A3860" },
    "Dia dos Namorados": { fundo:"#FFF3F5", acento:"#7A1C30", acentoBtn:"#9A2A40", borda:"#F0C0C8", verde:"#7A1C30" },
    "Dia das Crian\u00e7as":{ fundo:"#FFFBF0", acento:"#8B3A10", acentoBtn:"#B05020", borda:"#F0D8A0", verde:"#8B3A10" },
  };
  const T = TEMAS[dataCom] || { fundo:"#FAF8F4", acento:"#5D3A1A", acentoBtn:"#7A5030", borda:"#E8D8C0", verde:"#5D3A1A" };

  // ---- Textos de abertura ----
  let p1, p2;
  if (proposal.abertura && proposal.abertura.trim()) {
    const partes = proposal.abertura.trim().split(/\n\n+/);
    p1 = partes[0]||""; p2 = partes[1]||"";
  } else {
    const textos = {
      "Natal": {
        p1:"Existe um momento no Natal que todo mundo conhece, mas quase ningu\u00e9m consegue descrever com precis\u00e3o. \u00c9 aquele segundo entre a pessoa pegar o presente e abrir \u2014 quando os olhos brilham um pouco antes mesmo de saber o que est\u00e1 dentro. \u00c9 a antecipa\u00e7\u00e3o da alegria. \u00c9 a prova de que algu\u00e9m pensou nela.",
        p2:"A Oba preparou este cat\u00e1logo para que voc\u00ea seja exatamente essa pessoa \u2014 a que pensou, a que escolheu com cuidado, a que fez algu\u00e9m se sentir especial nesta \u00e9poca do ano. Cada produto foi desenvolvido para chegar bonito, cheiroso e com todo o afeto que o Natal merece.",
      },
      "P\u00e1scoa":{
        p1:"A P\u00e1scoa tem uma magia que poucas datas conseguem replicar. Talvez seja o chocolate \u2014 mas n\u00e3o \u00e9 s\u00f3 isso. \u00c9 a leveza do clima, a sensa\u00e7\u00e3o de que algo novo est\u00e1 come\u00e7ando. E no meio desse clima, um presente bem pensado tem um peso diferente: ele diz que a pessoa foi lembrada, que o gesto foi intencional, que h\u00e1 cuidado por tr\u00e1s.",
        p2:"A Oba Doceria vive disso \u2014 de transformar ingredientes simples em experi\u00eancias que ficam na mem\u00f3ria. Este cat\u00e1logo foi preparado com produtos desenvolvidos especialmente para esta \u00e9poca: sabores que remetem \u00e0 tradi\u00e7\u00e3o, apresenta\u00e7\u00e3o que encanta antes mesmo do primeiro mordida.",
      },
      "Dia das M\u00e3es":{
        p1:"M\u00e3e \u00e9 aquela pessoa que, mesmo quando o presente \u00e9 simples, faz aquela cara de quem recebeu o melhor presente do mundo. Ela n\u00e3o precisa de muito. Ela precisa sentir que foi lembrada com cuidado \u2014 que, no meio de tudo, voc\u00ea parou, pensou nela e quis fazer algo especial.",
        p2:"A Oba sabe o que \u00e9 esse gesto. Cada produto deste cat\u00e1logo foi pensado para ser \u00e0 altura desse amor \u2014 bonito por fora, irresist\u00edvel por dentro, e carregado da inten\u00e7\u00e3o mais bonita que existe: fazer uma m\u00e3e sorrir.",
      },
      "Dia dos Pais":{
        p1:"Pai tem um jeito todo especial de receber presente. Ele agradece, faz aquele sorriso contido, diz que n\u00e3o precisava \u2014 e voc\u00ea sabe que, por dentro, ficou muito feliz. Presentear pai \u00e9 uma arte: precisa ser algo que ele n\u00e3o compraria pra si mesmo, mas que claramente foi escolhido pensando nele.",
        p2:"Este cat\u00e1logo foi preparado com essa premissa. Produtos que encantam sem precisar gritar, embalagens que impressionam sem exagero, sabores que ficam na mem\u00f3ria por dias. A Oba Doceria acredita que um presente bem pensado faz mais barulho do que qualquer coisa comprada na pressa.",
      },
      "Dia dos Namorados":{
        p1:"Tem uma teoria de que as melhores hist\u00f3rias de amor se constroem nos detalhes. N\u00e3o nos grandes gestos \u2014 esses qualquer um faz. Mas no docinho que chegou de surpresa numa tarde de ter\u00e7a. No presente embalado com cuidado quando n\u00e3o era anivers\u00e1rio de nada. Na escolha que prova: eu pensei em voc\u00ea.",
        p2:"A Oba Doceria existe nesse espa\u00e7o \u2014 no detalhe que faz diferen\u00e7a, na lembran\u00e7a que transforma um dia comum em algo que vai ser contado depois. Este cat\u00e1logo foi preparado com produtos desenvolvidos para surpreender: sabores intensos, apresenta\u00e7\u00e3o que encanta.",
      },
      "Dia das Crian\u00e7as":{
        p1:"Existe um tipo de alegria que s\u00f3 crian\u00e7as t\u00eam acesso pleno \u2014 aquela alegria sem reservas, sem filtro, sem o peso do precisa ser discreto. \u00c9 o pulo, o grito, o abra\u00e7o que quase derruba. E essa alegria, quando acontece por causa de algo que voc\u00ea escolheu, fica guardada na mem\u00f3ria das duas pessoas.",
        p2:"A Oba Doceria preparou este cat\u00e1logo pensando exatamente nesse momento. Produtos coloridos, saborosos, pensados para encantar quem ainda enxerga o mundo com os olhos bem abertos. Porque crian\u00e7a merece presente pensado com carinho \u2014 e voc\u00ea merece ver esse sorriso que n\u00e3o tem pre\u00e7o.",
      },
    };
    const txt = textos[dataCom] || {
      p1:"Algumas datas no calend\u00e1rio merecem mais do que uma mensagem no celular. Merecem um gesto concreto, algo que a pessoa possa segurar nas m\u00e3os e sentir que houve inten\u00e7\u00e3o por tr\u00e1s. \u00c9 nesse espa\u00e7o que a Oba Doceria vive.",
      p2:"Este cat\u00e1logo foi preparado com produtos desenvolvidos para esta data espec\u00edfica: sabores que combinam com o clima, apresenta\u00e7\u00e3o que encanta antes mesmo de abrir, e tudo com o cuidado artesanal que \u00e9 a marca registrada da Oba.",
    };
    p1 = nomeEmpresa ? "Para "+nomeEmpresa+": "+txt.p1 : txt.p1;
    p2 = txt.p2;
  }

  // ---- Índice pg1 ----
  const indiceHtml = options.map(function(opt, oi){
    const faixas  = opt.faixas||[];
    const precoMin = faixas.length ? faixas.reduce((a,f)=>f.preco<a?f.preco:a, faixas[0].preco) : Number(opt.valor_unit||0);
    const imgSrc   = (opt.medias&&opt.medias.length) ? "/api/proposals/"+propId+"/media/"+opt.medias[0].media_id+"/dados" : null;
    return (
      "<div class=\"idx-card\" onclick=\"obaShowPage("+(oi+2)+")\">"
      +(imgSrc?"<img src=\""+imgSrc+"\" class=\"idx-img\" loading=\"lazy\" alt=\"\">":"<div class=\"idx-img idx-img-empty\"></div>")
      +"<div class=\"idx-corpo\">"
      +  "<span class=\"idx-num\">Op\u00e7\u00e3o "+(oi+1)+"</span>"
      +  "<p class=\"idx-nome\">"+toTC(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</p>"
      +  (opt.descricao?"<p class=\"idx-desc\">"+opt.descricao+"</p>":"")
      +  (precoMin>0?"<span class=\"idx-preco\" style=\"color:"+T.acento+"\">a partir de "+R(precoMin)+" / un.</span>":"")
      +"</div>"
      +"<span class=\"idx-seta\">\u2192</span>"
      +"</div>"
    );
  }).join("\n");

  // ---- Páginas de detalhe ----
  const detalhePages = options.map(function(opt, oi){
    const faixas  = opt.faixas||[];
    const imgs    = opt.medias||[];
    const prevOi  = oi > 0 ? oi-1 : null;
    const nextOi  = oi < numOpts-1 ? oi+1 : null;

    const heroHtml = imgs.length
      ? "<img src=\"/api/proposals/"+propId+"/media/"+imgs[0].media_id+"/dados\" class=\"det-hero\" loading=\"lazy\" alt=\""+(opt.nome||"")+"\">"
      : "";
    const galeriaExtra = imgs.length > 1
      ? "<div class=\"det-galeria\">"+imgs.slice(1).map(m=>"<img src=\"/api/proposals/"+propId+"/media/"+m.media_id+"/dados\" class=\"det-gal-img\" loading=\"lazy\" alt=\"\">").join("")+"</div>"
      : "";

    const tabelaFaixas = faixas.length
      ? "<div class=\"faixas-bloco\"><p class=\"faixas-titulo\" style=\"color:"+T.acento+"\">Faixas de pre\u00e7o</p><table class=\"faixas-tab\"><tbody>"
        +faixas.map(function(f){
          const lbl = f.de!=null&&f.ate!=null?"De "+f.de+" a "+f.ate+" un."
            :f.de!=null&&f.ate==null?"A partir de "+f.de+" un."
            :f.ate!=null?"At\u00e9 "+f.ate+" un.":"Demais";
          return "<tr><td class=\"ft-l\">"+lbl+"</td><td class=\"ft-p\" style=\"color:"+T.acento+"\">"+R(f.preco)+"<span class=\"ft-un\"> / un.</span></td></tr>";
        }).join("")
        +"</tbody></table></div>"
      : (Number(opt.valor_unit||0)>0
        ? "<div class=\"faixas-bloco\"><table class=\"faixas-tab\"><tbody><tr><td class=\"ft-l\">Pre\u00e7o por unidade</td><td class=\"ft-p\" style=\"color:"+T.acento+"\">"+R(opt.valor_unit)+"</td></tr></tbody></table></div>"
        : "");

    const ctaMsg  = encodeURIComponent("Ol\u00e1, Oba Doceria! Vi o cat\u00e1logo"+(dataCom?" de "+dataCom:"")+" e me interessei por \u201c"+toTC(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"\u201d. Quero conversar sobre os pr\u00f3ximos passos.");
    const ctaHref = obaWpp ? "https://wa.me/55"+obaWpp+"?text="+ctaMsg : "";
    const ctaBtn  = ctaHref ? "<a href=\""+ctaHref+"\" target=\"_blank\" class=\"cta-btn\" style=\"background:"+T.acentoBtn+"\">Tenho interesse \u2014 vamos conversar</a>" : "";

    const navPrev = prevOi!==null ? "<button class=\"nav-prev\" onclick=\"obaShowPage("+(prevOi+2)+")\">\u2190 "+toTC(options[prevOi].nome||("Op\u00e7\u00e3o "+(prevOi+1)))+"</button>" : "<span></span>";
    const navNext = nextOi!==null ? "<button class=\"nav-next\" onclick=\"obaShowPage("+(nextOi+2)+")\">"+toTC(options[nextOi].nome||("Op\u00e7\u00e3o "+(nextOi+1)))+" \u2192</button>" : "<span></span>";

    return (
      "<div id=\"pg"+(oi+2)+"\" class=\"det-page\" style=\"display:none\">"
      +"<header class=\"det-header\" style=\"background:"+T.acento+"\">"
      +"  <button class=\"btn-voltar\" onclick=\"obaShowPage(1)\">\u2190 Cat\u00e1logo</button>"
      +"  <span class=\"det-header-titulo\">"+(oi+1)+" de "+numOpts+"</span>"
      +"</header>"
      +"<div class=\"det-wrap\">"
      +  heroHtml
      +  galeriaExtra
      +  "<div class=\"det-corpo\">"
      +    "<span class=\"det-num\" style=\"color:"+T.acento+"\">Op\u00e7\u00e3o "+(oi+1)+"</span>"
      +    "<h2 class=\"det-nome\">"+toTC(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</h2>"
      +    (opt.descricao?"<p class=\"det-desc\">"+opt.descricao+"</p>":"")
      +    tabelaFaixas
      +    ctaBtn
      +  "</div>"
      +"</div>"
      +"<div class=\"det-nav\" style=\"border-top:1px solid "+T.borda+"\">"+navPrev+navNext+"</div>"
      +"</div>"
    );
  }).join("\n");

  // ---- Condições ----
  const condLinhas = [
    proposal.prazo_pedido   ? {l:"Pedidos at\u00e9",  v:proposal.prazo_pedido}   : null,
    proposal.prazo_entrega  ? {l:"Entrega",            v:proposal.prazo_entrega}  : null,
    proposal.cond_pagamento ? {l:"Pagamento",           v:proposal.cond_pagamento} : null,
    proposal.pedido_minimo  ? {l:"M\u00ednimo",         v:proposal.pedido_minimo+" unidades"} : null,
  ].filter(Boolean);
  const condHtml = condLinhas.length
    ? "<div class=\"cond-box\" style=\"border-color:"+T.borda+"\">"
      +"<p class=\"cond-titulo\" style=\"color:"+T.acento+"\">Informa\u00e7\u00f5es do cat\u00e1logo</p>"
      +"<div class=\"cond-grid\">"
      +condLinhas.map(c=>"<div class=\"cond-item\" style=\"background:"+T.fundo+";border-color:"+T.borda+"\">"
        +"<span class=\"cond-l\" style=\"color:"+T.acento+"\">"+c.l+"</span>"
        +"<span class=\"cond-v\">"+c.v+"</span></div>").join("")
      +"</div>"
      +(proposal.observacoes?"<p class=\"cond-obs\">"+proposal.observacoes+"</p>":"")
      +"</div>"
    : (proposal.observacoes?"<p class=\"cond-obs\" style=\"padding:0 24px;margin-top:16px\">"+proposal.observacoes+"</p>":"");

  const sazValidadeHtml = validade ? "<p class=\"rodape-info\">Proposta v\u00e1lida at\u00e9 <strong>"+validade+"</strong></p>" : "";
  const sazWppHtml = obaWpp  ? "<p class=\"rodape-info\"><a href=\"https://wa.me/55"+obaWpp+"\" class=\"rodape-wpp\" style=\"color:"+T.acento+"\">D\u00favidas? Fale pelo WhatsApp</a></p>" : "";

  // ---- CSS ----
  const css = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{scroll-behavior:smooth}
body{background:${T.fundo};font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1A1A1A;line-height:1.6}
.wrap{max-width:620px;margin:0 auto;background:${T.fundo}}

/* PG0 */
#pg0{min-height:100svh;display:flex;flex-direction:column;background:${T.fundo}}
.pg0-topo{padding:44px 28px 0;flex:1;display:flex;flex-direction:column}
.pg0-logo{height:34px;object-fit:contain;opacity:.6;margin-bottom:28px}
.pg0-eyebrow{font-size:9px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:${T.acento};opacity:.7;margin-bottom:14px;display:block}
.pg0-data{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(15px,3.5vw,17px);font-weight:400;color:${T.acento};display:block;margin-bottom:16px;letter-spacing:.5px}
.pg0-p1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(22px,5.8vw,30px);font-weight:400;font-style:italic;color:#1A1A1A;line-height:1.6;margin-bottom:10px}
.pg0-divider{border:none;border-top:1px solid ${T.borda};margin:6px 0 18px;width:48px}
.pg0-p2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(16px,4vw,20px);font-weight:400;font-style:normal;color:#555;line-height:1.75;margin-bottom:16px}
.pg0-para{font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;color:${T.acento};font-style:italic;opacity:.7;margin-top:10px}
.pg0-rodape{padding:28px 28px 44px;border-top:1px solid ${T.borda};margin-top:28px}
.pg0-assinatura{font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;font-style:italic;color:${T.acento};opacity:.4;display:block;text-align:center;margin-bottom:18px}
.pg0-btn{display:block;width:100%;background:${T.acentoBtn};color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:.8px;padding:16px;border-radius:12px;border:none;cursor:pointer;text-align:center;text-transform:uppercase}

/* PG1 — índice */
#pg1{display:none;background:${T.fundo}}
.pg1-header{background:${T.acento};padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.pg1-header-logo{height:22px;filter:brightness(0) invert(1);opacity:.85;object-fit:contain}
.pg1-header-titulo{font-size:11px;font-weight:500;color:rgba(255,255,255,.75);text-align:center;flex:1;padding:0 10px}
.btn-voltar{background:none;border:1.5px solid rgba(255,255,255,.3);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,.85);cursor:pointer;white-space:nowrap}
.pg1-intro{padding:24px 24px 8px}
.pg1-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:400;color:#1A1A1A;margin-bottom:4px}
.pg1-sub{font-size:11px;color:#AAA;font-style:italic}
.secao-label{padding:18px 24px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${T.acento};opacity:.6}

/* Índice */
.idx-card{display:flex;align-items:center;gap:14px;margin:0 16px 10px;padding:12px 14px 12px 12px;background:#fff;border-radius:12px;border:1px solid ${T.borda};cursor:pointer;transition:box-shadow .15s}
.idx-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.1)}
.idx-img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid ${T.borda};flex-shrink:0}
.idx-img-empty{background:#F5F5F5}
.idx-corpo{flex:1;min-width:0}
.idx-num{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${T.acento};opacity:.65;display:block;margin-bottom:2px}
.idx-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:600;color:#1A1A1A;line-height:1.2;margin-bottom:2px}
.idx-desc{font-size:11px;color:#AAA;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.idx-preco{font-size:12px;font-weight:600;display:block;margin-top:4px}
.idx-seta{font-size:18px;color:${T.borda};flex-shrink:0}

/* Condições */
.cond-box{margin:16px 16px 0;padding:14px 16px;border-radius:12px;border:1px solid}
.cond-titulo{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.cond-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cond-item{padding:8px 10px;border-radius:8px;border:1px solid;display:flex;flex-direction:column;gap:3px}
.cond-l{font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;opacity:.7}
.cond-v{font-size:12px;font-weight:600;color:#333}
.cond-obs{font-size:12px;color:#999;font-style:italic;margin-top:10px;line-height:1.5}

/* Rodapé pg1 */
.pg1-rodape{margin:12px 24px 0;padding:16px 0 32px;border-top:1px solid ${T.borda}}
.rodape-info{font-size:11px;color:#AAA;margin-bottom:4px}
.rodape-info strong{color:#777}
.rodape-wpp{font-weight:600;text-decoration:none}
.rodape-brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;font-style:italic;color:#CCC;display:block;margin-top:8px}
.btn-pdf{margin-top:12px;background:#333;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;display:block;width:100%;text-align:center}

/* Detalhe */
.det-page{background:${T.fundo};min-height:100svh;display:flex;flex-direction:column}
.det-header{padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.det-header-titulo{font-size:11px;color:rgba(255,255,255,.65);font-weight:500}
.det-wrap{flex:1;background:#fff}
.det-hero{width:100%;max-height:320px;object-fit:cover;display:block}
.det-galeria{display:flex;gap:6px;padding:8px 16px 0;background:#fff}
.det-gal-img{width:calc(33.33% - 4px);aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #EEE}
.det-corpo{padding:22px 24px 24px}
.det-num{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:6px;opacity:.65}
.det-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:600;color:#1A1A1A;line-height:1.2;margin-bottom:6px}
.det-desc{font-size:13px;color:#888;font-style:italic;margin-bottom:16px;line-height:1.5}
.faixas-bloco{margin-bottom:20px}
.faixas-titulo{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.faixas-tab{width:100%;border-collapse:collapse}
.faixas-tab td{padding:9px 0;border-bottom:1px solid #F0F0F0;font-size:13px}
.ft-l{color:#444}
.ft-p{text-align:right;font-weight:600;white-space:nowrap}
.ft-un{font-size:10px;font-weight:400;opacity:.6}
.cta-btn{display:block;padding:15px;border-radius:12px;text-align:center;color:#fff;font-weight:700;font-size:13px;text-decoration:none;letter-spacing:.3px}
.det-nav{display:flex;justify-content:space-between;align-items:center;padding:12px 20px 28px;gap:10px}
.nav-prev,.nav-next{background:none;border:1.5px solid ${T.borda};border-radius:20px;padding:7px 14px;font-size:11px;font-weight:600;color:${T.acento};cursor:pointer;white-space:nowrap;max-width:45%;overflow:hidden;text-overflow:ellipsis}
.nav-next{margin-left:auto;text-align:right}

/* ================================================================
   @MEDIA PRINT — Layout profissional A4
   ================================================================ */
@page{size:A4 portrait;margin:18mm 20mm 16mm}
@media print{
  .pg0-btn,.pg0-assinatura,
  .pg1-header,.btn-voltar,.det-header,.det-nav,.cta-btn,.btn-pdf,
  .idx-card,.pg1-intro,.secao-label,.pg1-rodape,.cond-box,
  #pg1{display:none!important}

  body{background:#fff;font-size:11pt}
  .wrap{max-width:100%;margin:0;background:#fff}

  /* Pg abertura */
  #pg0{display:block!important;min-height:0!important;background:#fff!important;page-break-after:always}
  .pg0-topo{padding:0;display:block}
  .pg0-logo{height:30px;margin-bottom:20pt;opacity:1}
  .pg0-eyebrow{color:${T.acento};opacity:1;margin-bottom:12pt;font-size:8pt}
  .pg0-data{color:${T.acento};font-size:13pt;margin-bottom:10pt}
  .pg0-p1{font-size:17pt;color:#1A1A1A;margin-bottom:8pt}
  .pg0-divider{display:block;margin:8pt 0;border-top-color:#DDD;width:48px}
  .pg0-p2{font-size:13pt;color:#444;margin-bottom:12pt}
  .pg0-para{color:${T.acento};opacity:.8;font-size:10pt;margin-top:10pt}
  .pg0-rodape{display:block!important;border-top:1px solid #DDD;padding:10pt 0 0;margin-top:16pt}
  .pg0-btn{display:none!important}
  .pg0-assinatura{display:none!important}

  /* Páginas de opção */
  .det-page{display:block!important;min-height:0!important;page-break-before:always;background:#fff!important}
  .det-wrap{display:block;background:#fff}
  .det-hero{width:100%;max-height:200pt;object-fit:cover;border:1px solid #EEE;border-radius:4pt;display:block;margin-bottom:10pt}
  .det-galeria{display:flex;gap:6pt;margin-bottom:10pt}
  .det-gal-img{width:calc(33.33% - 4pt);aspect-ratio:1;object-fit:cover;border-radius:4pt;border:1px solid #EEE}
  .det-corpo{padding:0}
  .det-num{color:${T.acento};opacity:1;font-size:8pt;margin-bottom:4pt}
  .det-nome{font-size:20pt;color:#1A1A1A;margin-bottom:4pt}
  .det-desc{color:#666;font-size:10pt;margin-bottom:10pt}
  .faixas-titulo{color:${T.acento};opacity:1;font-size:8pt}
  .faixas-tab td{padding:5pt 0;border-bottom:1px solid #EEE;font-size:10pt}
  .ft-p{color:#1A1A1A}
}`;

  const html = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n"
    +"<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
    +"<meta name=\"robots\" content=\"noindex,nofollow\">\n"
    +"<title>"+(dataCom||"Cat\u00e1logo Sazonal")+(nomeEmpresa?" \u00b7 "+nomeEmpresa:"")+" \u00b7 Oba Doceria</title>\n"
    +"<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
    +"<link href=\"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">\n"
    +"<style>"+css+"</style>\n</head>\n<body>\n<div class=\"wrap\">\n\n"

    // PG0
    +"<div id=\"pg0\">\n"
    +"  <div class=\"pg0-topo\">\n"
    +"    <img class=\"pg0-logo\" src=\"https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png\" alt=\"Oba Doceria\" onerror=\"this.style.display='none'\">\n"
    +"    <span class=\"pg0-eyebrow\">Cat\u00e1logo Sazonal</span>\n"
    +(dataCom?"    <span class=\"pg0-data\">"+dataCom+"</span>\n":"")
    +"    <p class=\"pg0-p1\">"+p1+"</p>\n"
    +"    <hr class=\"pg0-divider\">\n"
    +"    <p class=\"pg0-p2\">"+p2+"</p>\n"
    +(nomeEmpresa?"    <p class=\"pg0-para\">Preparado com carinho para "+nomeEmpresa+"</p>\n":"")
    +"  </div>\n"
    +"  <div class=\"pg0-rodape\">\n"
    +"    <span class=\"pg0-assinatura\">Feito com cuidado. Servido com amor.</span>\n"
    +"    <button class=\"pg0-btn\" onclick=\"obaShowPage(1)\">Ver o cat\u00e1logo &rarr;</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    // PG1 — índice
    +"<div id=\"pg1\">\n"
    +"  <div class=\"pg1-header\">\n"
    +"    <button class=\"btn-voltar\" onclick=\"obaShowPage(0)\">\u2190 In\u00edcio</button>\n"
    +"    <img class=\"pg1-header-logo\" src=\"https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png\" alt=\"Oba Doceria\" onerror=\"this.style.display='none'\">\n"
    +"    <span class=\"pg1-header-titulo\">"+(dataCom||"Cat\u00e1logo")+"</span>\n"
    +"  </div>\n"
    +"  <div class=\"pg1-intro\">\n"
    +"    <h1 class=\"pg1-titulo\">"+(dataCom||"Nossos produtos")+"</h1>\n"
    +(nomeEmpresa?"    <p class=\"pg1-sub\">Para "+nomeEmpresa+"</p>\n":"")
    +"  </div>\n"
    +"  <p class=\"secao-label\">Selecione uma op\u00e7\u00e3o para ver os detalhes</p>\n"
    +(indiceHtml||"  <p style=\"text-align:center;color:#BBB;padding:32px 24px;font-size:13px\">Nenhuma op\u00e7\u00e3o cadastrada.</p>")
    +(condHtml ? "\n"+condHtml : "")
    +"\n  <div class=\"pg1-rodape\">\n    "+sazValidadeHtml+sazWppHtml
    +"    <span class=\"rodape-brand\">Oba Doceria \u00b7 Um jeito doce de expressar felicidade</span>\n"
    +"    <button class=\"btn-pdf\" onclick=\"window.print()\">Salvar como PDF</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    // Páginas de detalhe
    + detalhePages

    +"\n</div>\n<script>\n"
    +"function obaShowPage(n){\n"
    +"  var pg0=document.getElementById('pg0');\n"
    +"  var pg1=document.getElementById('pg1');\n"
    +"  var pages=[pg0,pg1];\n"
    +"  for(var i=2;i<="+(numOpts+1)+";i++){\n"
    +"    var el=document.getElementById('pg'+i);\n"
    +"    if(el) pages.push(el);\n"
    +"  }\n"
    +"  pages.forEach(function(el,idx){\n"
    +"    if(!el) return;\n"
    +"    el.style.display=(idx===n)?((idx===0)?'flex':'block'):'none';\n"
    +"  });\n"
    +"  window.scrollTo({top:0,behavior:'smooth'});\n"
    +"}\n"
    +"<\/script>\n</body>\n</html>";

  return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "oba-cardapio-gestao",
        auth: "worker-gate",
      });
    }

    /* ----------------------------------------------------------------
     * ROTA PÚBLICA: GET /cardapio
     * Serve o cardápio público usando o slot PUBLISHED do D1.
     * Usa o mesmo mecanismo do /__preview mas com published-bootstrap.js
     * que lê /api/catalog em vez de /api/preview.
     * ---------------------------------------------------------------- */
    if (url.pathname === "/cardapio" && request.method === "GET") {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/ui-desenvolvimento/index.html";
      assetUrl.search = "";
      assetUrl.hash = "";
      const asset = await env.ASSETS.fetch(
        new Request(assetUrl.toString(), { method: "GET" })
      );
      if (!asset.ok) {
        return new Response("Cardápio temporariamente indisponível.", {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }

      const source = await asset.text();
      // Mesmo padrão do /__preview: base href + bootstrap script
      const inject = "<base href='/'><script src='/published-bootstrap.js'></script>";
      const html = source.includes("<head>")
        ? source.replace("<head>", "<head>" + inject)
        : inject + source;

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; img-src * data: blob:; connect-src 'self' https:; form-action 'self'"
        }
      });
    }

    // Rota pública: página de proposta compartilhável
    if (url.pathname.startsWith("/proposta/")) {
      const propostaResp = await obaHandlePropostaPublica(request, env, url);
      if (propostaResp) return propostaResp;
    }

    // Rota pública: imagens de propostas (sem autenticação, cache imutável)
    if (url.pathname.match(/^\/api\/proposals\/[^/]+\/media\/[^/]+\/dados$/) && request.method === "GET") {
      const mediaResp = await obaHandleProposalsApi(request, env, url);
      if (mediaResp) return mediaResp;
    }

    if (url.pathname === "/__auth/login") {
      if (request.method === "GET") {
        return response(loginPage(), 200, {
          "Content-Type": "text/html; charset=utf-8",
        });
      }

      if (request.method === "POST") {
        return handleLogin(request, env);
      }

      return response("Method Not Allowed", 405, {
        "Allow": "GET, POST",
      });
    }

    if (url.pathname === "/__auth/logout") {
      if (request.method !== "POST") {
        return response("Method Not Allowed", 405, {
          "Allow": "POST",
        });
      }

      const authenticated = await validateSession(request, env);

      if (!authenticated) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }

      if (!csrfValid(request)) {
        return json({ ok: false, error: "csrf" }, 403);
      }

      return handleLogout();
    }

    // Rota pública: lista imagens do GitHub (antes de obaHandleMediaServe para não ser capturada como ID)
    if (url.pathname === "/api/media/github" && request.method === "GET") {
      return obaHandleGithubImagesApi(request, env, url);
    }

    // Rota pública: dados do catálogo publicado (usado pelo cardápio público /cardapio)
    if (url.pathname === "/api/catalog" && request.method === "GET") {
      const catalogResp = await obaHandleCatalogReadApi(request, env);
      if (catalogResp) return catalogResp;
    }

    if (url.pathname.startsWith("/api/media/") && request.method === "GET") {
      return obaHandleMediaServe(request, env, url);
    }

    const authenticated = await validateSession(request, env);

    if (!authenticated) {
      if (url.pathname.startsWith("/api/")) {
        return json(
          {
            ok: false,
            error: "unauthorized",
          },
          401
        );
      }

      return response("", 303, {
        "Location": "/__auth/login",
      });
    }

    if (
      url.pathname.startsWith("/api/") &&
      isUnsafeMethod(request.method) &&
      !csrfValid(request)
    ) {
      return json(
        {
          ok: false,
          error: "csrf",
        },
        403
      );
    }

    if (url.pathname === "/__preview") {
      return obaPrivatePreviewPage(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      const obaMediaResponse =
        await obaHandleMediaApi(
          request,
          env,
          url
        );

      if (obaMediaResponse) {
        return obaMediaResponse;
      }

      const obaPublishResponse =
        await obaHandlePublishApi(
          request,
          env,
          url
        );

      if (obaPublishResponse) {
        return obaPublishResponse;
      }

      const obaPreviewResponse =
        await obaHandlePreviewApi(
          request,
          env,
          url
        );

      if (obaPreviewResponse) {
        return obaPreviewResponse;
      }

const obaDraftResponse =
        await obaHandleDraftApi(
          request,
          env,
          url
        );

      if (obaDraftResponse) {
        return obaDraftResponse;
      }


    const obaCatalogReadResponse =
      await obaHandleCatalogReadApi(
        request,
        env
      );

    if (obaCatalogReadResponse) {
      return obaCatalogReadResponse;
    }

    // Rotas de mídia autenticadas (upload POST + DELETE)
    if (url.pathname.startsWith("/api/media") || url.pathname === "/api/upload-image") {
      const obaMediaResponse = await obaHandleMediaApi(request, env, url);
      if (obaMediaResponse) return obaMediaResponse;
    }

    // Fase 12A — Propostas de orçamento
    if (url.pathname.startsWith("/api/proposals")) {
      const obaProposalsResponse = await obaHandleProposalsApi(request, env, url);
      if (obaProposalsResponse) return obaProposalsResponse;
    }

return json(
        {
          ok: false,
          error: "not_implemented",
        },
        501
      );
    }

    return env.ASSETS.fetch(request);
  },
};
