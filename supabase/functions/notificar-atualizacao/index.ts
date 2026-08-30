// CAMILA MARTINS ENGENHARIA — NOTIFICAÇÕES V3
// E-mail (Resend) e SMS (Twilio) independentes, com direção definida por quem envia.
import { createClient } from "npm:@supabase/supabase-js@2";
import { protegerDadosConfidenciais } from "./privacy.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_UID_LEGADO =
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
    return { enviado: false, status: "nao_configurado", motivo: "Canal SMS ainda não configurado.", id: null };
  }

  const telefone = normalizarTelefoneBrasil(telefoneInformado);
  if (!telefone) {
    return { enviado: false, status: "sem_destino", motivo: "Telefone ausente ou inválido.", id: null };
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
      return { enviado: false, status: "falhou", motivo: "O provedor de SMS recusou o envio.", id: null };
    }

    return { enviado: true, status: "enviado", motivo: "", id: data.sid ?? null };
  } catch {
    return { enviado: false, status: "falhou", motivo: "Falha de comunicação com o provedor de SMS.", id: null };
  }
}

async function enviarEmail(params: {
  destinatario: string | null | undefined;
  assunto: string;
  saudacao: string;
  titulo: string;
  mensagem: string;
  destinoPortal: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");

  if (!resendApiKey || !fromEmail) {
    return { enviado: false, status: "nao_configurado", motivo: "Canal de e-mail ainda não configurado.", id: null };
  }

  if (!params.destinatario) {
    return { enviado: false, status: "sem_destino", motivo: "Destinatário sem e-mail cadastrado.", id: null };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.destinatario],
        subject: params.assunto,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#11283f">
            <h1 style="font-family:Georgia,serif;font-weight:400">${escaparHtml(params.assunto)}</h1>
            <p>Olá, ${escaparHtml(params.saudacao)}.</p>
            <p>${escaparHtml(params.mensagem)}</p>
            <p><strong>${escaparHtml(params.titulo)}</strong></p>
            <p>
              <a href="${escaparHtml(params.destinoPortal)}"
                 style="display:inline-block;padding:12px 18px;background:#0b2b4c;color:#fff;text-decoration:none">
                Acessar o portal
              </a>
            </p>
            <p style="font-size:12px;color:#64748b">Camila Martins Engenharia</p>
          </div>
        `,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Provedor de e-mail recusou a notificação:", response.status);
      return { enviado: false, status: "falhou", motivo: "O provedor de e-mail recusou o envio.", id: null };
    }

    return { enviado: true, status: "enviado", motivo: "", id: data.id ?? null };
  } catch {
    return { enviado: false, status: "falhou", motivo: "Falha de comunicação com o provedor de e-mail.", id: null };
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
  const adminEmail = Deno.env.get("NOTIFICATION_ADMIN_EMAIL");
  const siteUrl =
    Deno.env.get("SITE_URL") ?? "https://camilamartinsengenharia.com.br";

  if (!supabaseUrl || !serviceRoleKey) {
    return resposta({ erro: "Supabase não configurado na função." }, 503);
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

  const { data: adminRecord } = await admin
    .from("pdf_admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const callerIsAdmin =
    Boolean(adminRecord) || authData.user.id === ADMIN_UID_LEGADO;
  const tipoPermitidoAoCliente = [
    "solicitacao_criada",
    "solicitacao_respondida",
  ].includes(body.tipo);

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
    (!tipoPermitidoAoCliente || cliente.auth_id !== authData.user.id)
  ) {
    return resposta({ erro: "Operação não autorizada." }, 403);
  }

  const caminhosCliente = new Set([
    "portal.html",
    "solicitacoes-cliente.html",
    "agenda-cliente.html",
    "documentos-cliente.html",
    "biblioteca-cliente.html",
    "cronograma-cliente.html",
    "fotos-cliente.html",
    "meu-projeto.html",
  ]);
  const caminhoSolicitado = String(body.portal_path ?? "portal.html")
    .replace(/^\/+/, "");
  const caminhoCliente = caminhosCliente.has(caminhoSolicitado)
    ? caminhoSolicitado
    : "portal.html";

  // A direção depende de quem iniciou a ação. Assim, uma solicitação criada
  // pela administradora avisa o cliente; uma solicitação criada pelo cliente
  // avisa a administradora.
  const destinatarioEmail = callerIsAdmin ? cliente.email : adminEmail;
  const assunto = callerIsAdmin
    ? `Atualização do seu projeto: ${tituloProtegido}`
    : `${body.tipo === "solicitacao_respondida" ? "Nova resposta" : "Nova solicitação"} de ${cliente.nome || "cliente"}`;
  const destinoEmail = callerIsAdmin
    ? `${siteUrl}/${caminhoCliente}`
    : `${siteUrl}/solicitacoes.html`;

  const email = await enviarEmail({
    destinatario: destinatarioEmail,
    assunto,
    saudacao: callerIsAdmin ? (cliente.nome || "cliente") : "Camila",
    titulo: tituloProtegido,
    mensagem: mensagemProtegida,
    destinoPortal: destinoEmail,
  });

  const smsSolicitado = callerIsAdmin && body.notificar_celular === true;
  const destinoCelular = `${siteUrl}/${caminhoCliente}`;
  const sms = smsSolicitado
    ? await enviarSms(
      cliente.telefone,
      `Camila Martins Engenharia: ${tituloProtegido}. ${mensagemProtegida} Acesse: ${destinoCelular}`,
    )
    : {
      enviado: false,
      status: "nao_configurado",
      motivo: "SMS não solicitado para esta atualização.",
      id: null,
    };

  const registros = [
    {
      cliente_id: cliente.id,
      projeto_id: body.projeto_id ?? null,
      tipo: body.tipo,
      canal: "email",
      destino_mascarado: mascararDestino(destinatarioEmail),
      status: email.status,
      provedor_id: email.id,
      detalhe: email.motivo || null,
    },
  ];

  if (smsSolicitado) {
    registros.push({
      cliente_id: cliente.id,
      projeto_id: body.projeto_id ?? null,
      tipo: body.tipo,
      canal: "sms",
      destino_mascarado: mascararDestino(cliente.telefone),
      status: sms.status,
      provedor_id: sms.id,
      detalhe: sms.motivo || null,
    });
  }

  const { error: auditError } = await admin
    .from("notificacoes_envios")
    .insert(registros);

  if (auditError) {
    console.warn("Não foi possível registrar a auditoria da notificação.");
  }

  const canaisSolicitados = smsSolicitado ? [email, sms] : [email];
  const algumCanalEnviado = canaisSolicitados.some(canal => canal.enviado);
  const todosEnviados = canaisSolicitados.every(canal => canal.enviado);
  const motivos = canaisSolicitados
    .filter(canal => !canal.enviado && canal.motivo)
    .map(canal => canal.motivo);

  return resposta({
    enviado: algumCanalEnviado,
    parcial: algumCanalEnviado && !todosEnviados,
    motivo: motivos.join(" "),
    id: email.id,
    canais: { email, sms },
  });
});
