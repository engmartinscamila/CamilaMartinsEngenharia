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
          storage: "cloudflare-r2",
          catalog: "github"
        }, 200, request, env);
      }

      if (url.pathname === "/api/manifest" && method === "GET") {
        return getManifestFromGitHub(request, env);
      }

      if (url.pathname === "/api/manifest" && method === "PUT") {
        await requireAdmin(request, env);
        return putManifestOnGitHub(request, env);
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

async function getManifestFromGitHub(request, env) {
  const file = await githubReadFile(env);

  let data;
  try {
    data = JSON.parse(file.text);
  } catch {
    throw httpError(502, "O galeria.json do GitHub está inválido.");
  }

  if (!Array.isArray(data?.projetos)) {
    throw httpError(502, 'O galeria.json precisa conter o array "projetos".');
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders(request, env),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=30",
      "x-cme-catalog-source": "github"
    }
  });
}

async function putManifestOnGitHub(request, env) {
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

  const current = await githubReadFile(env);
  const normalized = JSON.stringify(data, null, 2) + "\n";

  if (normalized === normalizeExistingJson(current.text)) {
    return json({
      ok: true,
      changed: false,
      sha: current.sha,
      message: "O catálogo já estava atualizado."
    }, 200, request, env);
  }

  const apiUrl = githubContentsUrl(env);
  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: githubHeaders(env),
    body: JSON.stringify({
      message: "Atualiza galeria pelo painel administrativo",
      content: utf8ToBase64(normalized),
      sha: current.sha,
      branch: env.GITHUB_BRANCH || "main"
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      result?.message ||
      "O GitHub recusou a atualização do galeria.json.";
    throw httpError(response.status === 409 ? 409 : 502, message);
  }

  return json({
    ok: true,
    changed: true,
    commitSha: result?.commit?.sha || null,
    contentSha: result?.content?.sha || null
  }, 200, request, env);
}

async function githubReadFile(env) {
  requireGitHubConfig(env);

  const response = await fetch(
    githubContentsUrl(env) +
      "?ref=" +
      encodeURIComponent(env.GITHUB_BRANCH || "main"),
    {
      headers: githubHeaders(env)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw httpError(
      502,
      data?.message ||
        "Não foi possível ler o galeria.json no GitHub."
    );
  }

  if (!data?.content || !data?.sha) {
    throw httpError(502, "Resposta inesperada do GitHub.");
  }

  return {
    sha: data.sha,
    text: base64ToUtf8(String(data.content).replace(/\s/g, ""))
  };
}

function githubContentsUrl(env) {
  const owner = encodeURIComponent(env.GITHUB_OWNER || "");
  const repo = encodeURIComponent(env.GITHUB_REPO || "");
  const path = String(env.GITHUB_MANIFEST_PATH || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function githubHeaders(env) {
  return {
    authorization: "Bearer " + env.GITHUB_TOKEN,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "cme-public-media-worker"
  };
}

function requireGitHubConfig(env) {
  const required = [
    "GITHUB_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "GITHUB_MANIFEST_PATH"
  ];

  const missing = required.filter(name => !env[name]);
  if (missing.length) {
    throw httpError(
      500,
      "Worker sem configuração do GitHub: " + missing.join(", ")
    );
  }
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
  const maxUploadBytes = Number(env.MAX_UPLOAD_BYTES || 99614720);

  if (contentLength > 0 && contentLength > maxUploadBytes) {
    throw httpError(413, "Arquivo excede o limite configurado de upload.");
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
  if (!head) {
    throw httpError(500, "O R2 não confirmou o arquivo após o upload.");
  }

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
      headers.set(
        "content-range",
        `bytes ${start}-${end}/${object.size}`
      );
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
  return (
    url.origin +
    "/media/" +
    key.split("/").map(encodeURIComponent).join("/")
  );
}

function normalizeKey(value) {
  return String(value || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .trim();
}

function normalizeExistingJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2) + "\n";
  } catch {
    return text;
  }
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }

  return btoa(binary);
}

function base64ToUtf8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
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
    vary: "Origin"
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
