import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

// Correo "Tu registro fue autorizado". Solo lo puede pedir un administrador
// con sesión, y solo para un perfil que ya está activo. Antes cualquiera con
// la clave pública podía enviar este correo a cualquier dirección y con
// cualquier enlace.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Orígenes a los que puede apuntar el botón del correo. Se configura con el
// secreto APP_URLS (separados por coma); el primero es el predeterminado.
const APP_URLS = (Deno.env.get("APP_URLS") ??
  "https://mirror-zona-green.vercel.app,https://cheynverde.com,https://www.cheynverde.com")
  .split(",")
  .map((u) => u.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// SMTP_HOST/PORT/SECURE solo se definen en local (Mailpit); en producción
// quedan los valores de Gmail.
const transporter = nodemailer.createTransport({
  host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
  port: Number(Deno.env.get("SMTP_PORT") ?? 465),
  secure: (Deno.env.get("SMTP_SECURE") ?? "true") === "true",
  auth: {
    user: Deno.env.get("GMAIL_USER"),
    pass: Deno.env.get("GMAIL_APP_PASSWORD"),
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// El enlace siempre se arma en el servidor: se acepta el origen que manda el
// cliente solo si está en la lista, y la ruta es siempre /auth/login.
function urlLogin(urlCliente: unknown): string {
  let origen = APP_URLS[0];
  if (typeof urlCliente === "string") {
    try {
      const candidato = new URL(urlCliente).origin;
      if (APP_URLS.includes(candidato)) origen = candidato;
    } catch { /* se usa el predeterminado */ }
  }
  return `${origen}/auth/login`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  try {
    // 1. Quien llama debe tener sesión y ser administrador.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Se requiere una sesión de administrador." }, 401);
    }

    const { data: perfilAdmin, error: errAdmin } = await supabaseAdmin
      .from("perfiles")
      .select("rol, status")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (errAdmin) throw errAdmin;
    if (perfilAdmin?.rol !== "admin" || perfilAdmin?.status === "bloqueado") {
      return json({ error: "Solo un administrador puede enviar este correo." }, 403);
    }

    // 2. El destinatario debe ser un perfil existente y ya activo.
    const { correo, confirmation_url } = await req.json();
    if (!correo || typeof correo !== "string") {
      return json({ error: "Se requiere el campo 'correo'." }, 400);
    }
    const correoNormalizado = correo.trim().toLowerCase();

    const { data: destino, error: errDestino } = await supabaseAdmin
      .from("perfiles")
      .select("id, correo, status")
      .eq("correo", correoNormalizado)
      .maybeSingle();
    if (errDestino) throw errDestino;
    if (!destino || destino.status !== "activo") {
      return json({ error: "El correo no corresponde a un perfil activo." }, 400);
    }

    const enlace = urlLogin(confirmation_url);

    const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registro Autorizado - Cheyn Verde</title>
</head>
<body style="margin: 0; padding: 0; background-color: #edf4fc; font-family: 'Segoe UI', Arial, sans-serif; width: 100% !important;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #edf4fc; padding: 20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(16, 29, 48, 0.08);">
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #20a038 0%, #167f2b 100%); padding: 36px 20px;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; text-transform: uppercase;">Cheyn Verde</h1>
              <p style="color: #ecf7ed; font-size: 14px; margin: 8px 0 0 0;">¡Tu registro ha sido autorizado!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px; color: #1c324f;">
              <h2 style="color: #146424; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Acceso al sistema</h2>

              <p style="font-size: 15px; line-height: 1.6; color: #101d30; margin-bottom: 12px;">
                Tú registro fue autorizado correctamente.
              </p>

              <p style="font-size: 15px; line-height: 1.6; color: #101d30; margin-bottom: 24px;">
                Debes hacer clic en el siguiente enlace para acceder al sistema y conocer la oferta de Cheyn Verde.
              </p>

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${enlace}" target="_blank" style="background-color: #20a038; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 3px 6px rgba(32, 160, 56, 0.3);">
                      Acceder al sistema
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 16px; font-weight: bold; color: #146424; margin-top: 20px;">
                Bienvenido.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color: #ecf7ed; padding: 20px; border-top: 1px solid #cfeecd;">
              <p style="font-size: 14px; font-weight: 600; color: #146424; margin: 0 0 4px 0;">Muchas gracias por registrarte.</p>
              <p style="font-size: 12px; color: #167f2b; margin: 0;">© Cheyn Verde. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Cheyn Verde" <${Deno.env.get("GMAIL_USER")}>`,
      to: destino.correo,
      subject: "Tu registro fue autorizado - Cheyn Verde",
      html: emailHtml,
    });

    return json({ success: true, mensaje: "Correo de autorización enviado correctamente." });
  } catch (err) {
    console.error("send-account-activation:", err);
    return json({ error: "No se pudo enviar el correo de autorización." }, 500);
  }
});
