import { withSupabase } from "npm:@supabase/server@1.5.3";

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://camilamartinsengenharia.com.br").replace(/\/$/, "");
const ALLOWED_ORIGINS = new Set([
  "https://camilamartinsengenharia.com.br",
  "https://www.camilamartinsengenharia.com.br",
]);
const GENERIC_MESSAGE = "Se este e-mail estiver autorizado, enviaremos um link seguro para criar ou redefinir a senha. Verifique também a caixa de spam.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://camilamartinsengenharia.com.br";
  return {
    "Access-Control-Allow-Origin": allowed,
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

  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    if (!EMAIL_PATTERN.test(email)) return json(request, { ok: true, message: GENERIC_MESSAGE });

    const admin = ctx.supabaseAdmin;
    const { data: client, error: clientError } = await admin
      .from("clientes")
      .select("id,nome,email,auth_id,status")
      .ilike("email", email)
      .eq("status", "ativo")
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client?.auth_id) return json(request, { ok: true, message: GENERIC_MESSAGE });

    if (!(await consumeRateLimit(admin, email))) return json(request, { ok: true, message: GENERIC_MESSAGE });

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
    console.error("client-password-link", error instanceof Error ? error.message : error);
    return json(request, { ok: false, message: "Não foi possível enviar o link agora. Tente novamente em alguns minutos." }, 503);
  }
});

Deno.serve(handler);
