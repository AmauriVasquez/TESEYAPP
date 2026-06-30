// Edge Function `calendar` — reemplaza el servidor Express de Render.
// Gestiona el Google Calendar compartido con la Service Account de Google:
//   - sync_project: crea/actualiza el evento all-day de un proyecto
//   - delete_event: borra un evento por id (proyecto Terminado, o cumpleaños pasado)
//   - birthday:     crea el evento all-day de cumpleaños de un empleado
//
// Secretos requeridos (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_EMAIL   client_email de la service account
//   GOOGLE_PRIVATE_KEY    private_key del JSON (con \n escapados o reales)
//   GOOGLE_CALENDAR_ID    id del calendario compartido
//
// Firma el JWT RS256 con WebCrypto (sin dependencias) y lo cambia por un
// access_token en el endpoint OAuth2 de Google. verify_jwt queda activo por
// defecto, así que solo usuarios logueados de la app pueden invocarla.

const TIMEZONE = "America/Mexico_City";
const CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyRaw = Deno.env.get("GOOGLE_PRIVATE_KEY");
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Faltan GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY en los secretos de la función.");
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

const calBase = () =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;

/** Evento all-day: end.date es exclusivo, por eso +1 día sobre la fecha fin. */
function allDayBody(summary: string, fechaInicio: string, fechaFin?: string) {
  const start = String(fechaInicio || "").trim().split("T")[0];
  if (!start) throw new Error("fecha_inicio es obligatoria.");
  const endRaw = (fechaFin && String(fechaFin).trim().split("T")[0]) || start;
  const endObj = new Date(`${endRaw}T12:00:00Z`);
  endObj.setUTCDate(endObj.getUTCDate() + 1);
  const end = endObj.toISOString().split("T")[0];
  return {
    summary,
    start: { date: start, timeZone: TIMEZONE },
    end: { date: end, timeZone: TIMEZONE },
  };
}

async function googleCall(token: string, url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Google Calendar ${method} ${res.status}: ${await res.text()}`);
  }
  // DELETE devuelve 204 sin cuerpo
  return res.status === 204 ? {} : await res.json();
}

async function syncProject(p: Record<string, unknown>): Promise<{ eventId: string }> {
  const token = await getAccessToken();
  const summary = `[PROYECTO] ${p.folio || "Sin folio"} - ${p.descripcion || "Sin descripción"}`;
  const body = allDayBody(summary, String(p.fecha_inicio ?? ""), p.fecha_fin ? String(p.fecha_fin) : undefined);
  const existing = (p.google_calendar_event_id as string) || null;
  if (existing) {
    await googleCall(token, `${calBase()}/${encodeURIComponent(existing)}`, "PATCH", body);
    return { eventId: existing };
  }
  const data = await googleCall(token, calBase(), "POST", body);
  return { eventId: data.id };
}

async function birthday(emp: Record<string, unknown>): Promise<{ eventId: string }> {
  const raw = String(emp.fecha_nacimiento ?? "").trim();
  if (!raw) throw new Error("fecha_nacimiento es obligatoria.");
  const [, m, d] = raw.split("T")[0].split("-");
  if (!m || !d) throw new Error("fecha_nacimiento inválida.");
  const year = new Date().getFullYear();
  const start = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const token = await getAccessToken();
  const body = allDayBody(`🎂 Cumpleaños de ${emp.nombre_completo || "Colaborador"}`, start);
  const data = await googleCall(token, calBase(), "POST", body);
  return { eventId: data.id };
}

async function deleteEvent(eventId: string): Promise<void> {
  if (!eventId) throw new Error("Se requiere eventId.");
  const token = await getAccessToken();
  await googleCall(token, `${calBase()}/${encodeURIComponent(eventId)}`, "DELETE");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!CALENDAR_ID) throw new Error("Falta GOOGLE_CALENDAR_ID en los secretos de la función.");
    const body = await req.json();
    switch (body.action) {
      case "sync_project":
        return json(await syncProject(body));
      case "birthday":
        return json(await birthday(body));
      case "delete_event":
        await deleteEvent(body.eventId);
        return json({ ok: true });
      default:
        return json({ error: `Acción no soportada: ${body.action}` }, 400);
    }
  } catch (err) {
    console.error("[calendar]", err instanceof Error ? err.message : err);
    return json({ error: err instanceof Error ? err.message : "Error desconocido" }, 500);
  }
});
