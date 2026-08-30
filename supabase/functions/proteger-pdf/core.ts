const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function normalizeText(value: unknown, maxLength = 120): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function maskEmail(email: string | null | undefined): string {
  const normalized = String(email ?? "").trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0) return "";

  const local = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "*".repeat(
    Math.max(3, Math.min(8, local.length - visible.length))
  );
  return `${visible}${hidden}@${domain}`;
}

export function buildLicensedTo(params: {
  isPublicSample: boolean;
  fullName?: string | null;
  email?: string | null;
}): string {
  if (params.isPublicSample) {
    return "AMOSTRA PUBLICA - CAMILA MARTINS ENGENHARIA";
  }

  const name = normalizeText(params.fullName, 64);
  const email = maskEmail(params.email);
  const pieces = [name, email].filter(Boolean);
  return normalizeText(pieces.join(" - ") || "CLIENTE AUTENTICADO", 110);
}

export function sanitizeFilename(value: string): string {
  const slug = normalizeText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "documento";
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(
    bytes,
    value => value.toString(16).padStart(2, "0")
  ).join("");
}

export async function sha256Hex(
  data: Uint8Array | string
): Promise<string> {
  const input =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data;
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest));
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export async function hmacSha256(
  secret: string,
  value: string
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return new Uint8Array(signature);
}

export async function createIssueCode(
  secret: string,
  seed: string
): Promise<string> {
  const signature = await hmacSha256(secret, seed);
  return `CME-${encodeBase32(signature).slice(0, 12)}`;
}

export function validPortalPath(value: unknown): value is string {
  const path = String(value ?? "");
  return (
    path.length > 4 &&
    path.length <= 700 &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("\\") &&
    path.toLowerCase().endsWith(".pdf")
  );
}

export function validSlug(value: unknown): value is string {
  return /^[a-z0-9-]{2,64}$/.test(String(value ?? ""));
}

export function authenticatedUserToken(token: string | null): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const normalized = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized));

    return (
      payload?.role === "authenticated" &&
      typeof payload?.sub === "string" &&
      payload.sub.length > 0
    );
  }
  catch {
    return false;
  }
}
