import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resposta(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return parsed.default ?? "";
  } catch {
    return "";
  }
}

function googleConfig() {
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_CALENDAR_REFRESH_TOKEN");
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, calendarId };
}

async function googleAccessToken(config: ReturnType<typeof googleConfig> & {}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error("GOOGLE_OAUTH_REFRESH_FAILED");
  }
  return String(data.access_token);
}

function dataHoraInicio(data: string, horario?: string | null) {
  const hora = (horario || "09:00").slice(0, 5);
  return `${data}T${hora}:00-03:00`;
}

function dataHoraFim(inicio: string, minutos = 60) {
  const dt = new Date(inicio);
  dt.setMinutes(dt.getMinutes() + minutos);
  return dt.toISOString();
}

async function googleRequest(
  accessToken: string,
  method: string,
  url: string,
  body?: Record<string, unknown>,
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return {};
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Google Calendar recusou a operação:", response.status);
    throw new Error(`GOOGLE_CALENDAR_HTTP_${response.status}`);
  }
  return data;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = adminKey();
  if (!supabaseUrl || !serviceRole) return resposta({ erro: "Supabase não configurado." }, 503);

  const authorization = request.headers.get("Authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt) return resposta({ erro: "Sessão ausente." }, 401);

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !authData.user) return resposta({ erro: "Sessão inválida." }, 401);

  const { data: adminRecord } = await supabase
    .from("pdf_admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const adminUid = Deno.env.get("ADMIN_UID");
  if (!adminRecord && (!adminUid || adminUid !== authData.user.id)) {
    return resposta({ erro: "Operação não autorizada." }, 403);
  }

  let body: { acao?: "criar" | "atualizar" | "excluir"; agenda_id?: string };
  try {
    body = await request.json();
  } catch {
    return resposta({ erro: "Corpo inválido." }, 400);
  }

  if (!body.acao || !body.agenda_id) {
    return resposta({ erro: "Ação e agenda_id são obrigatórios." }, 400);
  }

  const { data: evento, error: agendaError } = await supabase
    .from("agenda")
    .select("*, clientes(nome,email)")
    .eq("id", body.agenda_id)
    .maybeSingle();

  if (agendaError || !evento) {
    return resposta({ erro: "Evento da agenda não encontrado." }, 404);
  }

  const config = googleConfig();
  if (!config) {
    await supabase.from("agenda").update({
      google_sync_status: "aguardando_oauth",
      google_sync_error: "Google Calendar ainda não autorizado.",
    }).eq("id", evento.id);

    return resposta({
      sincronizado: false,
      configurado: false,
      motivo: "Google Calendar ainda não autorizado.",
    });
  }

  let accessToken = "";
  try {
    accessToken = await googleAccessToken(config);
  } catch {
    await supabase.from("agenda").update({
      google_sync_status: "erro",
      google_sync_error: "Falha na autorização do Google Calendar.",
    }).eq("id", evento.id);
    return resposta({ sincronizado: false, configurado: true, motivo: "Falha OAuth." }, 502);
  }

  const calendarBase =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`;

  try {
    if (body.acao === "excluir") {
      if (evento.google_event_id) {
        await googleRequest(
          accessToken,
          "DELETE",
          `${calendarBase}/${encodeURIComponent(evento.google_event_id)}?sendUpdates=all`,
        );
      }

      await supabase.from("agenda").update({
        google_event_id: null,
        google_calendar_id: null,
        google_meet_link: null,
        google_sync_status: "excluido",
        google_sync_error: null,
        google_synced_at: new Date().toISOString(),
      }).eq("id", evento.id);

      return resposta({ sincronizado: true, acao: "excluir" });
    }

    // Apenas eventos do tipo reunião são levados ao Google Calendar.
    // Se um evento previamente sincronizado deixar de ser reunião,
    // remove o convite antigo do Google.
    if (evento.tipo !== "reuniao") {
      if (evento.google_event_id) {
        await googleRequest(
          accessToken,
          "DELETE",
          `${calendarBase}/${encodeURIComponent(evento.google_event_id)}?sendUpdates=all`,
        );
      }
      await supabase.from("agenda").update({
        google_event_id: null,
        google_calendar_id: null,
        google_meet_link: null,
        google_sync_status: "nao_aplicavel",
        google_sync_error: null,
        google_synced_at: new Date().toISOString(),
      }).eq("id", evento.id);
      return resposta({ sincronizado: true, ignorado: true, motivo: "Evento não é reunião." });
    }

    if (!evento.data || !evento.horario) {
      await supabase.from("agenda").update({
        google_sync_status: "erro",
        google_sync_error: "Reunião sem data ou horário.",
      }).eq("id", evento.id);
      return resposta({ sincronizado: false, motivo: "Reunião sem data ou horário." }, 400);
    }

    const clienteEmail = evento.clientes?.email || "";
    if (!clienteEmail) {
      await supabase.from("agenda").update({
        google_sync_status: "erro",
        google_sync_error: "Cliente sem e-mail cadastrado.",
      }).eq("id", evento.id);
      return resposta({ sincronizado: false, motivo: "Cliente sem e-mail cadastrado." }, 400);
    }

    const inicio = dataHoraInicio(evento.data, evento.horario);
    const fim = dataHoraFim(inicio, 60);
    const siteUrl = Deno.env.get("SITE_URL") || "https://camilamartinsengenharia.com.br";

    const googleBody = {
      summary: evento.titulo || "Reunião - Camila Martins Engenharia",
      description: [
        evento.descricao || "",
        "",
        "Agendado pelo Portal do Cliente - Camila Martins Engenharia",
        `${siteUrl}/agenda-cliente.html`,
      ].join("\n").trim(),
      start: {
        dateTime: inicio,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: fim,
        timeZone: "America/Sao_Paulo",
      },
      attendees: [{ email: clienteEmail }],
      guestsCanModify: false,
    };

    let googleEvento;
    if (evento.google_event_id) {
      googleEvento = await googleRequest(
        accessToken,
        "PATCH",
        `${calendarBase}/${encodeURIComponent(evento.google_event_id)}?sendUpdates=all`,
        googleBody,
      );
    } else {
      googleEvento = await googleRequest(
        accessToken,
        "POST",
        `${calendarBase}?sendUpdates=all`,
        googleBody,
      );
    }

    await supabase.from("agenda").update({
      google_event_id: googleEvento.id || evento.google_event_id || null,
      google_calendar_id: config.calendarId,
      google_meet_link: googleEvento.hangoutLink || null,
      google_sync_status: "sincronizado",
      google_sync_error: null,
      google_synced_at: new Date().toISOString(),
    }).eq("id", evento.id);

    return resposta({
      sincronizado: true,
      acao: evento.google_event_id ? "atualizar" : "criar",
      google_event_id: googleEvento.id || null,
    });
  } catch (error) {
    const detalhe = String(error?.message || error).slice(0, 180);
    await supabase.from("agenda").update({
      google_sync_status: "erro",
      google_sync_error: detalhe,
    }).eq("id", evento.id);

    return resposta({
      sincronizado: false,
      configurado: true,
      motivo: "Falha ao sincronizar com o Google Calendar.",
    }, 502);
  }
});
