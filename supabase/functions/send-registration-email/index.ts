import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

// Correo "Tu correo está confirmado, tu ingreso está en revisión".
// Se pide DESPUÉS de que la persona confirma su correo: al volver del enlace
// de confirmación (con sesión) o al iniciar sesión con su cuenta aún inactiva.
// Para que no sirva para enviar correos a cualquiera:
//   - exige la sesión de la persona y el destinatario es ella misma;
//   - su correo debe estar confirmado y su perfil inactivo; quien entró por la
//     base de confianza (ya activo) no recibe este correo;
//   - se envía una sola vez por perfil (marca en datos_adicionales, la misma
//     que usaba el correo anterior de "registro recibido");
//   - el texto (con o sin código de referido) se decide con lo que guardó
//     handle_new_user en la base, no con lo que manda el navegador;
//   - la respuesta no dice si se envió.
// El cuerpo de la petición se ignora (se acepta el formato anterior).

const MARCA_ENVIO = "correo_registro_enviado_at";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// Generador de HTML para plantillas de correo. Todo el texto es fijo; no se
// inserta nada que venga del cliente.
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Respuesta igual se envíe o no, para no revelar si el correo existe.
const RESPUESTA_GENERICA = { success: true, mensaje: "Solicitud procesada." };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  try {
    // 1. Quien llama: su sesión.
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Se requiere una sesión." }, 401);
    }
    const usuario = userData.user;
    if (!usuario.email_confirmed_at) return json(RESPUESTA_GENERICA);

    // 2. Su perfil, leído en el servidor.
    const { data: perfil, error: errPerfil } = await supabase
      .from("perfiles")
      .select("id, correo, status, referido_por, origen_autorizacion, datos_adicionales")
      .eq("id", usuario.id)
      .maybeSingle();
    if (errPerfil) throw errPerfil;
    if (!perfil?.correo || perfil.status !== "inactivo" || perfil.origen_autorizacion === "base_confianza") {
      return json(RESPUESTA_GENERICA);
    }

    // 3. Una sola vez por perfil: la marca se pone con una actualización
    //    condicional; si otra llamada la puso antes, no se envía de nuevo.
    const datos = (perfil.datos_adicionales ?? {}) as Record<string, unknown>;
    if (datos[MARCA_ENVIO]) return json(RESPUESTA_GENERICA);

    const { data: marcado, error: errMarca } = await supabase
      .from("perfiles")
      .update({ datos_adicionales: { ...datos, [MARCA_ENVIO]: new Date().toISOString() } })
      .eq("id", perfil.id)
      .is(`datos_adicionales->>${MARCA_ENVIO}`, null)
      .select("id");
    if (errMarca) throw errMarca;
    if (!marcado?.length) return json(RESPUESTA_GENERICA);

    const tieneReferido = typeof perfil.referido_por === "string" && perfil.referido_por.trim() !== "";
    const emailHtml = buildEmailHtml({
      subtituloHeader: "Tu registro está en revisión",
      tituloCuerpo: "Tu correo está confirmado",
      mensajes: [
        "Tu dirección de correo quedó confirmada.",
        tieneReferido
          ? "Tu ingreso a Cheyn Verde está en revisión: el equipo lo validará con la persona que te compartió la invitación."
          : "Tu ingreso a Cheyn Verde está en revisión: el equipo validará tu información.",
        "Te enviaremos un correo cuando tu cuenta esté habilitada.",
      ],
      mostrarCajaSoporte: false,
    });

    try {
      await transporter.sendMail({
        from: `"Cheyn Verde" <${Deno.env.get("GMAIL_USER")}>`,
        to: perfil.correo,
        subject: "Tu correo está confirmado - Cheyn Verde",
        html: emailHtml,
      });
    } catch (errEnvio) {
      // Si el SMTP falla se quita la marca para permitir un reintento.
      await supabase.from("perfiles").update({ datos_adicionales: datos }).eq("id", perfil.id);
      throw errEnvio;
    }

    return json(RESPUESTA_GENERICA);
  } catch (err) {
    console.error("send-registration-email:", err);
    return json({ error: "No se pudo procesar la notificación de registro." }, 500);
  }
});
