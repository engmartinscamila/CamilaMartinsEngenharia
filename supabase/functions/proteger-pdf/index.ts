import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  authenticatedUserToken,
  buildLicensedTo,
  createIssueCode,
  sanitizeFilename,
  sha256Hex,
  validPortalPath,
  validSlug
} from "./core.ts";
import { protectPdf } from "./watermark.ts";

const PROTECTED_BUCKET = "materiais-protegidos";
const PORTAL_BUCKETS = new Set(["documentos", "biblioteca"]);
const SIGNED_URL_SECONDS = 60;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const RATE_WINDOW_MINUTES = 5;
const RATE_MAX_REQUESTS = 8;

type UserInfo = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

type ResolvedSource = {
  sourceType: "site" | "documentos" | "biblioteca";
  sourceRecordId: string | null;
  sourceSlug: string | null;
  bucket: string;
  path: string;
  title: string;
  originalSha256: string | null;
  isPublic: boolean;
  clientId: string | null;
  licensedTo: string;
  shouldProtect: boolean;
};

function configuredOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map(origin => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function requestOrigin(req: Request): string {
  return (req.headers.get("origin") ?? "").replace(/\/$/, "");
}

function originAllowed(req: Request): boolean {
  const origin = requestOrigin(req);
  return !origin || configuredOrigins().includes(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = requestOrigin(req);
  const origins = configuredOrigins();
  const selected =
    origin && origins.includes(origin)
      ? origin
      : (origins[0] ?? "null");

  return {
    "Access-Control-Allow-Origin": selected,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function json(
  req: Request,
  status: number,
  body: Record<string, unknown>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function bearerToken(req: Request): string | null {
  const match =
    (req.headers.get("authorization") ?? "")
      .match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function pdfMagicValid(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

async function isAdmin(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("pdf_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("ADMIN_QUERY_FAILED");
  return Boolean(data);
}

async function resolveSource(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  user: UserInfo | null,
  userIsAdmin: boolean
): Promise<ResolvedSource | null> {
  if (validSlug(body.siteSlug)) {
    const { data, error } = await admin
      .from("protected_site_pdfs")
      .select(
        "slug,title,original_storage_path,original_sha256,active"
      )
      .eq("slug", body.siteSlug)
      .eq("active", true)
      .maybeSingle();

    if (error) throw new Error("SITE_PDF_QUERY_FAILED");
    if (!data) return null;

    return {
      sourceType: "site",
      sourceRecordId: null,
      sourceSlug: data.slug,
      bucket: PROTECTED_BUCKET,
      path: data.original_storage_path,
      title: data.title,
      originalSha256: data.original_sha256,
      isPublic: true,
      clientId: null,
      licensedTo: buildLicensedTo({ isPublicSample: true }),
      shouldProtect: true
    };
  }

  const bucket = String(body.bucket ?? "");
  const path = body.path;
  if (!PORTAL_BUCKETS.has(bucket) || !validPortalPath(path)) {
    throw new Error("INVALID_SOURCE");
  }

  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data: record, error: recordError } = await admin
    .from(bucket)
    .select("*")
    .eq("arquivo", path)
    .limit(1)
    .maybeSingle();

  if (recordError) throw new Error("DOCUMENT_QUERY_FAILED");
  if (!record) return null;

  const { data: client, error: clientError } = await admin
    .from("clientes")
    .select("id,nome,email,auth_id")
    .eq("id", record.cliente_id)
    .maybeSingle();

  if (clientError) throw new Error("CLIENT_QUERY_FAILED");
  if (!client) return null;

  if (!userIsAdmin && client.auth_id !== user.id) {
    throw new Error("DOCUMENT_ACCESS_DENIED");
  }

  return {
    sourceType: bucket as "documentos" | "biblioteca",
    sourceRecordId: String(record.id),
    sourceSlug: null,
    bucket,
    path: String(path),
    title: record.nome || record.titulo || "Documento",
    originalSha256: null,
    isPublic: false,
    clientId: client.id,
    licensedTo: userIsAdmin
      ? "CAMILA MARTINS ENGENHARIA - ADMINISTRADORA"
      : buildLicensedTo({
          isPublicSample: false,
          fullName: client.nome,
          email: client.email || user.email
        }),
    shouldProtect: record.autoral === true
  };
}

async function issueOriginalCopy(
  admin: ReturnType<typeof createClient>,
  source: ResolvedSource
): Promise<{
  viewUrl: string;
  downloadUrl: string;
  fileName: string;
}> {
  const fileName = `${sanitizeFilename(source.title)}.pdf`;
  const { data: signedView, error: viewError } = await admin.storage
    .from(source.bucket)
    .createSignedUrl(source.path, SIGNED_URL_SECONDS);
  const { data: signedDownload, error: downloadError } = await admin.storage
    .from(source.bucket)
    .createSignedUrl(source.path, SIGNED_URL_SECONDS, { download: fileName });

  if (
    viewError || downloadError ||
    !signedView?.signedUrl || !signedDownload?.signedUrl
  ) {
    throw new Error("SIGNED_URL_FAILED");
  }

  return {
    viewUrl: signedView.signedUrl,
    downloadUrl: signedDownload.signedUrl,
    fileName
  };
}

async function markIssueFailed(
  admin: ReturnType<typeof createClient>,
  issueId: string | null,
  errorCode: string
): Promise<void> {
  if (!issueId) return;
  await admin
    .from("protected_pdf_issues")
    .update({
      status: "failed",
      error_code: errorCode.slice(0, 80)
    })
    .eq("id", issueId);
}

async function purgeExpiredCopies(
  admin: ReturnType<typeof createClient>
): Promise<void> {
  const { data, error } = await admin
    .from("protected_pdf_issues")
    .select("id,issued_storage_path")
    .eq("status", "generated")
    .lt("expires_at", new Date().toISOString())
    .not("issued_storage_path", "is", null)
    .limit(20);

  if (error || !data?.length) return;

  const paths = data
    .map(item => item.issued_storage_path)
    .filter(Boolean);
  if (!paths.length) return;

  const { error: removeError } = await admin.storage
    .from(PROTECTED_BUCKET)
    .remove(paths);
  if (removeError) return;

  await admin
    .from("protected_pdf_issues")
    .update({ status: "purged" })
    .in("id", data.map(item => item.id));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    if (!originAllowed(req)) {
      return json(req, 403, { error: "ORIGIN_NOT_ALLOWED" });
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req)
    });
  }

  if (req.method !== "POST") {
    return json(req, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  if (!originAllowed(req)) {
    return json(req, 403, { error: "ORIGIN_NOT_ALLOWED" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");
  const fingerprintSecret =
    Deno.env.get("PDF_FINGERPRINT_SECRET") ?? "";

  if (
    !supabaseUrl ||
    !serviceKey ||
    fingerprintSecret.length < 32
  ) {
    return json(req, 500, {
      error: "SERVER_CONFIGURATION_ERROR"
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  }
  catch {
    return json(req, 400, { error: "INVALID_JSON" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  let issueId: string | null = null;

  try {
    const token = bearerToken(req);
    let user: UserInfo | null = null;
    let userIsAdmin = false;

    /*
     * Chamadas públicas feitas pelo supabase-js também enviam a chave
     * anônima no Authorization. Ela não representa uma sessão de usuário e
     * não deve ser enviada ao Auth como se fosse um access token. Somente
     * JWTs com role=authenticated passam pela validação remota abaixo.
     */
    if (authenticatedUserToken(token)) {
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data.user) {
        user = data.user;
        userIsAdmin = await isAdmin(admin, user.id);
      }
    }

    const source = await resolveSource(
      admin,
      body,
      user,
      userIsAdmin
    );

    if (!source) {
      return json(req, 404, { error: "DOCUMENT_NOT_FOUND" });
    }

    /*
     * ART, contratos, orçamentos e demais arquivos não autorais continuam
     * privados e acessíveis por URL curta, mas não recebem marca d'água nem
     * registro de emissão. A administradora decide isso no upload/edição.
     */
    if (!source.shouldProtect) {
      const original = await issueOriginalCopy(admin, source);
      return json(req, 200, {
        ...original,
        title: source.title,
        protected: false,
        issueCode: null,
        expiresInSeconds: SIGNED_URL_SECONDS
      });
    }

    await purgeExpiredCopies(admin).catch(() => {});

    const requestIp =
      (req.headers.get("x-forwarded-for") ?? "unknown")
        .split(",")[0]
        .trim();
    const userAgent =
      req.headers.get("user-agent") ?? "unknown";
    const fingerprint = await sha256Hex(
      `${fingerprintSecret}|${requestIp}|${userAgent}|` +
      `${user?.id ?? "public"}`
    );

    const rateSince = new Date(
      Date.now() - RATE_WINDOW_MINUTES * 60_000
    ).toISOString();
    const { count, error: rateError } = await admin
      .from("protected_pdf_issues")
      .select("id", { count: "exact", head: true })
      .eq("request_fingerprint", fingerprint)
      .gte("created_at", rateSince);

    if (rateError) throw new Error("RATE_QUERY_FAILED");
    if ((count ?? 0) >= RATE_MAX_REQUESTS) {
      return json(req, 429, {
        error: "TOO_MANY_REQUESTS",
        retryAfterSeconds: RATE_WINDOW_MINUTES * 60
      });
    }

    issueId = crypto.randomUUID();
    const issuedAt = new Date();
    const issueCode = await createIssueCode(
      fingerprintSecret,
      `${issueId}|${source.sourceType}|${source.path}|` +
      `${user?.id ?? "public"}|${issuedAt.toISOString()}`
    );

    const { error: issueError } = await admin
      .from("protected_pdf_issues")
      .insert({
        id: issueId,
        issue_code: issueCode,
        source_type: source.sourceType,
        source_record_id: source.sourceRecordId,
        source_slug: source.sourceSlug,
        source_bucket: source.bucket,
        source_path: source.path,
        user_id: user?.id ?? null,
        client_id: source.clientId,
        licensed_to: source.licensedTo,
        request_fingerprint: fingerprint,
        status: "processing"
      });

    if (issueError) throw new Error("ISSUE_CREATE_FAILED");

    const { data: originalBlob, error: downloadError } =
      await admin.storage
        .from(source.bucket)
        .download(source.path);

    if (downloadError || !originalBlob) {
      throw new Error("ORIGINAL_DOWNLOAD_FAILED");
    }
    if (originalBlob.size > MAX_PDF_BYTES) {
      throw new Error("ORIGINAL_TOO_LARGE");
    }

    const originalBytes =
      new Uint8Array(await originalBlob.arrayBuffer());
    if (!pdfMagicValid(originalBytes)) {
      throw new Error("ORIGINAL_NOT_PDF");
    }

    const originalHash = await sha256Hex(originalBytes);
    if (
      source.originalSha256 &&
      source.originalSha256.toLowerCase() !== originalHash
    ) {
      throw new Error("ORIGINAL_INTEGRITY_MISMATCH");
    }

    let protectedBytes: Uint8Array;
    try {
      protectedBytes = await protectPdf(originalBytes, {
        issueCode,
        licensedTo: source.licensedTo,
        title: source.title,
        issuedAt
      });
    }
    catch {
      throw new Error("PDF_PROTECTION_FAILED");
    }

    const outputHash = await sha256Hex(protectedBytes);
    const ownerFolder = user?.id ?? "public";
    const yearMonth = issuedAt.toISOString().slice(0, 7);
    const issuedPath =
      `emitidos/${source.sourceType}/${ownerFolder}/` +
      `${yearMonth}/${issueId}.pdf`;
    const downloadName =
      `${sanitizeFilename(source.title)}-` +
      `${issueCode.toLowerCase()}.pdf`;

    const { error: uploadError } = await admin.storage
      .from(PROTECTED_BUCKET)
      .upload(issuedPath, protectedBytes, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: false
      });

    if (uploadError) throw new Error("PROTECTED_UPLOAD_FAILED");

    const { error: updateError } = await admin
      .from("protected_pdf_issues")
      .update({
        issued_storage_path: issuedPath,
        original_sha256: originalHash,
        output_sha256: outputHash,
        status: "generated",
        error_code: null
      })
      .eq("id", issueId);

    if (updateError) {
      await admin.storage
        .from(PROTECTED_BUCKET)
        .remove([issuedPath]);
      throw new Error("ISSUE_UPDATE_FAILED");
    }

    const { data: signedView, error: signedViewError } =
      await admin.storage
        .from(PROTECTED_BUCKET)
        .createSignedUrl(
          issuedPath,
          SIGNED_URL_SECONDS
        );

    const { data: signedDownload, error: signedDownloadError } =
      await admin.storage
        .from(PROTECTED_BUCKET)
        .createSignedUrl(
          issuedPath,
          SIGNED_URL_SECONDS,
          { download: downloadName }
        );

    if (
      signedViewError ||
      signedDownloadError ||
      !signedView?.signedUrl ||
      !signedDownload?.signedUrl
    ) {
      throw new Error("SIGNED_URL_FAILED");
    }

    return json(req, 200, {
      viewUrl: signedView.signedUrl,
      downloadUrl: signedDownload.signedUrl,
      fileName: downloadName,
      issueCode,
      title: source.title,
      protected: true,
      expiresInSeconds: SIGNED_URL_SECONDS
    });
  }
  catch (error) {
    const errorCode =
      error instanceof Error
        ? error.message
        : "UNEXPECTED_ERROR";

    await markIssueFailed(admin, issueId, errorCode);
    console.error("proteger-pdf:", errorCode);

    const clientErrors: Record<string, [number, string]> = {
      INVALID_SOURCE: [400, "INVALID_SOURCE"],
      AUTH_REQUIRED: [401, "AUTH_REQUIRED"],
      DOCUMENT_ACCESS_DENIED: [403, "DOCUMENT_ACCESS_DENIED"]
    };
    const mapped = clientErrors[errorCode];
    if (mapped) {
      return json(req, mapped[0], { error: mapped[1] });
    }

    return json(req, 500, { error: "PDF_GENERATION_FAILED" });
  }
});
