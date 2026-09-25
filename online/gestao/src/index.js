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
    validade = null,
    status = "rascunho",
    whatsapp = null,
  } = data;

  await env.DB.prepare(`
    INSERT INTO proposals (proposal_id, cliente, whatsapp, data_evento, convidados, tipo_evento, resumo, validade, status, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(proposal_id) DO UPDATE SET
      cliente=excluded.cliente, whatsapp=excluded.whatsapp,
      data_evento=excluded.data_evento,
      convidados=excluded.convidados, tipo_evento=excluded.tipo_evento,
      resumo=excluded.resumo, validade=excluded.validade,
      status=excluded.status, atualizado_em=excluded.atualizado_em
  `).bind(
    proposalId, cliente, whatsapp, data_evento, convidados, tipo_evento, resumo, validade, status, now, now
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

    const allowed = ["rascunho", "enviada", "aceita", "recusada"];
    if (!allowed.includes(body.status)) {
      return json({ ok: false, error: "status_invalido" }, 400);
    }
    const result = await env.DB.prepare(
      "UPDATE proposals SET status = ?, atualizado_em = ? WHERE proposal_id = ?"
    ).bind(body.status, now, matchStatus[1]).run();

    if (result.meta.changes === 0) return json({ ok: false, error: "nao_encontrada" }, 404);
    return json({ ok: true, proposal_id: matchStatus[1], status: body.status });
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

  // Texto de abertura: campo resumo tem prioridade (editavel pela Central)
  // Se vazio, gera automaticamente com os dados do evento
  const textoAberturaPersonalizado = (proposal.resumo||"").trim();

  const paraA = textoAberturaPersonalizado
    ? textoAberturaPersonalizado   // texto livre editado pela Oba na Central
    : ( dataEvento
        ? "No dia <strong>"+dataEvento+"</strong>, \u00e9 hora de celebrar. Preparamos esta proposta com cuidado especial para tornar esse <strong>"+nomeEvento+"</strong> inesquec\u00edvel."
        : "Preparamos esta proposta com cuidado especial para tornar esse <strong>"+nomeEvento+"</strong> inesquec\u00edvel." );

  // paraB e paraC so aparecem quando o texto e automatico
  const paraB = textoAberturaPersonalizado ? "" : (
    numConvidados
      ? "S\u00e3o <strong>"+numConvidados+" convidados</strong> \u2014 e cada um deles merece um doce feito com ingredientes selecionados, acabamento artesanal e muito amor em cada detalhe."
      : "Cada doce \u00e9 feito com ingredientes selecionados, acabamento artesanal e muito amor em cada detalhe."
  );

  const paraC = textoAberturaPersonalizado ? "" : (
    (nomeCliente?"<strong>"+nomeCliente+"</strong>, preparamos ":"Preparamos ")+
    "<strong>"+numCenarios+" cen\u00e1rio"+(numCenarios!==1?"s":"")+"</strong> para voc\u00ea escolher o que mais combina com o seu momento."
  );

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
      if(c.items&&c.items.length){
        return c.items.map(function(it){
          const parts2=(it.ref_id||"").split(":");
          const p=Number(it.preco_unit||0)||(saborPM[parts2[1]]||0);
          return "<tr><td class=\"td-n\">"+it.descricao+"</td><td class=\"td-q\">"+it.qtd+"&nbsp;doces</td><td class=\"td-v\">"+R(it.qtd*p)+"</td></tr>";
        }).join("");
      } else if(c.total){
        const ref=catPM[c.cid]||0;
        return "<tr><td class=\"td-n\">"+nm+"</td><td class=\"td-q\">"+c.total+"&nbsp;doces</td><td class=\"td-v\">"+(ref>0?R(c.total*ref):"&mdash;")+"</td></tr>";
      }
      return "";
    }).join("");

    const livreLinhas=livres.map(function(it){
      return "<tr><td class=\"td-n\">"+it.descricao+"</td><td class=\"td-q\"></td><td class=\"td-v\">"+R(it.preco_unit)+"</td></tr>";
    }).join("");

    const descLinha=desc>0?"<tr class=\"tr-d\"><td colspan=\"2\">Desconto</td><td>&minus;&nbsp;"+R(desc)+"</td></tr>":"";
    const introTexto=(s.texto_publico||"").trim()||meta.intro;

    const ctaMsg=encodeURIComponent(
      "Oba! Recebi a proposta e quero seguir com o Cen\u00e1rio "+(si+1)+" \u2013 "+meta.rotulo+
      " ("+R(total)+"). Vamos fechar os detalhes?"
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
  const infoEventoPg0 = (proposal.tipo_evento||dataEvento||proposal.convidados) ? (
    "<div class=\"ab-evento\">"+
    (proposal.tipo_evento?"<div class=\"ab-ev-item\"><span class=\"ab-ev-label\">Evento</span><span class=\"ab-ev-val\">"+proposal.tipo_evento+"</span></div>":"")+
    (dataEvento?"<div class=\"ab-ev-item\"><span class=\"ab-ev-label\">Data</span><span class=\"ab-ev-val\">"+dataEvento+"</span></div>":"")+
    (proposal.convidados?"<div class=\"ab-ev-item\"><span class=\"ab-ev-label\">Convidados</span><span class=\"ab-ev-val\">"+proposal.convidados+" pessoas</span></div>":"")+
    "</div>"
  ) : "";

  const infoEventoPg1 = (proposal.tipo_evento||dataEvento||proposal.convidados) ? (
    "<div class=\"res-ev\">"+
    (proposal.tipo_evento?"<div class=\"res-ev-item\"><span class=\"res-ev-lbl\">Evento</span><span class=\"res-ev-val\">"+proposal.tipo_evento+"</span></div>":"")+
    (dataEvento?"<div class=\"res-ev-item\"><span class=\"res-ev-lbl\">Data</span><span class=\"res-ev-val\">"+dataEvento+"</span></div>":"")+
    (proposal.convidados?"<div class=\"res-ev-item\"><span class=\"res-ev-lbl\">Convidados</span><span class=\"res-ev-val\">"+proposal.convidados+" pessoas</span></div>":"")+
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
<title>${nomeCliente} &middot; Proposta Oba Doceria</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,300;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#F7F2EC;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#3B2A1E;line-height:1.5}
.page{max-width:600px;margin:0 auto;padding:0 16px}

/* PG0 — ABERTURA */
#pg0{min-height:100svh;display:flex;flex-direction:column;background:linear-gradient(160deg,#FFF8EE 0%,#FDF0D8 55%,#F9E4BE 100%)}
.ab-topo{padding:32px 24px 0;text-align:center}
.ab-logo{height:40px;object-fit:contain;opacity:.9;margin-bottom:20px}
.ab-label{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C8922A;margin-bottom:2px}
.ab-cliente{font-family:'Cormorant Garamond',Georgia,serif;font-size:34px;font-weight:600;color:#3B2A1E;line-height:1.1;margin-bottom:16px}
.ab-evento{display:flex;flex-wrap:wrap;justify-content:center;background:#fff9;backdrop-filter:blur(4px);border:1px solid #EDD9C0;border-radius:12px;overflow:hidden;margin:0 auto}
.ab-ev-item{flex:1;min-width:0;text-align:center;padding:10px 12px;border-right:1px solid #EDD9C0}
.ab-ev-item:last-child{border-right:none}
.ab-ev-label{font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C8922A;display:block;margin-bottom:2px}
.ab-ev-val{font-size:12px;font-weight:600;color:#3B2A1E;display:block}
.ab-corpo{padding:20px 24px;flex:1}
.ab-p{font-family:'Cormorant Garamond',Georgia,serif;font-size:16.5px;color:#5D3A1A;line-height:1.85;margin-bottom:14px}
.ab-p:last-of-type{margin-bottom:0}
.ab-p strong{font-weight:600;color:#3B2A1E}
.ab-citacao{margin-top:18px;padding:14px 16px;border-left:2px solid #C8922A;background:#FFFCF4;font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-style:italic;color:#9B6A3A;line-height:1.7}
.ab-rodape{padding:20px 24px 32px;text-align:center}
.ab-ornamento{font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;font-style:italic;color:#C8922A;opacity:.7;margin-bottom:16px}
.ab-btn{display:inline-block;background:#3B2A1E;color:#F9E8C8;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;letter-spacing:.8px;padding:14px 32px;border-radius:50px;border:none;cursor:pointer;text-transform:uppercase}
.ab-btn:hover{opacity:.85}

/* PG1 — RESUMO */
#pg1{display:none}
.res-hero{padding:20px 20px 14px;text-align:center;background:#FFFDF8;border-bottom:1px solid #EDD9C0}
.res-logo{height:28px;object-fit:contain;opacity:.82;margin-bottom:10px}
.res-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:19px;font-weight:400;color:#3B2A1E;margin-bottom:2px}
.res-sub{font-size:10px;color:#9B7A60}
.res-sub strong{color:#5D3A1A;font-weight:600}
.res-ev{display:flex;justify-content:center;border-bottom:1px solid #EDD9C0;background:#FFFDF8}
.res-ev-item{flex:1;text-align:center;padding:8px 10px;border-right:1px solid #EDD9C0}
.res-ev-item:last-child{border-right:none}
.res-ev-lbl{font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ccc;display:block}
.res-ev-val{font-size:11px;font-weight:600;color:#3B2A1E;display:block}
.res-secao{padding:12px 16px 4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#C8922A}
.rc{margin:0 16px 8px;border-radius:10px;border:1px solid #EDD9C0;border-left-width:3px;background:#fff;padding:12px 14px;box-shadow:0 1px 6px rgba(60,35,20,.04)}
.rc-linha{display:flex;align-items:center;gap:10px;justify-content:space-between}
.rc-esq{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.rc-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600;line-height:1;flex-shrink:0;opacity:.6}
.rc-badge{display:block;font-size:13px;font-weight:700;color:#3B2A1E;margin-bottom:3px}
.rc-pills{display:flex;flex-wrap:wrap;gap:3px}
.rc-pill{font-size:10px;font-weight:500;background:#F5EDE4;color:#9B7A60;padding:2px 7px;border-radius:20px}
.rc-dir{text-align:right;flex-shrink:0}
.rc-valor{display:block;font-size:17px;font-weight:700;line-height:1;margin-bottom:7px}
.rc-cta{display:block;padding:6px 13px;border-radius:20px;border:none;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
.rc-cta:hover{opacity:.88}
.res-footer-nav{padding:10px 16px 0;text-align:center}
.res-voltar-ab{background:none;border:none;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;color:#bbb;cursor:pointer;text-decoration:underline;text-underline-offset:3px}

/* DETALHE */
.det-page{padding-bottom:8px}
.det-topbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 14px;background:#fff;border-bottom:1px solid #EDD9C0;position:sticky;top:0;z-index:10}
.det-voltar{background:none;border:1.5px solid #EDD9C0;border-radius:24px;padding:5px 13px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;color:#7A5A40;cursor:pointer;white-space:nowrap}
.det-voltar:hover{background:#FAF5EE}
.det-navbtns{display:flex;gap:5px;flex-wrap:wrap}
.nav-outro{background:none;border:1.5px solid;border-radius:24px;padding:4px 11px;font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap}
.nav-outro:hover{opacity:.75}
.c-card{margin:10px 16px 0;border-radius:14px;border:1px solid #EDD9C0;border-top-width:4px;overflow:hidden;background:#fff;box-shadow:0 2px 14px rgba(60,35,20,.07)}
.c-cabecalho{padding:18px 20px 13px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.c-esq{flex:1;min-width:0}
.c-rotulo{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:4px}
.c-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:23px;font-weight:400;color:#3B2A1E;line-height:1.2}
.c-dir{text-align:right;flex-shrink:0}
.c-dpc{display:block;font-size:10px;color:#ccc;margin-bottom:3px}
.c-total{font-size:24px;font-weight:700;display:block;line-height:1}
.c-intro{padding:0 20px 13px;border-bottom:1px solid #F0E8DE}
.c-intro p{font-size:12.5px;color:#7A5A40;line-height:1.65}
.c-corpo{padding:13px 20px 18px}
.tab{width:100%;border-collapse:collapse}
.tab td{padding:8px 0;border-bottom:1px solid #F5EDE4;font-size:12.5px;vertical-align:middle}
.td-n{color:#3B2A1E;font-weight:500}
.td-q{text-align:center;color:#ccc;font-size:11px;padding:8px 8px;white-space:nowrap}
.td-v{text-align:right;font-weight:600;color:#5D3A1A;white-space:nowrap}
.tr-d td{border-bottom:none;padding:7px 0 0;font-size:11px;color:#059669}
.tr-d td:last-child{text-align:right}
.tr-tot td{border:none;padding:12px 0 0;font-size:13px;font-weight:700;border-top:2px solid #EDD9C0}
.tr-tot td:last-child{text-align:right;font-size:18px;font-weight:700}
.cta-btn{display:block;margin:14px 0 0;padding:13px;border-radius:11px;text-align:center;color:#fff;font-weight:600;font-size:12.5px;text-decoration:none;letter-spacing:.2px}
.cta-btn:hover{opacity:.88}
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
@page{margin:12mm 14mm}
@media print{
  body{background:#fff}
  /* Capa e resumo juntos na pagina 1 do PDF */
  #pg0{display:block!important;min-height:0!important;background:none!important;padding:0}
  .ab-btn,.ab-ornamento,.ab-citacao{display:none!important}
  .ab-rodape{padding:8px 0 12px}
  #pg1{display:block!important}
  #pg1::before{content:"";display:block;border-top:1px solid #EDD9C0;margin:12px 0}
  .res-voltar-ab,.res-footer-nav,.rc-cta{display:none!important}
  /* Cada cenario em nova pagina */
  .det-page{display:block!important;page-break-before:always;page-break-inside:avoid}
  .det-topbar,.det-rodape-nav,.cta-btn,.btn-pdf{display:none!important}
  .page{max-width:100%;padding:0}
  .c-card{margin:8px 0 0;box-shadow:none;border-color:#ddd;page-break-inside:avoid}
  .rc{margin:0 0 6px;page-break-inside:avoid}
  .footer{border-top:1px solid #EDD9C0;padding:10px 0 0;margin-top:12px}
}
</style>
</head>
<body>
<div class="page">

<div id="pg0">
  <div class="ab-topo">
    <img class="ab-logo" src="https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png" alt="Oba Doceria" onerror="this.style.display='none'">
    <p class="ab-label">Proposta de Or&ccedil;amento</p>
    <h1 class="ab-cliente">${nomeCliente||"Proposta Especial"}</h1>
    ${infoEventoPg0}
  </div>
  <div class="ab-corpo">
    <p class="ab-p">${paraA}</p>
    <p class="ab-p">${paraB}</p>
    <p class="ab-p">${paraC}</p>
    ${citacaoHtml}
  </div>
  <div class="ab-rodape">
    <p class="ab-ornamento">Feito com cuidado. Servido com amor.</p>
    <button class="ab-btn" onclick="obaShowPage(1)">Ver minha proposta &rarr;</button>
  </div>
</div>

<div id="pg1" style="display:none">
  <div class="res-hero">
    <img class="res-logo" src="https://raw.githubusercontent.com/obadoceria-gif/cardapio/main/Images/Logo_Oba/logo-horizontal.png" alt="Oba Doceria" onerror="this.style.display='none'">
    <p class="res-titulo">Cen&aacute;rios preparados para voc&ecirc;</p>
    <p class="res-sub">${resSub}</p>
  </div>
  ${infoEventoPg1}
  <p class="res-secao">Escolha o seu cen&aacute;rio</p>
  ${resumoCards}
  <div class="res-footer-nav">
    <button class="res-voltar-ab" onclick="obaShowPage(0)">&#8592; Voltar &agrave; apresenta&ccedil;&atilde;o</button>
  </div>
  <div class="footer">
    ${validadeHtml}
    ${wppHtml}
    <p class="footer-brand">Oba Doceria &middot; Um jeito doce de expressar felicidade</p>
    <button class="btn-pdf" onclick="window.print()">Salvar como PDF</button>
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
