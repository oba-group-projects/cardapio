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
      "SELECT proposal_id, cliente, data_evento, convidados, tipo_evento, status, criado_em, atualizado_em FROM proposals ORDER BY criado_em DESC"
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
async function obaHandlePropostaCorporativo(proposal, obaWpp, env, propId) {
  const R = (v) => { const n=Number(v||0).toFixed(2),[i,d]=n.split("."); return "R$\u00a0"+i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+d; };
  const MESES=["janeiro","fevereiro","mar\u00e7o","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const fmtD =(d)=>{ if(!d)return null; try{const[y,m,dy]=d.split("-");return parseInt(dy)+" de "+MESES[parseInt(m)-1]+" de "+y;}catch{return d;} };
  const fmtDT=(d)=>{ if(!d)return null; try{const[dt,hr]=d.split("T");const[y,m,dy]=dt.split("-");return parseInt(dy)+" de "+MESES[parseInt(m)-1]+(hr?" \u00e0s "+hr.slice(0,5):"");}catch{return d;} };

  // Paleta esmeralda + cobre
  const COR = {
    escuro:   "#1C3B2E",
    escuro2:  "#2A5240",
    cobre:    "#C8922A",
    cobreClr: "#D4A865",
    texto:    "#F5F0E6",
    textoDim: "rgba(245,240,230,.6)",
    fundo:    "#FAFAF6",
    fundoCrd: "#FFFFFF",
    verdeTxt: "#1A2E22",
    verdeAcc: "#2A5240",
    borda:    "#D4E0D8",
  };

  const PALS=[
    {acento:COR.cobre,    topo:COR.escuro,  fundo:"#F7FAF8"},
    {acento:"#5A8A70",    topo:"#3D6B56",   fundo:"#F4F9F7"},
    {acento:"#3D6B56",    topo:"#2A5240",   fundo:"#F0F7F4"},
    {acento:"#7AAA90",    topo:"#5A8A70",   fundo:"#EFF6F3"},
    {acento:COR.cobreClr, topo:COR.cobre,   fundo:"#FDFAF5"},
  ];

  const validade    = fmtD(proposal.validade);
  const nomeEmpresa = proposal.empresa || proposal.cliente || "";
  const options     = (proposal.options && proposal.options.length) ? proposal.options : [];
  const numOptions  = options.length;

  // Texto de abertura — usa o customizado ou gera contextualizado
  const qtdStr  = proposal.qtd_solicitada ? proposal.qtd_solicitada+" unidades" : null;
  const paraA   = (proposal.abertura||"").trim() ||
    (nomeEmpresa && qtdStr
      ? nomeEmpresa+", preparamos esta proposta pensando em cada um dos "+qtdStr+" que voc\u00ea quer presentear."
      : nomeEmpresa
        ? "Para "+nomeEmpresa+", preparamos esta proposta com cuidado e aten\u00e7\u00e3o a cada detalhe."
        : "Preparamos esta proposta com cuidado e aten\u00e7\u00e3o a cada detalhe.");

  const paraB = proposal.observacoes
    ? proposal.observacoes
    : "Abaixo voc\u00ea encontra "+(numOptions>1?"as "+numOptions+" op\u00e7\u00f5es":"a proposta")+" que desenvolvemos especialmente para voc\u00ea.";

  // Chips de briefing (pg0)
  const chips = [
    proposal.qtd_solicitada ? {l:"Qtd solicitada", v:proposal.qtd_solicitada+" un."} : null,
    proposal.orcamento_max  ? {l:"Or\u00e7amento m\u00e1x.", v:R(proposal.orcamento_max)} : null,
    proposal.data_entrega   ? {l:"Entrega em", v:fmtDT(proposal.data_entrega)} : null,
    proposal.demanda        ? {l:"Tipo", v:proposal.demanda} : null,
  ].filter(Boolean);

  const chipsHtml = chips.length
    ? chips.map(c=>"<div class=\"chip\"><span class=\"chip-l\">"+c.l+"</span><span class=\"chip-v\">"+c.v+"</span></div>").join("")
    : "";

  // Cards resumo pg1
  const resumoCards = options.map(function(opt,oi){
    const pal = PALS[oi%PALS.length];
    const preco = Number(opt.valor_unit||0);
    const precoHtml = preco>0
      ? "<span class=\"rc-valor\" style=\"color:"+pal.acento+"\">"+R(preco)+"<small>/un.</small></span>"
      : "<span class=\"rc-valor\" style=\"color:"+COR.cobre+";font-size:11px\">sob consulta</span>";
    return (
      "<div class=\"rc\" onclick=\"obaShowPage("+(oi+2)+")\" style=\"border-left-color:"+pal.acento+"\">"+
        "<div class=\"rc-linha\">"+
          "<div class=\"rc-esq\">"+
            "<span class=\"rc-num\" style=\"color:"+pal.acento+"\">"+(oi+1)+"</span>"+
            "<div>"+
              "<span class=\"rc-badge\">"+(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</span>"+
              (opt.descricao?"<span class=\"rc-sub\">"+opt.descricao+"</span>":"")+
            "</div>"+
          "</div>"+
          "<div class=\"rc-dir\">"+precoHtml+"<span class=\"rc-seta\">\u2192</span></div>"+
        "</div>"+
      "</div>"
    );
  }).join("\n");

  // Páginas detalhe (pg2+)
  const detalhePages = options.map(function(opt,oi){
    const pal = PALS[oi%PALS.length];
    const imgs = (opt.medias||[]).map(function(m){
      const src="/api/proposals/"+propId+"/media/"+m.media_id+"/dados";
      return "<img src=\""+src+"\" class=\"det-img\" loading=\"lazy\" alt=\""+( opt.nome||"")+"\">";
    }).join("");
    const imgSection = imgs ? "<div class=\"det-galeria\">"+imgs+"</div>" : "";

    const faixas = opt.faixas||[];
    const tabelaFaixas = faixas.length ? (
      "<div class=\"faixas-bloco\">"+
      "<p class=\"faixas-titulo\" style=\"color:"+pal.acento+"\">Faixas de quantidade</p>"+
      "<table class=\"faixas-tab\"><tbody>"+
      faixas.map(function(f){
        const label = f.de!=null && f.ate!=null
          ? ("De "+f.de+" a "+f.ate+" un.")
          : f.de!=null && f.ate==null
            ? ("A partir de "+f.de+" un.")
            : f.ate!=null
              ? ("At\u00e9 "+f.ate+" un.")
              : "Demais";
        return "<tr><td class=\"ft-label\">"+label+"</td><td class=\"ft-price\" style=\"color:"+pal.acento+"\">"+R(f.preco)+" <small>/ un.</small></td></tr>";
      }).join("")+
      "</tbody></table></div>"
    ) : (Number(opt.valor_unit||0)>0
      ? "<div class=\"faixas-bloco\"><table class=\"faixas-tab\"><tbody>"+
        "<tr><td class=\"ft-label\">Pre\u00e7o por unidade</td><td class=\"ft-price\" style=\"color:"+pal.acento+"\">"+R(opt.valor_unit)+"</td></tr>"+
        "</tbody></table></div>"
      : "");

    const navBtns = options.filter((_,xi)=>xi!==oi).map(function(x){
      const xp=PALS[options.indexOf(x)%PALS.length];
      return "<button class=\"nav-pill\" style=\"color:"+xp.acento+";border-color:"+xp.acento+"40\" onclick=\"obaShowPage("+(options.indexOf(x)+2)+")\">"+
             (x.nome||("Op\u00e7\u00e3o "+(options.indexOf(x)+1)))+"</button>";
    }).join("");

    const ctaMsg  = encodeURIComponent("Ol\u00e1, Oba Doceria! Gostei da Op\u00e7\u00e3o "+(oi+1)+" \u2013 "+(opt.nome||"")+" da proposta para "+nomeEmpresa+". Vamos conversar?");
    const ctaHref = obaWpp ? "https://wa.me/55"+obaWpp+"?text="+ctaMsg : "";
    const ctaBtn  = ctaHref ? "<a href=\""+ctaHref+"\" target=\"_blank\" class=\"cta-btn\" style=\"background:"+pal.acento+"\">Quero esta op\u00e7\u00e3o \u2014 vamos conversar</a>" : "";

    return (
      "<div id=\"pg"+(oi+2)+"\" class=\"det-page\" style=\"display:none\">"+
        "<header class=\"det-bar\">"+
          "<button class=\"back-btn\" onclick=\"obaShowPage(1)\">\u2190 Todas as op\u00e7\u00f5es</button>"+
          "<div class=\"det-nav\">"+navBtns+"</div>"+
        "</header>"+
        "<div class=\"det-card\" style=\"border-top-color:"+pal.topo+"\">"+
          "<div class=\"det-head\">"+
            "<div>"+
              "<span class=\"det-num\" style=\"color:"+pal.acento+"\">Op\u00e7\u00e3o "+(oi+1)+"</span>"+
              "<h2 class=\"det-nome\">"+(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</h2>"+
              (opt.descricao?"<p class=\"det-desc\">"+opt.descricao+"</p>":"")+
            "</div>"+
            (Number(opt.valor_unit||0)>0?"<div class=\"det-price\" style=\"color:"+pal.acento+"\">"+R(opt.valor_unit)+"<small>/un.</small></div>":"")+
          "</div>"+
          imgSection+
          "<div class=\"det-corpo\">"+tabelaFaixas+ctaBtn+"</div>"+
        "</div>"+
        "<div class=\"det-bottom-nav\">"+
          "<button class=\"back-btn\" onclick=\"obaShowPage(1)\">\u2190 Todas as op\u00e7\u00f5es</button>"+
          "<div class=\"det-nav\">"+navBtns+"</div>"+
        "</div>"+
      "</div>"
    );
  }).join("\n");

  const validadeHtml = validade ? "<p>V\u00e1lida at\u00e9 <strong>"+validade+"</strong></p>" : "";
  const wppHtml      = obaWpp   ? "<p>D\u00favidas? <a href=\"https://wa.me/55"+obaWpp+"\">WhatsApp</a></p>" : "";

  const css = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#F0F5F2;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1A2E22;line-height:1.55}
.wrap{max-width:620px;margin:0 auto}

/* PG0 — abertura escura */
#pg0{min-height:100svh;display:flex;flex-direction:column;background:linear-gradient(150deg,${COR.escuro} 0%,${COR.escuro2} 60%,#1E4535 100%);position:relative;overflow:hidden}
#pg0::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");pointer-events:none}
.pg0-inner{padding:44px 28px 20px;display:flex;flex-direction:column;flex:1;position:relative;z-index:1}
.pg0-logo{height:42px;object-fit:contain;opacity:.9;margin-bottom:20px;filter:brightness(0) invert(1)}
.pg0-eyebrow{font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${COR.cobreClr};margin-bottom:28px;display:block}
.pg0-empresa{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(28px,7vw,38px);font-weight:600;color:${COR.texto};line-height:1.2;margin-bottom:16px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px}
.chip{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 12px;display:flex;flex-direction:column;gap:2px}
.chip-l{font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COR.cobreClr}}
.chip-v{font-size:11px;font-weight:500;color:${COR.texto}}
.pg0-divider{border:none;border-top:1px solid rgba(255,255,255,.12);margin:20px 0}
.pg0-texto{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(17px,4.5vw,21px);font-style:italic;color:rgba(245,240,230,.85);line-height:1.7;margin-bottom:12px}
.pg0-sub{font-size:12px;color:rgba(245,240,230,.5);line-height:1.6;margin-bottom:32px}
.pg0-rodape{margin-top:auto;padding:24px 28px 40px;position:relative;z-index:1}
.pg0-assinatura{font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;font-style:italic;color:rgba(245,240,230,.4);display:block;margin-bottom:18px;text-align:center}
.pg0-btn{display:block;width:100%;background:${COR.cobre};color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:.8px;padding:16px 24px;border-radius:12px;border:none;cursor:pointer;text-align:center;text-transform:uppercase}
.pg0-btn:hover{background:${COR.cobreClr}}

/* PG1 — listagem de opções */
#pg1{display:none;background:${COR.fundo}}
.pg1-header{background:${COR.escuro};padding:18px 20px 16px;display:flex;align-items:center;gap:12px}
.pg1-logo{height:28px;object-fit:contain;filter:brightness(0) invert(1);opacity:.9}
.pg1-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:400;color:${COR.texto};flex:1;text-align:center}
.pg1-empresa{font-size:10px;color:${COR.cobreClr};text-align:center;padding:10px 20px 4px;letter-spacing:1px;text-transform:uppercase}
.secao-titulo{padding:18px 20px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${COR.cobre}}
.rc{margin:0 16px 8px;border-radius:12px;border:1px solid ${COR.borda};border-left-width:3px;background:${COR.fundoCrd};padding:12px 16px;cursor:pointer;transition:box-shadow .15s}
.rc:hover{box-shadow:0 2px 12px rgba(44,82,64,.12)}
.rc-linha{display:flex;align-items:center;gap:10px;justify-content:space-between}
.rc-esq{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.rc-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:400;color:${COR.borda};font-style:italic;flex-shrink:0;width:28px}
.rc-badge{font-size:14px;font-weight:600;color:${COR.verdeTxt};display:block}
.rc-sub{font-size:11px;color:#7A9A88;display:block;margin-top:2px}
.rc-dir{text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.rc-valor{font-size:15px;font-weight:600;line-height:1}
.rc-valor small{font-size:10px;font-weight:400;opacity:.7}
.rc-seta{font-size:16px;color:${COR.borda}}
.pg1-footer{margin:16px 16px 0;padding:16px 0 32px;border-top:1px solid ${COR.borda};text-align:center}
.pg1-footer p{font-size:11px;color:#9AB0A4;margin-bottom:4px}
.pg1-footer a{color:${COR.cobre};font-weight:500;text-decoration:none}
.pg1-footer-brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;font-style:italic;color:${COR.borda};margin-top:6px;display:block}
.btn-pdf{margin-top:12px;background:${COR.escuro};color:#fff;border:none;border-radius:10px;padding:10px 24px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer}

/* DETALHE */
.det-page{background:${COR.fundo};padding-bottom:8px}
.det-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${COR.escuro};position:sticky;top:0;z-index:10}
.back-btn{background:none;border:1.5px solid rgba(255,255,255,.2);border-radius:24px;padding:5px 14px;font-size:11px;font-weight:600;color:${COR.texto};cursor:pointer}
.det-nav{display:flex;gap:6px;flex-wrap:wrap}
.nav-pill{background:none;border:1.5px solid;border-radius:24px;padding:4px 11px;font-size:10px;font-weight:600;cursor:pointer}
.det-card{margin:12px 14px 0;border-radius:16px;border:1px solid ${COR.borda};border-top-width:4px;overflow:hidden;background:${COR.fundoCrd};box-shadow:0 2px 16px rgba(28,59,46,.07)}
.det-head{padding:20px 20px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #EEF4F1}
.det-num{font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:4px;opacity:.7}
.det-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;color:${COR.verdeTxt};line-height:1.2}
.det-desc{font-size:12px;color:#7A9A88;font-style:italic;margin-top:4px}
.det-price{font-size:22px;font-weight:700;line-height:1;text-align:right;flex-shrink:0}
.det-price small{font-size:11px;font-weight:400;display:block;opacity:.7}
.det-galeria{display:flex;flex-wrap:wrap;gap:8px;padding:16px 20px 0}
.det-img{width:calc(50% - 4px);aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid ${COR.borda}}
.det-corpo{padding:16px 20px 20px}
.faixas-bloco{margin-top:4px;margin-bottom:14px}
.faixas-titulo{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
.faixas-tab{width:100%;border-collapse:collapse}
.faixas-tab td{padding:7px 0;border-bottom:1px solid #EEF4F1;font-size:12px}
.ft-label{color:${COR.verdeTxt}}
.ft-price{text-align:right;font-weight:600;white-space:nowrap}
.ft-price small{font-weight:400;opacity:.6}
.cta-btn{display:block;margin-top:16px;padding:14px;border-radius:12px;text-align:center;color:#fff;font-weight:700;font-size:13px;text-decoration:none;letter-spacing:.3px}
.det-bottom-nav{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 14px;margin-top:6px}

@page{margin:14mm 18mm}
@media print{
  #pg0{display:block!important;min-height:0!important;background:${COR.escuro}!important}
  .pg0-btn,.pg0-assinatura{display:none!important}
  #pg1{display:block!important}
  .rc{cursor:default}
  .det-page{display:block!important;page-break-before:always}
  .det-bar,.det-bottom-nav,.cta-btn,.btn-pdf{display:none!important}
  .wrap{max-width:100%;padding:0}
  .det-card{margin:8px 0 0;box-shadow:none;border-color:#ddd;page-break-inside:avoid}
}`;

  const html = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n"
    +"<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
    +"<meta name=\"robots\" content=\"noindex,nofollow\">\n"
    +"<title>Proposta para "+nomeEmpresa+" \u00b7 Oba Doceria</title>\n"
    +"<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
    +"<link href=\"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">\n"
    +"<style>"+css+"</style>\n</head>\n<body>\n<div class=\"wrap\">\n\n"

    // PG0 — abertura escura
    +"<div id=\"pg0\">\n"
    +"  <div class=\"pg0-inner\">\n"
    +"    <img class=\"pg0-logo\" src=\"https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png\" alt=\"Oba Doceria\" onerror=\"this.style.display='none'\">\n"
    +"    <span class=\"pg0-eyebrow\">Proposta Exclusiva</span>\n"
    +(nomeEmpresa?"    <p class=\"pg0-empresa\">"+nomeEmpresa+"</p>\n":"")
    +(chipsHtml?"    <div class=\"chips\">"+chipsHtml+"</div>\n":"")
    +"    <hr class=\"pg0-divider\">\n"
    +"    <p class=\"pg0-texto\">"+paraA+"</p>\n"
    +(paraB?"    <p class=\"pg0-sub\">"+paraB+"</p>\n":"")
    +"  </div>\n"
    +"  <div class=\"pg0-rodape\">\n"
    +"    <span class=\"pg0-assinatura\">Feito com cuidado. Servido com amor.</span>\n"
    +"    <button class=\"pg0-btn\" onclick=\"obaShowPage(1)\">Ver o que preparamos &rarr;</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    // PG1 — opções
    +"<div id=\"pg1\" style=\"display:none\">\n"
    +"  <div class=\"pg1-header\">\n"
    +"    <img class=\"pg1-logo\" src=\"https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png\" alt=\"Oba Doceria\" onerror=\"this.style.display='none'\">\n"
    +"    <p class=\"pg1-title\">Proposta para "+(nomeEmpresa||"voc\u00ea")+"</p>\n"
    +"  </div>\n"
    +"  <p class=\"secao-titulo\">Op\u00e7\u00f5es dispon\u00edveis</p>\n"
    +(resumoCards||"  <p style=\"text-align:center;color:#9AB0A4;padding:24px;font-size:12px\">Nenhuma op\u00e7\u00e3o cadastrada.</p>")
    +"\n  <div class=\"pg1-footer\">"+validadeHtml+wppHtml
    +"    <span class=\"pg1-footer-brand\">Oba Doceria &middot; Um jeito doce de expressar felicidade</span>\n"
    +"    <button class=\"btn-pdf\" onclick=\"window.print()\">Salvar como PDF</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    // PÁGINAS DETALHE
    +detalhePages

    +"\n</div>\n<script>\n"
    +"function obaShowPage(n){\n"
    +"  var ids=['pg0','pg1'];\n"
    +"  for(var i=2;i<="+numOptions+"+1;i++) ids.push('pg'+i);\n"
    +"  ids.forEach(function(id,idx){\n"
    +"    var el=document.getElementById(id); if(!el) return;\n"
    +"    el.style.display=(idx===n)?((idx===0)?'flex':'block'):'none';\n"
    +"  });\n"
    +"  window.scrollTo({top:0,behavior:'smooth'});\n"
    +"}\n"
    +"<\/script>\n</body>\n</html>";

  return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}

// ============================================================
// PAGINA PUBLICA — TEMPLATE SAZONAL (redesign 12B-rev2)
// Paletas temáticas por data. Pg0 escura/encantamento.
// Condições apenas no rodapé de pg1 (não na abertura).
// ============================================================
async function obaHandlePropostaSazonal(proposal, obaWpp, env, propId) {
  const R = (v) => { const n=Number(v||0).toFixed(2),[i,d]=n.split("."); return "R$\u00a0"+i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+d; };
  const toTC = (s) => s ? s.toLowerCase().replace(/(?:^|\s)\S/g,a=>a.toUpperCase()) : s;

  const dataCom     = proposal.data_comemorativa || "";
  const nomeEmpresa = proposal.empresa || "";
  const options     = (proposal.options && proposal.options.length) ? proposal.options : [];
  const validade    = proposal.validade
    ? (function(d){ try{const[y,m,dy]=d.split("-"); const MESES=["janeiro","fevereiro","mar\u00e7o","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]; return parseInt(dy)+" de "+MESES[parseInt(m)-1]+" de "+y; }catch{return d;} })(proposal.validade)
    : null;

  // Paletas por data comemorativa
  const TEMAS = {
    "Natal":             {bg1:"#5C1220", bg2:"#8B1A2F", acento:"#D4A843", borda:"#F0C060", fundo:"#FDF8F0", fundoCrd:"#FFFFFF", txt:"#F9ECD8", txtDim:"rgba(249,236,216,.55)", label:"NATAL 2026"},
    "P\u00e1scoa":       {bg1:"#2E1A5C", bg2:"#4A3070", acento:"#C8922A", borda:"#A07ACC", fundo:"#FAF8FF", fundoCrd:"#FFFFFF", txt:"#F0EAF8", txtDim:"rgba(240,234,248,.55)", label:"P\u00c1SCOA"},
    "Dia das M\u00e3es": {bg1:"#6B1A38", bg2:"#9B2850", acento:"#E8A0B8", borda:"#D07090", fundo:"#FFF5F8", fundoCrd:"#FFFFFF", txt:"#FDE8F0", txtDim:"rgba(253,232,240,.55)", label:"DIA DAS M\u00c3ES"},
    "Dia dos Pais":      {bg1:"#0E2440", bg2:"#1A3860", acento:"#C8922A", borda:"#4A7AB0", fundo:"#F5F8FF", fundoCrd:"#FFFFFF", txt:"#E8EEF8", txtDim:"rgba(232,238,248,.55)", label:"DIA DOS PAIS"},
    "Dia dos Namorados": {bg1:"#4A0E1A", bg2:"#7A1C30", acento:"#E8A0A8", borda:"#C06080", fundo:"#FFF5F5", fundoCrd:"#FFFFFF", txt:"#FDE8EC", txtDim:"rgba(253,232,236,.55)", label:"DIA DOS NAMORADOS"},
    "Dia das Crian\u00e7as":{bg1:"#5A2200", bg2:"#8B3A10", acento:"#F5D060", borda:"#E08030", fundo:"#FFFBF2", fundoCrd:"#FFFFFF", txt:"#FDF0D8", txtDim:"rgba(253,240,216,.55)", label:"DIA DAS CRIAN\u00c7AS"},
  };
  const T = TEMAS[dataCom] || {bg1:"#1E2A38",bg2:"#2C3E50",acento:"#C8922A",borda:"#C8922A",fundo:"#FAFAF6",fundoCrd:"#FFFFFF",txt:"#F0ECE4",txtDim:"rgba(240,236,228,.55)",label:dataCom.toUpperCase()||"CAT\u00c1LOGO SAZONAL"};

  // Texto pg0 — emocional, sem condições
  const paraA = (proposal.abertura||"").trim() || (function(){
    const base = {
      "Natal":             "Este Natal, cada caixa que chega nas m\u00e3os de quem voc\u00ea se importa conta uma hist\u00f3ria. A Oba preparou este cat\u00e1logo para ajudar voc\u00ea a cont\u00e1-la.",
      "P\u00e1scoa":       "A P\u00e1scoa \u00e9 tempo de gestos que ficam. Preparamos este cat\u00e1logo com o cuidado de quem sabe que cada chocolate \u00e9 mais do que um presente.",
      "Dia das M\u00e3es": "Nenhum presente substitui o amor, mas um bom doce \u00e9 uma forma bonita de express\u00e1-lo. Este cat\u00e1logo foi feito para tornar o Dia das M\u00e3es ainda mais especial.",
      "Dia dos Pais":      "Para o pai que merece ser lembrado com carinho e sabor. A Oba preparou op\u00e7\u00f5es exclusivas para tornar esse dia inesquec\u00edvel.",
      "Dia dos Namorados": "Amor se celebra com presen\u00e7a, com tempo e com os mimos certos. Preparamos este cat\u00e1logo para que voc\u00ea chegue com algo verdadeiramente especial.",
      "Dia das Crian\u00e7as":"A alegria das crian\u00e7as \u00e9 a nossa maior inspira\u00e7\u00e3o. Este cat\u00e1logo foi preparado para transformar o dia delas em uma festa de sabores.",
    };
    const txt = base[dataCom] || "Preparamos este cat\u00e1logo com muito carinho para tornar esta data ainda mais especial e doce.";
    return nomeEmpresa ? "Para "+nomeEmpresa+": "+txt : txt;
  })();

  // Bloco de condições — vai no RODAPÉ de pg1, não na pg0
  const condLinhas = [
    proposal.prazo_pedido   ? {l:"Pedidos at\u00e9", v:proposal.prazo_pedido}   : null,
    proposal.prazo_entrega  ? {l:"Entrega",           v:proposal.prazo_entrega}  : null,
    proposal.cond_pagamento ? {l:"Pagamento",          v:proposal.cond_pagamento} : null,
    proposal.pedido_minimo  ? {l:"M\u00ednimo",        v:proposal.pedido_minimo+" unidades"} : null,
  ].filter(Boolean);

  const condHtml = condLinhas.length
    ? "<div class=\"cond-grid\">"+condLinhas.map(c=>"<div class=\"cond-item\"><span class=\"cond-l\">"+c.l+"</span><span class=\"cond-v\">"+c.v+"</span></div>").join("")+"</div>"
    : "";

  const obsHtml = proposal.observacoes
    ? "<p class=\"cond-obs\">"+proposal.observacoes+"</p>"
    : "";

  // Cards de produto para pg1
  const produtosHtml = options.map(function(opt, oi){
    const faixas = opt.faixas||[];
    const imgSrc = (opt.medias && opt.medias.length)
      ? "/api/proposals/"+propId+"/media/"+opt.medias[0].media_id+"/dados"
      : null;
    const precoMin = faixas.length
      ? faixas.reduce(function(acc,f){ return f.preco<acc?f.preco:acc; }, faixas[0].preco)
      : Number(opt.valor_unit||0);

    return (
      "<div class=\"prod-card\" onclick=\"obaShowPage("+(oi+2)+")\">"+
        (imgSrc?"<img src=\""+imgSrc+"\" class=\"prod-img\" loading=\"lazy\" alt=\""+(opt.nome||"")+"\">":"<div class=\"prod-img-placeholder\"></div>")+
        "<div class=\"prod-body\">"+
          "<h3 class=\"prod-nome\">"+toTC(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</h3>"+
          (opt.descricao?"<p class=\"prod-desc\">"+opt.descricao+"</p>":"")+
          (precoMin>0?"<p class=\"prod-preco\" style=\"color:"+T.acento+"\">a partir de "+R(precoMin)+" / un.</p>":"")+
          "<span class=\"prod-ver\" style=\"color:"+T.acento+"\">Ver detalhes &rarr;</span>"+
        "</div>"+
      "</div>"
    );
  }).join("\n");

  // Páginas de detalhe (pg2+)
  const detalhePages = options.map(function(opt, oi){
    const faixas = opt.faixas||[];
    const imgs = (opt.medias||[]).map(function(m){
      return "<img src=\"/api/proposals/"+propId+"/media/"+m.media_id+"/dados\" class=\"det-img\" loading=\"lazy\" alt=\""+(opt.nome||"")+"\">"; 
    }).join("");

    const tabelaFaixas = faixas.length ? (
      "<div class=\"faixas-bloco\">"+
      "<p class=\"faixas-titulo\" style=\"color:"+T.acento+"\">Faixas de pre\u00e7o</p>"+
      "<table class=\"faixas-tab\"><tbody>"+
      faixas.map(function(f){
        const label = f.de!=null && f.ate!=null
          ? ("De "+f.de+" a "+f.ate+" un.")
          : f.de!=null && f.ate==null
            ? ("A partir de "+f.de+" un.")
            : f.ate!=null
              ? ("At\u00e9 "+f.ate+" un.")
              : "Demais";
        return "<tr><td class=\"ft-label\">"+label+"</td><td class=\"ft-price\" style=\"color:"+T.acento+"\">"+R(f.preco)+" <small>/ un.</small></td></tr>";
      }).join("")+
      "</tbody></table></div>"
    ) : (Number(opt.valor_unit||0)>0
      ? "<div class=\"faixas-bloco\"><table class=\"faixas-tab\"><tbody><tr><td class=\"ft-label\">Pre\u00e7o por unidade</td><td class=\"ft-price\" style=\"color:"+T.acento+"\">"+R(opt.valor_unit)+"</td></tr></tbody></table></div>"
      : "");

    const ctaMsg  = encodeURIComponent("Ol\u00e1, Oba Doceria! Vi o cat\u00e1logo"+(dataCom?" de "+dataCom:"")+" e me interessei pela op\u00e7\u00e3o \u201c"+(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"\u201d. Quais os pr\u00f3ximos passos?");
    const ctaHref = obaWpp ? "https://wa.me/55"+obaWpp+"?text="+ctaMsg : "";
    const ctaBtn  = ctaHref ? "<a href=\""+ctaHref+"\" target=\"_blank\" class=\"cta-btn\" style=\"background:"+T.acento+"\">Tenho interesse \u2014 vamos conversar</a>" : "";

    const outrasImgs = (opt.medias||[]).length > 1
      ? "<div class=\"det-gal-extra\">"+(opt.medias.slice(1).map(function(m){return "<img src=\"/api/proposals/"+propId+"/media/"+m.media_id+"/dados\" class=\"det-img-sm\" loading=\"lazy\">";})).join("")+"</div>"
      : "";

    return (
      "<div id=\"pg"+(oi+2)+"\" class=\"det-page\" style=\"display:none\">"+
        "<header class=\"det-bar\" style=\"background:"+T.bg2+"\">"+
          "<button class=\"back-btn\" onclick=\"obaShowPage(1)\">\u2190 Cat\u00e1logo</button>"+
        "</header>"+
        "<div class=\"det-card\">"+
          (imgs?"<img src=\"/api/proposals/"+propId+"/media/"+(opt.medias[0].media_id)+"/dados\" class=\"det-hero\" loading=\"lazy\" alt=\""+(opt.nome||"")+"\">"  :"" )+
          "<div class=\"det-head\">"+
            "<h2 class=\"det-nome\" style=\"color:#1A1A1A\">"+toTC(opt.nome||("Op\u00e7\u00e3o "+(oi+1)))+"</h2>"+
            (opt.descricao?"<p class=\"det-desc\">"+opt.descricao+"</p>":"")+
          "</div>"+
          outrasImgs+
          "<div class=\"det-corpo\">"+tabelaFaixas+ctaBtn+"</div>"+
        "</div>"+
        "<div class=\"det-bottom-nav\" style=\"background:"+T.bg2+"\">"+
          "<button class=\"back-btn\" onclick=\"obaShowPage(1)\">\u2190 Cat\u00e1logo</button>"+
          (obaWpp?"<a href=\"https://wa.me/55"+obaWpp+"\" class=\"wpp-link\">D\u00favidas? WhatsApp</a>":"")+
        "</div>"+
      "</div>"
    );
  }).join("\n");

  const wppHtml   = obaWpp ? "<a href=\"https://wa.me/55"+obaWpp+"\" class=\"footer-wpp\">D\u00favidas? Fale pelo WhatsApp</a>" : "";
  const validHtml = validade ? "<p class=\"footer-valid\">Proposta v\u00e1lida at\u00e9 <strong>"+validade+"</strong></p>" : "";

  const css = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:${T.fundo};font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1A1A1A;line-height:1.55}
.wrap{max-width:620px;margin:0 auto}

/* PG0 */
#pg0{min-height:100svh;display:flex;flex-direction:column;background:linear-gradient(155deg,${T.bg1} 0%,${T.bg2} 55%,${T.bg1} 100%);position:relative;overflow:hidden}
#pg0::after{content:'';position:absolute;bottom:0;left:0;right:0;height:180px;background:linear-gradient(to top,rgba(0,0,0,.25),transparent);pointer-events:none}
.pg0-inner{padding:48px 28px 24px;display:flex;flex-direction:column;flex:1;position:relative;z-index:1}
.pg0-logo{height:44px;object-fit:contain;opacity:.85;margin-bottom:18px;filter:brightness(0) invert(1)}
.pg0-label{font-size:9px;font-weight:800;letter-spacing:5px;text-transform:uppercase;color:${T.acento};display:block;margin-bottom:32px}
.pg0-data{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(38px,10vw,54px);font-weight:400;color:${T.txt};line-height:1.1;margin-bottom:8px;letter-spacing:-1px}
.pg0-empresa{font-size:11px;font-weight:500;color:${T.txtDim};letter-spacing:1.5px;margin-bottom:32px}
.pg0-divider{border:none;border-top:1px solid rgba(255,255,255,.1);margin:0 0 28px}
.pg0-texto{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(16px,4.2vw,20px);font-style:italic;color:${T.txt};line-height:1.75;margin-bottom:8px}
.pg0-rodape{padding:24px 28px 44px;position:relative;z-index:1;margin-top:auto}
.pg0-assinatura{font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;font-style:italic;color:${T.txtDim};display:block;margin-bottom:18px;text-align:center}
.pg0-btn{display:block;width:100%;background:${T.acento};color:#1A1A1A;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:800;letter-spacing:1px;padding:16px 24px;border-radius:12px;border:none;cursor:pointer;text-align:center;text-transform:uppercase}

/* PG1 */
#pg1{display:none}
.pg1-hero-bar{background:${T.bg2};padding:16px 20px 14px;display:flex;align-items:center;justify-content:space-between}
.pg1-logo{height:26px;object-fit:contain;filter:brightness(0) invert(1);opacity:.85}
.pg1-label-bar{font-size:9px;font-weight:700;letter-spacing:3px;color:${T.acento};text-transform:uppercase}
.pg1-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:400;color:#1A1A1A;padding:16px 20px 4px}
.secao-titulo{padding:8px 20px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${T.acento};opacity:.7}

/* Cards de produto */
.prod-card{margin:0 16px 12px;border-radius:14px;overflow:hidden;background:#fff;border:1px solid #EEE;cursor:pointer;display:flex;flex-direction:column;box-shadow:0 1px 6px rgba(0,0,0,.05);transition:box-shadow .15s}
.prod-card:hover{box-shadow:0 4px 18px rgba(0,0,0,.1)}
.prod-img{width:100%;height:200px;object-fit:cover;display:block}
.prod-img-placeholder{width:100%;height:120px;background:#F5F5F5}
.prod-body{padding:14px 16px 16px}
.prod-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:600;color:#1A1A1A;margin-bottom:4px}
.prod-desc{font-size:12px;color:#888;font-style:italic;margin-bottom:8px}
.prod-preco{font-size:12px;font-weight:600;margin-bottom:6px}
.prod-ver{font-size:11px;font-weight:700;letter-spacing:.3px}

/* Condições no rodapé */
.cond-box{margin:16px 16px 0;padding:14px 16px;background:#fff;border-radius:12px;border:1px solid #EEE}
.cond-box-titulo{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.acento};margin-bottom:10px;opacity:.8}
.cond-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cond-item{display:flex;flex-direction:column;gap:2px;padding:6px 8px;background:${T.fundo};border-radius:8px}
.cond-l{font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${T.acento};opacity:.8}
.cond-v{font-size:11px;font-weight:500;color:#333}
.cond-obs{font-size:11px;color:#888;font-style:italic;margin-top:10px;line-height:1.5}

/* Footer pg1 */
.pg1-footer{margin:16px 16px 0;padding:16px 0 32px;border-top:1px solid #EEE;text-align:center}
.footer-valid{font-size:11px;color:#999;margin-bottom:6px}
.footer-valid strong{color:#555}
.footer-wpp{display:inline-block;font-size:12px;font-weight:600;color:${T.acento};text-decoration:none;margin-bottom:8px}
.footer-brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;font-style:italic;color:#CCC;display:block;margin-top:6px}
.btn-pdf{margin-top:12px;background:${T.bg2};color:#fff;border:none;border-radius:10px;padding:10px 24px;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer}

/* Detalhe */
.det-page{background:${T.fundo}}
.det-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;position:sticky;top:0;z-index:10}
.back-btn{background:none;border:1.5px solid rgba(255,255,255,.25);border-radius:24px;padding:5px 14px;font-size:11px;font-weight:600;color:#fff;cursor:pointer}
.det-card{margin:12px 16px 0;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 2px 16px rgba(0,0,0,.07)}
.det-hero{width:100%;max-height:280px;object-fit:cover;display:block}
.det-gal-extra{display:flex;gap:8px;padding:8px 16px 0}
.det-img-sm{width:calc(33.33% - 6px);aspect-ratio:1;object-fit:cover;border-radius:8px}
.det-head{padding:18px 18px 12px;border-bottom:1px solid #EEE}
.det-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;line-height:1.2}
.det-desc{font-size:12px;color:#888;font-style:italic;margin-top:4px}
.det-corpo{padding:16px 18px 20px}
.faixas-bloco{margin-bottom:14px}
.faixas-titulo{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
.faixas-tab{width:100%;border-collapse:collapse}
.faixas-tab td{padding:7px 0;border-bottom:1px solid #F5F5F5;font-size:12px}
.ft-label{color:#333}
.ft-price{text-align:right;font-weight:600;white-space:nowrap}
.ft-price small{font-weight:400;opacity:.6}
.cta-btn{display:block;margin-top:16px;padding:15px;border-radius:12px;text-align:center;color:#1A1A1A;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:.3px}
.det-bottom-nav{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;margin-top:6px}
.wpp-link{font-size:11px;font-weight:600;color:rgba(255,255,255,.7);text-decoration:none}

@page{margin:14mm 18mm}
@media print{
  #pg0{display:block!important;min-height:0!important}
  .pg0-btn,.pg0-assinatura{display:none!important}
  #pg1{display:block!important}
  .det-page{display:block!important;page-break-before:always}
  .det-bar,.det-bottom-nav,.cta-btn,.btn-pdf{display:none!important}
  .wrap{max-width:100%;padding:0}
  .det-card{margin:8px 0 0;box-shadow:none;page-break-inside:avoid}
}`;

  const html = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n"
    +"<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
    +"<meta name=\"robots\" content=\"noindex,nofollow\">\n"
    +"<title>"+(dataCom||"Cat\u00e1logo Sazonal")+(nomeEmpresa?" para "+nomeEmpresa:"")+" \u00b7 Oba Doceria</title>\n"
    +"<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n"
    +"<link href=\"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap\" rel=\"stylesheet\">\n"
    +"<style>"+css+"</style>\n</head>\n<body>\n<div class=\"wrap\">\n\n"

    // PG0 — pura emoção, sem condições
    +"<div id=\"pg0\">\n"
    +"  <div class=\"pg0-inner\">\n"
    +"    <img class=\"pg0-logo\" src=\"https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png\" alt=\"Oba Doceria\" onerror=\"this.style.display='none'\">\n"
    +"    <span class=\"pg0-label\">"+T.label+"</span>\n"
    +"    <p class=\"pg0-data\">"+(dataCom||"Cat\u00e1logo Sazonal")+"</p>\n"
    +(nomeEmpresa?"    <p class=\"pg0-empresa\">Para "+nomeEmpresa+"</p>\n":"")
    +"    <hr class=\"pg0-divider\">\n"
    +"    <p class=\"pg0-texto\">"+paraA+"</p>\n"
    +"  </div>\n"
    +"  <div class=\"pg0-rodape\">\n"
    +"    <span class=\"pg0-assinatura\">Feito com cuidado. Servido com amor.</span>\n"
    +"    <button class=\"pg0-btn\" onclick=\"obaShowPage(1)\">Ver o cat\u00e1logo &rarr;</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    // PG1 — produtos + condições no rodapé
    +"<div id=\"pg1\" style=\"display:none\">\n"
    +"  <div class=\"pg1-hero-bar\">\n"
    +"    <img class=\"pg1-logo\" src=\"https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png\" alt=\"Oba Doceria\" onerror=\"this.style.display='none'\">\n"
    +"    <span class=\"pg1-label-bar\">"+T.label+"</span>\n"
    +"  </div>\n"
    +"  <p class=\"pg1-titulo\">"+(dataCom||"Nossos produtos")+"</p>\n"
    +"  <p class=\"secao-titulo\">Op\u00e7\u00f5es dispon\u00edveis</p>\n"
    +(produtosHtml||"  <p style=\"text-align:center;color:#BBB;padding:24px;font-size:12px\">Nenhuma op\u00e7\u00e3o cadastrada.</p>")
    // Condições no rodapé
    +(condHtml||obsHtml
      ? "\n  <div class=\"cond-box\">\n    <p class=\"cond-box-titulo\">Informa\u00e7\u00f5es do cat\u00e1logo</p>\n    "+condHtml+obsHtml+"\n  </div>"
      : "")
    +"\n  <div class=\"pg1-footer\">\n    "+validHtml+wppHtml
    +"    <span class=\"footer-brand\">Oba Doceria &middot; Um jeito doce de expressar felicidade</span>\n"
    +"    <button class=\"btn-pdf\" onclick=\"window.print()\">Salvar como PDF</button>\n"
    +"  </div>\n"
    +"</div>\n\n"

    // PÁGINAS DETALHE
    +detalhePages

    +"\n</div>\n<script>\n"
    +"function obaShowPage(n){\n"
    +"  var ids=['pg0','pg1'];\n"
    +"  var total="+options.length+";\n"
    +"  for(var i=2;i<=total+1;i++) ids.push('pg'+i);\n"
    +"  ids.forEach(function(id,idx){\n"
    +"    var el=document.getElementById(id); if(!el) return;\n"
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
