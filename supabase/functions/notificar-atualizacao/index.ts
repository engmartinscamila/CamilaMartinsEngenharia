// CAMILA MARTINS ENGENHARIA — NOTIFICAÇÕES V6
// E-mail (Resend) + Push gratuito (Firebase Cloud Messaging).
// Cliente recebe notificações somente para reunião agendada e nova solicitação.
// Reuniões incluem convite .ics e link de adição ao Google Calendar, sem Google Cloud API.
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

const TIPOS_CLIENTE_PERMITIDOS = new Set([
  "agenda_criada",
  "solicitacao_criada",
]);

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

type AgendaDados = {
  data?: string;
  horario?: string;
  descricao?: string;
  duracao_minutos?: number;
};

type CalendarioEmail = {
  googleUrl: string;
  icsBase64: string;
  filename: string;
  dataExibicao: string;
  horarioExibicao: string;
};

function textoParaBase64Padrao(texto: string) {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function escaparIcs(valor: unknown) {
  return String(valor ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function formatarDataHoraIcsUtc(data: string, horario: string, minutosAdicionar = 0) {
  const hora = horario.slice(0, 5);
  const base = new Date(`${data}T${hora}:00-03:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCMinutes(base.getUTCMinutes() + minutosAdicionar);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    base.getUTCFullYear(),
    pad(base.getUTCMonth() + 1),
    pad(base.getUTCDate()),
    "T",
    pad(base.getUTCHours()),
    pad(base.getUTCMinutes()),
    pad(base.getUTCSeconds()),
    "Z",
  ].join("");
}

function formatarDataHoraGoogleLocal(data: string, horario: string, minutosAdicionar = 0) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [hora, minuto] = horario.slice(0, 5).split(":").map(Number);
  if (![ano, mes, dia, hora, minuto].every(Number.isFinite)) return "";
  const base = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));
  base.setUTCMinutes(base.getUTCMinutes() + minutosAdicionar);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    base.getUTCFullYear(),
    pad(base.getUTCMonth() + 1),
    pad(base.getUTCDate()),
    "T",
    pad(base.getUTCHours()),
    pad(base.getUTCMinutes()),
    "00",
  ].join("");
}

function formatarDataPtBr(data: string) {
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

function montarCalendarioEmail(params: {
  titulo: string;
  descricao: string;
  data: string;
  horario: string;
  duracaoMinutos?: number;
  destinoPortal: string;
}) : CalendarioEmail | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.data)) return null;
  if (!/^\d{2}:\d{2}/.test(params.horario)) return null;

  const duracao = Math.min(Math.max(Number(params.duracaoMinutos || 60), 15), 480);
  const inicioUtc = formatarDataHoraIcsUtc(params.data, params.horario, 0);
  const fimUtc = formatarDataHoraIcsUtc(params.data, params.horario, duracao);
  const inicioGoogle = formatarDataHoraGoogleLocal(params.data, params.horario, 0);
  const fimGoogle = formatarDataHoraGoogleLocal(params.data, params.horario, duracao);

  if (!inicioUtc || !fimUtc || !inicioGoogle || !fimGoogle) return null;

  const uid = `${crypto.randomUUID()}@camilamartinsengenharia.com.br`;
  const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const descricaoCompleta = [params.descricao, "", params.destinoPortal]
    .filter(Boolean)
    .join("\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Camila Martins Engenharia//Portal do Cliente//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${agora}`,
    `DTSTART:${inicioUtc}`,
    `DTEND:${fimUtc}`,
    `SUMMARY:${escaparIcs(params.titulo)}`,
    `DESCRIPTION:${escaparIcs(descricaoCompleta)}`,
    `URL:${params.destinoPortal}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("action", "TEMPLATE");
  google.searchParams.set("text", params.titulo);
  google.searchParams.set("dates", `${inicioGoogle}/${fimGoogle}`);
  google.searchParams.set("details", descricaoCompleta);
  google.searchParams.set("ctz", "America/Sao_Paulo");

  return {
    googleUrl: google.toString(),
    icsBase64: textoParaBase64Padrao(ics),
    filename: "reuniao-camila-martins.ics",
    dataExibicao: formatarDataPtBr(params.data),
    horarioExibicao: params.horario.slice(0, 5),
  };
}

async function enviarEmail(params: {
  destinatario: string | null | undefined;
  assunto: string;
  saudacao: string;
  titulo: string;
  mensagem: string;
  destinoPortal: string;
  calendario?: CalendarioEmail | null;
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
        attachments: params.calendario
          ? [{
              filename: params.calendario.filename,
              content: params.calendario.icsBase64,
            }]
          : undefined,
        html: `
          <div style="background:#f5f6f8;padding:28px 14px">
            <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;background:#ffffff;border:1px solid #e2e6eb;color:#11283f">
              <div style="background:#0b2b4c;text-align:center;padding:24px 18px">
                <img
                  src="https://camilamartinsengenharia.com.br/assets/logo.png"
                  alt="Camila Martins Engenharia"
                  width="190"
                  style="display:block;max-width:190px;width:100%;height:auto;margin:0 auto;border:0"
                />
              </div>

              <div style="padding:30px 28px">
                <h1 style="font-family:Georgia,serif;font-size:25px;line-height:1.25;font-weight:400;margin:0 0 22px;color:#11283f">
                  ${escaparHtml(params.assunto)}
                </h1>

                <p style="font-size:15px;line-height:1.65;margin:0 0 14px">
                  Olá, ${escaparHtml(params.saudacao)}.
                </p>

                <p style="font-size:15px;line-height:1.65;margin:0 0 18px">
                  ${escaparHtml(params.mensagem)}
                </p>

                <p style="font-size:15px;line-height:1.65;margin:0 0 24px">
                  <strong>${escaparHtml(params.titulo)}</strong>
                </p>

                ${params.calendario ? `
                  <div style="margin:0 0 24px;padding:18px;border:1px solid #e4e7eb;background:#fafbfc">
                    <p style="margin:0 0 7px;font-size:14px;color:#64748b">Reunião</p>
                    <p style="margin:0 0 15px;font-size:16px;color:#11283f">
                      <strong>${escaparHtml(params.calendario.dataExibicao)} às ${escaparHtml(params.calendario.horarioExibicao)}</strong>
                    </p>
                    <a href="${escaparHtml(params.calendario.googleUrl)}"
                       style="display:inline-block;padding:12px 17px;background:#ffffff;color:#0b2b4c;border:1px solid #0b2b4c;text-decoration:none;font-size:14px;margin:0 8px 8px 0">
                      Adicionar ao Google Calendar
                    </a>
                    <p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:#64748b">
                      O arquivo de calendário (.ics) também segue anexado para Outlook, Apple Calendar e outros aplicativos.
                    </p>
                  </div>
                ` : ""}

                <p style="margin:0 0 26px">
                  <a href="${escaparHtml(params.destinoPortal)}"
                     style="display:inline-block;padding:13px 20px;background:#0b2b4c;color:#ffffff;text-decoration:none;font-size:14px">
                    Acessar o portal
                  </a>
                </p>

                <div style="border-top:1px solid #e4e7eb;padding-top:18px">
                  <p style="margin:0;font-size:12px;line-height:1.55;color:#64748b">
                    Camila Martins Engenharia<br>
                    Ambiente exclusivo para clientes autorizados.
                  </p>
                </div>
              </div>
            </div>
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
    agenda_dados?: AgendaDados;
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

  const tipoPermitidoAoCliente = TIPOS_CLIENTE_PERMITIDOS.has(body.tipo);

  // Somente ações administrativas de Agenda e Solicitações podem gerar
  // e-mail/push para clientes. Outros eventos administrativos são ignorados.
  if (callerIsAdmin && !tipoPermitidoAoCliente) {
    return resposta({
      enviado: false,
      ignorado: true,
      motivo: "Este tipo de atualização não envia notificação ao cliente.",
      canais: {},
    });
  }

  const { data: cliente, error: clienteError } = await admin
    .from("clientes")
    .select("id, nome, email, auth_id")
    .eq("id", body.cliente_id)
    .maybeSingle();

  if (clienteError || !cliente) {
    return resposta({ erro: "Cliente não encontrado." }, 404);
  }

  if (!callerIsAdmin && cliente.auth_id !== authData.user.id) {
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
    ? (
      body.tipo === "agenda_criada"
        ? "Nova reunião agendada - Camila Martins Engenharia"
        : "Nova solicitação - Camila Martins Engenharia"
    )
    : `${body.tipo === "solicitacao_respondida" ? "Nova resposta" : "Nova solicitação"} de ${cliente.nome || "cliente"}`;
  const destinoEmail = callerIsAdmin
    ? `${siteUrl}/${caminhoCliente}`
    : `${siteUrl}/solicitacoes.html`;

  const calendario = (
    callerIsAdmin &&
    body.tipo === "agenda_criada" &&
    body.agenda_dados?.data &&
    body.agenda_dados?.horario
  )
    ? montarCalendarioEmail({
      titulo: tituloProtegido || "Reunião - Camila Martins Engenharia",
      descricao: protegerDadosConfidenciais(body.agenda_dados.descricao || ""),
      data: String(body.agenda_dados.data),
      horario: String(body.agenda_dados.horario),
      duracaoMinutos: Number(body.agenda_dados.duracao_minutos || 60),
      destinoPortal: destinoEmail,
    })
    : null;

  const email = await enviarEmail({
    destinatario: destinatarioEmail,
    assunto,
    saudacao: callerIsAdmin ? (cliente.nome || "cliente") : "Camila",
    titulo: tituloProtegido,
    mensagem: mensagemProtegida,
    destinoPortal: destinoEmail,
    calendario,
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
