// CAMILA MARTINS ENGENHARIA — NOTIFICAÇÕES V2
// Compatível com as chaves secretas atuais e legadas do Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { protegerDadosConfidenciais } from "./privacy.js";

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

function obterChaveAdministrativa() {
  const chaveLegada = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (chaveLegada) return chaveLegada;

  try {
    const chaves = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    );
    return chaves.default ?? "";
  } catch {
    return "";
  }
}

function escaparHtml(valor: unknown) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTelefoneBrasil(valor: unknown) {
  let digitos = String(valor ?? "").replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return /^55\d{10,11}$/.test(digitos) ? `+${digitos}` : null;
}

function mascararDestino(valor: unknown) {
  const texto = String(valor ?? "");
  if (texto.includes("@")) {
    const [local, dominio] = texto.split("@");
    return `${local.slice(0, 2)}***@${dominio ?? ""}`;
  }
  const digitos = texto.replace(/\D/g, "");
  return digitos.length >= 4 ? `***${digitos.slice(-4)}` : "***";
}

async function enviarSms(telefoneInformado: unknown, mensagem: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    return { enviado: false, status: "nao_configurado", motivo: "Canal SMS ainda não configurado." };
  }

  const telefone = normalizarTelefoneBrasil(telefoneInformado);
  if (!telefone) {
    return { enviado: false, status: "sem_destino", motivo: "Telefone ausente ou inválido." };
  }

  const form = new URLSearchParams({
    To: telefone,
    From: fromNumber,
    Body: mensagem.slice(0, 320),
  });

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Provedor de SMS recusou a notificação:", response.status);
      return { enviado: false, status: "falhou", motivo: "O provedor de SMS recusou o envio." };
    }

    return { enviado: true, status: "enviado", id: data.sid ?? null };
  } catch {
    return { enviado: false, status: "falhou", motivo: "Falha de comunicação com o provedor de SMS." };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return resposta({ erro: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = obterChaveAdministrativa();
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
    notificar_celular?: boolean;
    portal_path?: string;
  };

  try {
    body = await request.json();
  } catch {
    return resposta({ erro: "Corpo da requisição inválido." }, 400);
  }

  if (!body.cliente_id || !body.tipo || !body.titulo) {
    return resposta({ erro: "Dados obrigatórios ausentes." }, 400);
  }

  const tituloProtegido = protegerDadosConfidenciais(body.titulo).slice(0, 160);
  const mensagemProtegida = protegerDadosConfidenciais(
    body.mensagem || "Há uma nova atualização disponível.",
  );

  const callerIsAdmin = authData.user.id === ADMIN_UID;
  const isClientRequest = ["solicitacao_criada", "solicitacao_respondida"].includes(body.tipo);

  const { data: cliente, error: clienteError } = await admin
    .from("clientes")
    .select("id, nome, email, telefone, auth_id")
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
    ? `${body.tipo === "solicitacao_respondida" ? "Nova resposta" : "Nova solicitação"} de ${cliente.nome || "cliente"}`
    : `Atualização do seu projeto: ${tituloProtegido}`;
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
          <p>${escaparHtml(mensagemProtegida)}</p>
          <p><strong>${escaparHtml(tituloProtegido)}</strong></p>
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

  const caminhosCliente = new Set([
    "portal.html",
    "solicitacoes-cliente.html",
    "agenda-cliente.html",
    "documentos-cliente.html",
    "biblioteca-cliente.html",
  ]);
  const caminhoSolicitado = String(body.portal_path ?? "portal.html").replace(/^\/+/, "");
  const caminhoCliente = caminhosCliente.has(caminhoSolicitado)
    ? caminhoSolicitado
    : "portal.html";
  const destinoCelular = `${siteUrl}/${caminhoCliente}`;
  const sms = callerIsAdmin && body.notificar_celular === true
    ? await enviarSms(
      cliente.telefone,
      `Camila Martins Engenharia: ${tituloProtegido}. ${mensagemProtegida} Acesse: ${destinoCelular}`,
    )
    : { enviado: false, status: "nao_configurado", motivo: "SMS não solicitado para esta atualização." };

  await Promise.all([
    admin.from("notificacoes_envios").insert({
      cliente_id: cliente.id,
      projeto_id: body.projeto_id ?? null,
      tipo: body.tipo,
      canal: "email",
      destino_mascarado: mascararDestino(destinatario),
      status: "enviado",
      provedor_id: emailData.id ?? null,
    }),
    admin.from("notificacoes_envios").insert({
      cliente_id: cliente.id,
      projeto_id: body.projeto_id ?? null,
      tipo: body.tipo,
      canal: "sms",
      destino_mascarado: mascararDestino(cliente.telefone),
      status: sms.status,
      provedor_id: "id" in sms ? sms.id ?? null : null,
      detalhe: "motivo" in sms ? sms.motivo ?? null : null,
    }),
  ]).catch(() => {});

  const smsObrigatorio = callerIsAdmin && body.notificar_celular === true;
  const todosCanaisSolicitadosEnviados = !smsObrigatorio || sms.enviado === true;

  return resposta({
    enviado: todosCanaisSolicitadosEnviados,
    motivo: todosCanaisSolicitadosEnviados ? "" : sms.motivo,
    id: emailData.id ?? null,
    canais: { email: { enviado: true, id: emailData.id ?? null }, sms },
  });
});
