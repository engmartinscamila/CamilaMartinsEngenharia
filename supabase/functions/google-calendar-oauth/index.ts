import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
    },
  });
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return parsed.default ?? "";
  } catch {
    return "";
  }
}

async function secretGet(admin: ReturnType<typeof createClient>, name: string) {
  const { data, error } = await admin.rpc("google_calendar_secret_get", { p_name: name });
  if (error) throw error;
  return data ? String(data) : "";
}

async function secretSet(
  admin: ReturnType<typeof createClient>,
  name: string,
  value: string,
  description: string,
) {
  const { error } = await admin.rpc("google_calendar_secret_set", {
    p_name: name,
    p_value: value,
    p_description: description,
  });
  if (error) throw error;
}

async function requireAdmin(
  request: Request,
  admin: ReturnType<typeof createClient>,
) {
  const authorization = request.headers.get("Authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;

  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) return null;

  const { data: adminRecord } = await admin
    .from("pdf_admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const adminUid = Deno.env.get("ADMIN_UID");
  const autorizado = Boolean(adminRecord) || (adminUid && adminUid === authData.user.id);
  return autorizado ? authData.user : null;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  const siteUrl = Deno.env.get("SITE_URL") || "https://camilamartinsengenharia.com.br";

  if (!supabaseUrl || !key) return json({ erro: "Supabase não configurado." }, 503);

  const admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const callbackUrl = `${supabaseUrl}/functions/v1/google-calendar-oauth`;

  // Callback do Google.
  if (request.method === "GET") {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const error = url.searchParams.get("error") || "";

    if (error || !code || !state) {
      return redirect(`${siteUrl}/configuracoes.html?google_calendar=erro`);
    }

    const { data: stateRow } = await admin
      .from("google_calendar_oauth_states")
      .select("id,user_id,expires_at,used_at")
      .eq("state", state)
      .maybeSingle();

    if (
      !stateRow ||
      stateRow.used_at ||
      new Date(stateRow.expires_at).getTime() < Date.now()
    ) {
      return redirect(`${siteUrl}/configuracoes.html?google_calendar=estado_invalido`);
    }

    await admin
      .from("google_calendar_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRow.id);

    let clientId = "";
    let clientSecret = "";
    try {
      clientId = await secretGet(admin, "google_calendar_client_id");
      clientSecret = await secretGet(admin, "google_calendar_client_secret");
    } catch {
      return redirect(`${siteUrl}/configuracoes.html?google_calendar=credenciais_ausentes`);
    }

    if (!clientId || !clientSecret) {
      return redirect(`${siteUrl}/configuracoes.html?google_calendar=credenciais_ausentes`);
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.refresh_token) {
      return redirect(`${siteUrl}/configuracoes.html?google_calendar=token_ausente`);
    }

    try {
      await secretSet(
        admin,
        "google_calendar_refresh_token",
        String(tokenData.refresh_token),
        "Refresh token OAuth do Google Calendar",
      );
    } catch {
      return redirect(`${siteUrl}/configuracoes.html?google_calendar=erro_cofre`);
    }

    return redirect(`${siteUrl}/configuracoes.html?google_calendar=conectado`);
  }

  if (request.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const user = await requireAdmin(request, admin);
  if (!user) return json({ erro: "Operação não autorizada." }, 403);

  let body: {
    action?: "status" | "salvar_credenciais" | "auth_url";
    client_id?: string;
    client_secret?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json({ erro: "Corpo inválido." }, 400);
  }

  if (body.action === "status") {
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      secretGet(admin, "google_calendar_client_id").catch(() => ""),
      secretGet(admin, "google_calendar_client_secret").catch(() => ""),
      secretGet(admin, "google_calendar_refresh_token").catch(() => ""),
    ]);

    return json({
      credenciais_configuradas: Boolean(clientId && clientSecret),
      conectado: Boolean(refreshToken),
      callback_url: callbackUrl,
    });
  }

  if (body.action === "salvar_credenciais") {
    const clientId = String(body.client_id || "").trim();
    const clientSecret = String(body.client_secret || "").trim();

    if (!clientId || !clientSecret) {
      return json({ erro: "Client ID e Client Secret são obrigatórios." }, 400);
    }

    await secretSet(
      admin,
      "google_calendar_client_id",
      clientId,
      "OAuth Client ID do Google Calendar",
    );
    await secretSet(
      admin,
      "google_calendar_client_secret",
      clientSecret,
      "OAuth Client Secret do Google Calendar",
    );

    return json({ salvo: true });
  }

  if (body.action === "auth_url") {
    const clientId = await secretGet(admin, "google_calendar_client_id").catch(() => "");
    const clientSecret = await secretGet(admin, "google_calendar_client_secret").catch(() => "");

    if (!clientId || !clientSecret) {
      return json({ erro: "Salve primeiro o Client ID e o Client Secret." }, 400);
    }

    const state = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");

    const { error: stateError } = await admin.from("google_calendar_oauth_states").insert({
      state,
      user_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (stateError) return json({ erro: "Não foi possível iniciar a autorização." }, 500);

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return json({ url: authUrl.toString(), callback_url: callbackUrl });
  }

  return json({ erro: "Ação inválida." }, 400);
});
