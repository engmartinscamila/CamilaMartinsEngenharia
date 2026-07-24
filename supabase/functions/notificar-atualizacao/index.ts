import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_UID =
  Deno.env.get("ADMIN_UID") ??
  "5c9d7a0e-0495-4e96-8561-1d7f220be154";

function resposta(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function escaparHtml(valor: unknown) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return resposta({ erro: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("NOTIFICATION_ADMIN_EMAIL");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  const siteUrl =
    Deno.env.get("SITE_URL") ?? "https://camilamartinsengenharia.com.br";

  if (!supabaseUrl || !serviceRoleKey) {
    return resposta({ erro: "Supabase não configurado na função." }, 503);
  }

  if (!resendApiKey || !adminEmail || !fromEmail) {
    return resposta({
      enviado: false,
      motivo: "Configure RESEND_API_KEY, NOTIFICATION_ADMIN_EMAIL e NOTIFICATION_FROM_EMAIL.",
    });
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");

  if (!jwt) {
    return resposta({ erro: "Sessão ausente." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);

  if (authError || !authData.user) {
    return resposta({ erro: "Sessão inválida." }, 401);
  }

  let body: {
    tipo?: string;
    cliente_id?: string;
    projeto_id?: string | null;
    titulo?: string;
    mensagem?: string;
  };

  try {
    body = await request.json();
  } catch {
    return resposta({ erro: "Corpo da requisição inválido." }, 400);
  }

  if (!body.cliente_id || !body.tipo || !body.titulo) {
    return resposta({ erro: "Dados obrigatórios ausentes." }, 400);
  }

  const callerIsAdmin = authData.user.id === ADMIN_UID;
  const isClientRequest = body.tipo === "solicitacao_criada";

  const { data: cliente, error: clienteError } = await admin
    .from("clientes")
    .select("id, nome, email, auth_id")
    .eq("id", body.cliente_id)
    .maybeSingle();

  if (clienteError || !cliente) {
    return resposta({ erro: "Cliente não encontrado." }, 404);
  }

  if (
    !callerIsAdmin &&
    (!isClientRequest || cliente.auth_id !== authData.user.id)
  ) {
    return resposta({ erro: "Operação não autorizada." }, 403);
  }

  const destinatario = isClientRequest ? adminEmail : cliente.email;

  if (!destinatario) {
    return resposta({
      enviado: false,
      motivo: "Destinatário sem e-mail cadastrado.",
    });
  }

  const assunto = isClientRequest
    ? `Nova solicitação de ${cliente.nome || "cliente"}`
    : `Atualização do seu projeto: ${body.titulo}`;
  const destinoPortal = isClientRequest
    ? `${siteUrl}/solicitacoes.html`
    : `${siteUrl}/portal.html`;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [destinatario],
      subject: assunto,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#11283f">
          <h1 style="font-family:Georgia,serif;font-weight:400">${escaparHtml(assunto)}</h1>
          <p>Olá, ${escaparHtml(isClientRequest ? "Camila" : cliente.nome || "cliente")}.</p>
          <p>${escaparHtml(body.mensagem || "Há uma nova atualização disponível.")}</p>
          <p><strong>${escaparHtml(body.titulo)}</strong></p>
          <p>
            <a href="${escaparHtml(destinoPortal)}"
               style="display:inline-block;padding:12px 18px;background:#0b2b4c;color:#fff;text-decoration:none">
              Acessar o portal
            </a>
          </p>
          <p style="font-size:12px;color:#64748b">
            Camila Martins Engenharia
          </p>
        </div>
      `,
    }),
  });

  const emailData = await emailResponse.json().catch(() => ({}));

  if (!emailResponse.ok) {
    console.error("Erro do provedor de e-mail:", emailData);
    return resposta({
      enviado: false,
      motivo: "O provedor de e-mail recusou o envio.",
    }, 502);
  }

  return resposta({ enviado: true, id: emailData.id ?? null });
});
