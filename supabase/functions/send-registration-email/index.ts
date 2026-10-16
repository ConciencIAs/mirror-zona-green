import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

// Correo de "registro recibido". Se llama justo después del signUp, cuando el
// usuario todavía no tiene sesión, así que no se puede exigir un JWT. Para que
// no sirva para enviar correos a cualquiera:
//   - el destinatario debe ser un perfil creado hace poco (VENTANA_MINUTOS);
//   - se envía una sola vez por perfil (marca en datos_adicionales);
//   - la ruta (1, 2 o 3) se decide con lo que guardó handle_new_user en la
//     base, no con el teléfono ni el código que manda el navegador;
//   - el enlace se arma en el servidor con un origen de la lista APP_URLS;
//   - la respuesta ya no dice qué ruta se usó.
// Ruta 1 (base de confianza): normalmente no envía nada, porque el primer
// correo es la plantilla "Confirm signup" de Supabase Auth.
// Acepta el payload anterior ({nombre, correo, telefono, token_referido,
// confirmation_url}) y, opcionalmente, user_id.

const VENTANA_MINUTOS = 30;
const MARCA_ENVIO = "correo_registro_enviado_at";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const { correo, user_id, confirmation_url } = await req.json();

    if (!correo || typeof correo !== "string") {
      return json({ error: "Falta el campo requerido: correo" }, 400);
    }
    const correoNormalizado = correo.trim().toLowerCase();

    // 1. Perfil del destinatario, leído en el servidor.
    let consulta = supabase
      .from("perfiles")
      .select("id, correo, status, referido_por, origen_autorizacion, datos_adicionales, created_at")
      .eq("correo", correoNormalizado);
    if (typeof user_id === "string" && user_id) consulta = consulta.eq("id", user_id);

    const { data: perfil, error: errPerfil } = await consulta.maybeSingle();
    if (errPerfil) throw errPerfil;
    if (!perfil) return json(RESPUESTA_GENERICA);

    // 2. Solo registros recientes.
    const creado = new Date(perfil.created_at ?? 0).getTime();
    if (!creado || Date.now() - creado > VENTANA_MINUTOS * 60_000) {
      return json(RESPUESTA_GENERICA);
    }

    // 3. Ruta según lo que decidió handle_new_user.
    const enBaseConfianza = perfil.origen_autorizacion === "base_confianza";
    const tieneReferido = typeof perfil.referido_por === "string" && perfil.referido_por.trim() !== "";

    // Ruta 1: el primer correo es la plantilla "Confirm signup" de Supabase
    // Auth (caso 6). Este correo solo se manda si Auth no envió esa plantilla,
    // es decir, si el correo quedó confirmado automáticamente.
    if (enBaseConfianza) {
      const { data: authUser, error: errAuth } = await supabase.auth.admin.getUserById(perfil.id);
      if (errAuth) throw errAuth;
      if (!authUser.user?.email_confirmed_at) return json(RESPUESTA_GENERICA);
    }

    // 4. Una sola vez por perfil: la marca se pone con una actualización
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

    let emailSubject: string;
    let emailHtml: string;

    if (enBaseConfianza) {
      // RUTA 1: base de confianza con el correo ya confirmado (sin plantilla de Auth)
      emailSubject = "Bienvenido - Cheyn Verde";
      emailHtml = buildEmailHtml({
        subtituloHeader: "¡Bienvenido a la familia Cheyn Verde!",
        tituloCuerpo: "Tu cuenta está lista",
        mensajes: [
          "Tu dirección de correo fue registrada correctamente.",
          "Ingresa al sistema con el usuario y contraseña creada para conocer la oferta Cheyn Verde.",
        ],
        confirmationUrl: urlLogin(confirmation_url),
        textoBoton: "Ingresar a Cheyn Verde",
        mostrarCajaSoporte: true,
      });
    } else if (tieneReferido) {
      // RUTA 2: no está en base de confianza, pero tiene código de referido
      emailSubject = "Registro recibido - Cheyn Verde";
      emailHtml = buildEmailHtml({
        subtituloHeader: "Tu registro está en revisión",
        tituloCuerpo: "Registro recibido con código de invitado",
        mensajes: [
          "Tu dirección de correo fue registrada correctamente.",
          "El equipo de Cheyn Verde validará tu ingreso con la persona que te compartió la invitación y pronto te enviará un correo de ingreso al sistema.",
          "Pronto podrás acceder a nuestra oferta.",
        ],
        mostrarCajaSoporte: false,
      });
    } else {
      // RUTA 3: no está en base de confianza y no tiene código de referido
      emailSubject = "Registro recibido - Cheyn Verde";
      emailHtml = buildEmailHtml({
        subtituloHeader: "Tu registro está en revisión",
        tituloCuerpo: "Registro recibido",
        mensajes: [
          "Tu dirección de correo fue registrada correctamente.",
          "El equipo de Cheyn Verde validará la información y te enviará un correo de ingreso al sistema.",
        ],
        mostrarCajaSoporte: false,
      });
    }

    try {
      await transporter.sendMail({
        from: `"Cheyn Verde" <${Deno.env.get("GMAIL_USER")}>`,
        to: perfil.correo,
        subject: emailSubject,
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
