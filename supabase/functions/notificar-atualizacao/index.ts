// CAMILA MARTINS ENGENHARIA — NOTIFICAÇÕES V4
// E-mail (Resend) + Push gratuito (Firebase Cloud Messaging).
import { createClient } from "npm:@supabase/supabase-js@2";
import { protegerDadosConfidenciais } from "./privacy.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_UID_LEGADO =
  Deno.env.get("ADMIN_UID") ??
  "5c9d7a0e-0495-4e96-8561-1d7f220be154";

let googleTokenCache: { token: string; expiraEm: number } | null = null;

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
    const chaves = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
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

function mascararEmail(valor: unknown) {
  const texto = String(valor ?? "");
  if (!texto.includes("@")) return "***";
  const [local, dominio] = texto.split("@");
  return `${local.slice(0, 2)}***@${dominio ?? ""}`;
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

function bytesParaBase64Url(bytes: Uint8Array) {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function textoParaBase64Url(texto: string) {
  return bytesParaBase64Url(new TextEncoder().encode(texto));
}

function pemParaBytes(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function obterFirebaseServiceAccount() {
  const json = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.client_email && parsed?.private_key && parsed?.project_id) {
        return parsed as { client_email: string; private_key: string; project_id: string };
      }
    } catch {
      return null;
    }
  }

  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replaceAll("\\n", "\n");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  if (clientEmail && privateKey && projectId) {
    return { client_email: clientEmail, private_key: privateKey, project_id: projectId };
  }

  return null;
}

async function obterGoogleAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  project_id: string;
}) {
  const agora = Math.floor(Date.now() / 1000);
  if (googleTokenCache && googleTokenCache.expiraEm > agora + 120) {
    return googleTokenCache.token;
  }

  const header = textoParaBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = textoParaBase64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  }));
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemParaBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  const assertion = `${unsigned}.${bytesParaBase64Url(new Uint8Array(assinatura))}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error("Não foi possível autenticar o envio push no Firebase.");
  }

  googleTokenCache = {
    token: tokenData.access_token,
    expiraEm: agora + Number(tokenData.expires_in ?? 3600),
  };
  return googleTokenCache.token;
}

async function enviarPush(
  admin: ReturnType<typeof createClient>,
  clienteId: string,
  params: { titulo: string; mensagem: string; link: string; tag: string },
) {
  const serviceAccount = obterFirebaseServiceAccount();
  if (!serviceAccount) {
    return {
      enviado: false,
      status: "nao_configurado",
      motivo: "Firebase ainda não configurado no servidor.",
      id: null,
      quantidade: 0,
    };
  }

  const { data: dispositivos, error } = await admin
    .from("push_dispositivos")
    .select("id, token")
    .eq("cliente_id", clienteId)
    .eq("ativo", true);

  if (error) {
    return {
      enviado: false,
      status: "falhou",
      motivo: "Não foi possível consultar os dispositivos autorizados.",
      id: null,
      quantidade: 0,
    };
  }

  if (!dispositivos?.length) {
    return {
      enviado: false,
      status: "sem_destino",
      motivo: "O cliente ainda não ativou notificações no dispositivo.",
      id: null,
      quantidade: 0,
    };
  }

  let accessToken = "";
  try {
    accessToken = await obterGoogleAccessToken(serviceAccount);
  } catch {
    return {
      enviado: false,
      status: "falhou",
      motivo: "Não foi possível autenticar o Firebase.",
      id: null,
      quantidade: dispositivos.length,
    };
  }

  const resultados = await Promise.all(dispositivos.map(async dispositivo => {
    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: dispositivo.token,
              data: {
                title: params.titulo.slice(0, 120),
                body: params.mensagem.slice(0, 220),
                link: params.link,
                tag: params.tag.slice(0, 80),
              },
              webpush: {
                headers: { Urgency: "high", TTL: "86400" },
                fcm_options: { link: params.link },
              },
            },
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      const textoErro = JSON.stringify(data);
      const tokenInvalido =
        response.status === 404 ||
        textoErro.includes("UNREGISTERED") ||
        textoErro.includes("registration-token-not-registered");

      if (tokenInvalido) {
        await admin
          .from("push_dispositivos")
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq("id", dispositivo.id);
      }

      return {
        ok: response.ok,
        id: response.ok ? data.name ?? null : null,
      };
    } catch {
      return { ok: false, id: null };
    }
  }));

  const enviados = resultados.filter(item => item.ok);
  if (!enviados.length) {
    return {
      enviado: false,
      status: "falhou",
      motivo: "O Firebase não conseguiu entregar a notificação aos dispositivos cadastrados.",
      id: null,
      quantidade: dispositivos.length,
    };
  }

  return {
    enviado: true,
    status: enviados.length === dispositivos.length ? "enviado" : "parcial",
    motivo: enviados.length === dispositivos.length ? "" : "Alguns dispositivos não receberam a notificação.",
    id: enviados[0]?.id ?? null,
    quantidade: dispositivos.length,
  };
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
  if (!jwt) return resposta({ erro: "Sessão ausente." }, 401);

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
    notificar_push?: boolean;
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
    .select("id, nome, email, auth_id")
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
  const caminhoSolicitado = String(body.portal_path ?? "portal.html").replace(/^\/+/, "");
  const caminhoCliente = caminhosCliente.has(caminhoSolicitado)
    ? caminhoSolicitado
    : "portal.html";

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

  const pushSolicitado = callerIsAdmin && body.notificar_push === true;
  const push = pushSolicitado
    ? await enviarPush(admin, cliente.id, {
      titulo: tituloProtegido || "Nova atualização",
      mensagem: mensagemProtegida,
      link: `${siteUrl}/${caminhoCliente}`,
      tag: body.tipo || "atualizacao",
    })
    : {
      enviado: false,
      status: "nao_configurado",
      motivo: "Push não solicitado para esta atualização.",
      id: null,
      quantidade: 0,
    };

  const registros = [
    {
      cliente_id: cliente.id,
      projeto_id: body.projeto_id ?? null,
      tipo: body.tipo,
      canal: "email",
      destino_mascarado: mascararEmail(destinatarioEmail),
      status: email.status,
      provedor_id: email.id,
      detalhe: email.motivo || null,
    },
  ];

  if (pushSolicitado) {
    registros.push({
      cliente_id: cliente.id,
      projeto_id: body.projeto_id ?? null,
      tipo: body.tipo,
      canal: "push",
      destino_mascarado: `${push.quantidade} dispositivo(s)`,
      status: push.status,
      provedor_id: push.id,
      detalhe: push.motivo || null,
    });
  }

  const { error: auditError } = await admin
    .from("notificacoes_envios")
    .insert(registros);

  if (auditError) {
    console.warn("Não foi possível registrar a auditoria da notificação.");
  }

  const canaisSolicitados = pushSolicitado ? [email, push] : [email];
  const algumCanalEnviado = canaisSolicitados.some(canal => canal.enviado);
  const todosEnviados = canaisSolicitados.every(canal => canal.enviado);
  const motivos = canaisSolicitados
    .filter(canal => !canal.enviado && canal.motivo)
    .map(canal => canal.motivo);

  return resposta({
    enviado: algumCanalEnviado,
    parcial: algumCanalEnviado && !todosEnviados,
    motivo: motivos.join(" "),
    id: email.id ?? push.id,
    canais: { email, push },
  });
});
