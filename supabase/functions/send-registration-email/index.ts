import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

// --- Configuración de Supabase (solo lectura) y Gmail ---
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: Deno.env.get("GMAIL_USER"),
    pass: Deno.env.get("GMAIL_APP_PASSWORD"),
  },
});

// Normalización bilateral de teléfono (solo dígitos, últimos 10)
function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// Generador de HTML para plantillas de correo
function buildEmailHtml(params: {
  subtituloHeader?: string;
  tituloCuerpo: string;
  mensajes: string[];
  confirmationUrl?: string;
  textoBoton?: string;
  mostrarCajaSoporte?: boolean;
}) {
  const {
    subtituloHeader = "¡Bienvenido a la familia Cheyn Verde!",
    tituloCuerpo,
    mensajes,
    confirmationUrl,
    textoBoton = "Confirmar correo electrónico",
    mostrarCajaSoporte = true,
  } = params;

  const párrafos = mensajes
    .map(
      (m) => `<p style="font-size: 15px; line-height: 1.6; color: #101d30; margin-bottom: 12px;">${m}</p>`
    )
    .join("");

  const botonHtml = confirmationUrl
    ? `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
        <tr>
          <td align="center">
            <a href="${confirmationUrl}" target="_blank" style="background-color: #20a038; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 3px 6px rgba(32, 160, 56, 0.3);">
              ${textoBoton}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const soporteHtml = mostrarCajaSoporte
    ? `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #edf4fc; border-left: 4px solid #336fb6; border-radius: 4px; margin-top: 28px;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #1d3a60;">
              Si el enlace no funciona contacta a Cheyn Verde al correo: 
              <a href="mailto:cheynverde@gmail.com" style="color: #336fb6; text-decoration: underline; font-weight: 600;">cheynverde@gmail.com</a>, 
              detallando fecha y correo electrónico con el cual intentaste el ingreso. Nos encargaremos de solucionar a la mayor brevedad posible.
            </p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cheyn Verde</title>
</head>
<body style="margin: 0; padding: 0; background-color: #edf4fc; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #edf4fc; padding: 20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(16, 29, 48, 0.08);">
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #20a038 0%, #167f2b 100%); padding: 36px 20px;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Cheyn Verde</h1>
              <p style="color: #ecf7ed; font-size: 14px; margin: 8px 0 0 0;">${subtituloHeader}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px; color: #1c324f;">
              <h2 style="color: #146424; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">${tituloCuerpo}</h2>
              ${párrafos}
              ${botonHtml}
              ${soporteHtml}
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
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 });
  }

  try {
    const { nombre, correo, telefono, token_referido, confirmation_url } = await req.json();

    if (!correo || !telefono) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos: correo, telefono" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    const telNormalizado = normalizePhone(telefono);

    // Consulta de lectura a base_confianza para validación de número
    const { data: baseConfianza, error: errDb } = await supabase
      .from("base_confianza")
      .select("*").eq('telefono', telNormalizado);

    if (errDb) throw errDb;

    const estaEnBaseConfianza = baseConfianza?.length >= 1

    console.log('telNormalizado', telNormalizado, 'estaEnBaseConfianza', estaEnBaseConfianza, 'baseConfianza.length', baseConfianza.length )

    let ruta: 1 | 2 | 3;
    let emailSubject = "";
    let emailHtml = "";

    if (estaEnBaseConfianza) {
      // ----------------------------------------------------
      // RUTA 1: Pertenece a la base de confianza
      // ----------------------------------------------------
      ruta = 1;
      emailSubject = "Confirmación de correo - Cheyn Verde";
      emailHtml = buildEmailHtml({
        subtituloHeader: "¡Bienvenido a la familia Cheyn Verde!",
        tituloCuerpo: "Confirma tu dirección de correo",
        mensajes: [
          "Tú dirección de correo fue registrada correctamente.",
          "Debes hacer clic en el enlace de confirmación para ingresar al sistema y conocer la oferta de Cheyn Verde.",
          "Bienvenido a la familia Cheyn Verde.",
        ],
        confirmationUrl: confirmation_url || "",
        textoBoton: "Confirmar correo electrónico",
        mostrarCajaSoporte: true,
      });

    } else if (token_referido && token_referido.trim() !== "") {
      // ----------------------------------------------------
      // RUTA 2: NO está en base de confianza, PERO tiene código de referido
      // ----------------------------------------------------
      ruta = 2;
      emailSubject = "Registro recibido - Cheyn Verde";
      emailHtml = buildEmailHtml({
        subtituloHeader: "Tu registro está en revisión",
        tituloCuerpo: "Registro recibido con código de invitado",
        mensajes: [
          "Tú dirección de correo fue registrada correctamente.",
          "El equipo de Cheyn Verde validará tu ingreso con la persona que te compartió la invitación y pronto te enviará un correo de ingreso al sistema.",
          "Pronto podrás acceder a nuestra oferta.",
        ],
        mostrarCajaSoporte: false,
      });

    } else {
      // ----------------------------------------------------
      // RUTA 3: NO está en base de confianza y NO tiene código de referido
      // ----------------------------------------------------
      ruta = 3;
      emailSubject = "Registro recibido - Cheyn Verde";
      emailHtml = buildEmailHtml({
        subtituloHeader: "Tu registro está en revisión",
        tituloCuerpo: "Registro recibido",
        mensajes: [
          "Tú dirección de correo fue registrada correctamente.",
          "El equipo de Cheyn Verde validará la información y te enviará un correo de ingreso al sistema.",
        ],
        mostrarCajaSoporte: false,
      });
    }

    // Envío único del correo vía Gmail SMTP
    await transporter.sendMail({
      from: `"Cheyn Verde" <${Deno.env.get("GMAIL_USER")}>`,
      to: correo,
      subject: emailSubject,
      html: emailHtml,
    });

    return new Response(
      JSON.stringify({ success: true, ruta, mensaje: `Correo de Ruta ${ruta} enviado con éxito.` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});