const MANIFEST_KEY = "portfolio/galeria.json";
const PUBLIC_PREFIX = "portfolio/";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://camilamartinsengenharia.com.br",
  "https://www.camilamartinsengenharia.com.br"
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    try {
      if (url.pathname === "/health" && method === "GET") {
        return json({
          ok: true,
          service: "cme-public-media",
          storage: "cloudflare-r2"
        }, 200, request, env);
      }

      if (url.pathname === "/api/manifest" && method === "GET") {
        return getManifest(request, env);
      }

      if (url.pathname === "/api/manifest" && method === "PUT") {
        await requireAdmin(request, env);
        return putManifest(request, env);
      }

      if (url.pathname === "/api/upload" && method === "PUT") {
        await requireAdmin(request, env);
        return uploadObject(request, env, url);
      }

      if (url.pathname === "/api/object" && method === "DELETE") {
        await requireAdmin(request, env);
        return deleteObject(request, env, url);
      }

      if (url.pathname.startsWith("/media/") && method === "GET") {
        const key = decodeURIComponent(url.pathname.slice("/media/".length));
        return serveObject(request, env, key);
      }

      return json({ ok: false, error: "Rota não encontrada." }, 404, request, env);
    } catch (error) {
      const status = Number(error?.status || 500);
      return json(
        { ok: false, error: error?.message || "Erro interno." },
        status,
        request,
        env
      );
    }
  }
};

async function getManifest(request, env) {
  const object = await env.MEDIA_BUCKET.get(MANIFEST_KEY);

  if (!object) {
    return json(
      { ok: false, error: "Manifesto ainda não criado.", projetos: [] },
      404,
      request,
      env
    );
  }

  const text = await object.text();

  return new Response(text, {
    status: 200,
    headers: {
      ...corsHeaders(request, env),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=60",
      etag: object.httpEtag
    }
  });
}

async function putManifest(request, env) {
  const raw = await request.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw httpError(400, "Manifesto JSON inválido.");
  }

  if (!Array.isArray(data?.projetos)) {
    throw httpError(400, 'O manifesto precisa conter o array "projetos".');
  }

  const normalized = JSON.stringify(data, null, 2);

  await env.MEDIA_BUCKET.put(MANIFEST_KEY, normalized, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=60"
    },
    customMetadata: {
      updatedAt: new Date().toISOString()
    }
  });

  return json({
    ok: true,
    key: MANIFEST_KEY,
    url: publicUrl(request, MANIFEST_KEY)
  }, 200, request, env);
}

async function uploadObject(request, env, url) {
  const key = normalizeKey(url.searchParams.get("key"));

  if (!key || !key.startsWith(PUBLIC_PREFIX)) {
    throw httpError(400, 'O parâmetro "key" deve começar com "portfolio/".');
  }

  const contentType =
    request.headers.get("content-type") ||
    "application/octet-stream";

  const contentLength = Number(request.headers.get("content-length") || 0);
  const maxUploadBytes = Number(env.MAX_UPLOAD_BYTES || 524288000);

  if (contentLength > 0 && contentLength > maxUploadBytes) {
    throw httpError(413, "Arquivo excede o limite configurado.");
  }

  await env.MEDIA_BUCKET.put(key, request.body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable"
    },
    customMetadata: {
      uploadedAt: new Date().toISOString()
    }
  });

  const head = await env.MEDIA_BUCKET.head(key);
  if (!head) throw httpError(500, "O R2 não confirmou o arquivo após o upload.");

  return json({
    ok: true,
    key,
    size: head.size,
    url: publicUrl(request, key)
  }, 201, request, env);
}

async function deleteObject(request, env, url) {
  const key = normalizeKey(url.searchParams.get("key"));

  if (!key || !key.startsWith(PUBLIC_PREFIX)) {
    throw httpError(400, 'O parâmetro "key" deve começar com "portfolio/".');
  }

  if (key === MANIFEST_KEY) {
    throw httpError(400, "O manifesto não pode ser apagado por esta rota.");
  }

  await env.MEDIA_BUCKET.delete(key);

  const stillExists = await env.MEDIA_BUCKET.head(key);
  if (stillExists) {
    throw httpError(500, "O R2 ainda encontrou o arquivo após a exclusão.");
  }

  return json({ ok: true, key, deleted: true }, 200, request, env);
}

async function serveObject(request, env, key) {
  key = normalizeKey(key);

  if (!key || !key.startsWith(PUBLIC_PREFIX)) {
    return new Response("Not found", {
      status: 404,
      headers: corsHeaders(request, env)
    });
  }

  const object = await env.MEDIA_BUCKET.get(key, {
    onlyIf: request.headers,
    range: request.headers
  });

  if (!object) {
    return new Response("Not found", {
      status: 404,
      headers: corsHeaders(request, env)
    });
  }

  const headers = new Headers(corsHeaders(request, env));
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");

  const bodyPresent = "body" in object;
  let status = bodyPresent ? 200 : 412;

  if (bodyPresent && object.range) {
    status = 206;

    if (
      typeof object.range.offset === "number" &&
      typeof object.range.length === "number"
    ) {
      const start = object.range.offset;
      const end = start + object.range.length - 1;
      headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    }
  }

  return new Response(bodyPresent ? object.body : undefined, {
    status,
    headers
  });
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    throw httpError(401, "Sessão administrativa ausente.");
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ADMIN_UID) {
    throw httpError(500, "Worker sem configuração de autenticação.");
  }

  const response = await fetch(
    env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user",
    {
      headers: {
        authorization: auth,
        apikey: env.SUPABASE_ANON_KEY
      }
    }
  );

  if (!response.ok) {
    throw httpError(401, "Sessão administrativa inválida ou expirada.");
  }

  const user = await response.json();

  if (String(user?.id || "") !== String(env.ADMIN_UID)) {
    throw httpError(403, "Acesso restrito à administradora.");
  }

  return user;
}

function publicUrl(request, key) {
  const url = new URL(request.url);
  return `${url.origin}/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeKey(value) {
  return String(value || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .trim();
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  const allowed = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request, env),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
