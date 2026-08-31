import { createClient } from "npm:@supabase/supabase-js@2";

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

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(message),
    ),
  );
  return Array.from(assinatura)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function compararConstante(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function escaparIcs(valor: unknown) {
  return String(valor ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function formatarUtc(data: string, horario: string, minutosAdicionar = 0) {
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

function dataSemHifen(data: string) {
  return data.replaceAll("-", "");
}

function proximoDia(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function resposta(texto: string, status: number, contentType = "text/plain; charset=utf-8") {
  return new Response(texto, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "GET") {
    return resposta("Método não permitido.", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = obterChaveAdministrativa();
  if (!supabaseUrl || !serviceRoleKey) {
    return resposta("Serviço temporariamente indisponível.", 503);
  }

  const url = new URL(request.url);
  const agendaId = String(url.searchParams.get("id") ?? "").trim();
  const assinatura = String(url.searchParams.get("sig") ?? "").trim().toLowerCase();

  if (
    !/^[0-9a-f-]{36}$/i.test(agendaId) ||
    !/^[0-9a-f]{64}$/i.test(assinatura)
  ) {
    return resposta("Link de agenda inválido.", 400);
  }

  const esperado = await hmacHex(serviceRoleKey, `agenda:${agendaId}`);
  if (!compararConstante(assinatura, esperado)) {
    return resposta("Link de agenda não autorizado.", 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: evento, error } = await admin
    .from("agenda")
    .select("id,titulo,tipo,data,horario,descricao")
    .eq("id", agendaId)
    .maybeSingle();

  if (
    error ||
    !evento ||
    evento.tipo !== "reuniao" ||
    !evento.data
  ) {
    return resposta("Reunião não encontrada.", 404);
  }

  const agora = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const linhasData: string[] = [];
  if (evento.horario && /^\d{2}:\d{2}/.test(String(evento.horario))) {
    const inicio = formatarUtc(String(evento.data), String(evento.horario), 0);
    const fim = formatarUtc(String(evento.data), String(evento.horario), 60);
    if (!inicio || !fim) return resposta("Data ou horário inválido.", 422);
    linhasData.push(`DTSTART:${inicio}`, `DTEND:${fim}`);
  } else {
    linhasData.push(
      `DTSTART;VALUE=DATE:${dataSemHifen(String(evento.data))}`,
      `DTEND;VALUE=DATE:${proximoDia(String(evento.data))}`,
    );
  }

  const portal = "https://camilamartinsengenharia.com.br/agenda-cliente.html";
  const descricao = [String(evento.descricao || ""), "", portal]
    .filter(Boolean)
    .join("\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Camila Martins Engenharia//Agenda Universal//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${evento.id}@camilamartinsengenharia.com.br`,
    `DTSTAMP:${agora}`,
    ...linhasData,
    `SUMMARY:${escaparIcs(evento.titulo || "Reunião - Camila Martins Engenharia")}`,
    `DESCRIPTION:${escaparIcs(descricao)}`,
    `URL:${portal}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reuniao-camila-martins.ics"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
});
