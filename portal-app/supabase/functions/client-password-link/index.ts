import { withSupabase } from "npm:@supabase/server@1.5.3";

const PRODUCTION_SITE_URL = "https://camilamartinsengenharia.com.br";
const projectRef = new URL(Deno.env.get("SUPABASE_URL") ?? "https://unconfigured.invalid").hostname.split(".")[0];
const production = projectRef === "hghtwlopqztfcosfxafd";
const SITE_URL = (Deno.env.get("SITE_URL") ?? (production ? PRODUCTION_SITE_URL : "")).replace(/\/$/, "");
const validSiteUrl = (() => {
  try {
    const url = new URL(SITE_URL);
    return url.protocol === "https:" && url.origin === SITE_URL &&
      (production || !["camilamartinsengenharia.com.br", "www.camilamartinsengenharia.com.br"].includes(url.hostname));
  } catch {
    return false;
  }
})();
const ALLOWED_ORIGINS = new Set([
  ...(validSiteUrl ? [SITE_URL] : []),
  ...(production ? ["https://www.camilamartinsengenharia.com.br"] : []),
]);
const GENERIC_MESSAGE = "Se este e-mail estiver autorizado, enviaremos um link seguro para criar ou redefinir a senha. Verifique também a caixa de spam.";
const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

async function readRequestBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new Error("request_too_large");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("request_too_large");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(admin: any, email: string) {
  const { data, error } = await admin.rpc("service_consume_password_link_rate_limit", {
    p_key_hash: await sha256(email),
  });
  if (error) throw new Error("Controle de solicitações temporariamente indisponível.");
  return data === true;
}

async function sendEmail(email: string, name: string, secureLink: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Canal de e-mail indisponível.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Acesso ao Portal do Cliente - Camila Martins Engenharia",
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#11283f"><h2>Acesso ao Portal do Cliente</h2><p>Olá, ${escapeHtml(name || "cliente")}.</p><p>Use o botão abaixo para criar ou redefinir sua senha. O link é pessoal e temporário.</p><p><a href="${escapeHtml(secureLink)}" style="display:inline-block;padding:13px 20px;background:#0b2b4c;color:#fff;text-decoration:none">Criar ou redefinir minha senha</a></p><p style="font-size:12px;color:#64748b">Se você não solicitou este acesso, ignore esta mensagem. Sua senha atual não será alterada.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Falha no provedor de e-mail (${response.status}).`);
}

const handler = withSupabase({ auth: "publishable" }, async (request: Request, ctx: any) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { ok: false }, 405);

  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { ok: false }, 403);
  if (!validSiteUrl) return json(request, { ok: false, message: "Canal de acesso temporariamente indisponível." }, 503);

  try {
    const body = await readRequestBody(request);
    const email = normalizeEmail(body?.email);
    if (!EMAIL_PATTERN.test(email)) return json(request, { ok: true, message: GENERIC_MESSAGE });

    const admin = ctx.supabaseAdmin;
    // Consume the quota before looking the address up. This keeps unknown and
    // known addresses on the same path and limits repeated database probing.
    if (!(await consumeRateLimit(admin, email))) return json(request, { ok: true, message: GENERIC_MESSAGE });

    const { data: client, error: clientError } = await admin
      .from("clientes")
      .select("id,nome,email,auth_id,status")
      .ilike("email", email)
      .eq("status", "ativo")
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client?.auth_id) return json(request, { ok: true, message: GENERIC_MESSAGE });

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(client.auth_id);
    const user = !userError ? userData?.user : null;
    if (!user?.email || user.email.toLowerCase() !== email) return json(request, { ok: true, message: GENERIC_MESSAGE });

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email: user.email });
    if (linkError || !linkData?.properties?.hashed_token) throw linkError ?? new Error("Token não gerado.");

    const link = new URL(`${SITE_URL}/redefinir-senha.html`);
    link.searchParams.set("token_hash", linkData.properties.hashed_token);
    link.searchParams.set("type", "recovery");
    await sendEmail(user.email, client.nome ?? "cliente", link.toString());

    return json(request, { ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    if (error instanceof Error && error.message === "request_too_large") {
      return json(request, { ok: false, message: "Requisição inválida." }, 413);
    }
    console.error("client-password-link", error instanceof Error ? error.message : "erro_interno");
    return json(request, { ok: false, message: "Não foi possível enviar o link agora. Tente novamente em alguns minutos." }, 503);
  }
});

Deno.serve(handler);
