import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.10";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: Deno.env.get("GMAIL_USER"),
    pass: Deno.env.get("GMAIL_APP_PASSWORD"),
  },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }, });
  }

  try {
    const { correo, confirmation_url } = await req.json();

    if (!correo || !confirmation_url) {
      return new Response(
        JSON.stringify({ error: "Se requieren los campos 'correo' y 'confirmation_url'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }, }
      );
    }

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
                    <a href="${confirmation_url}" target="_blank" style="background-color: #20a038; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 3px 6px rgba(32, 160, 56, 0.3);">
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
      to: correo,
      subject: "Tu registro fue autorizado - Cheyn Verde",
      html: emailHtml,
    });

    return new Response(
      JSON.stringify({ success: true, mensaje: "Correo de autorización enviado correctamente." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});