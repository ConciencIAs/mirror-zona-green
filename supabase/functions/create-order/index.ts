import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Petición sin autorización')

    // 1. Instanciamos el cliente con la clave anónima pero inyectando el token del usuario.
    // Esto es crucial para que PostgreSQL sepa quién es auth.uid() dentro del RPC.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } }
      }
    )

    // 2. Obtenemos el payload de la petición
    const { datosEntrega } = await req.json().catch(() => ({}))

    // 3. Delegamos TODA la lógica compleja al RPC
    const { data, error } = await supabaseClient.rpc('procesar_checkout', {
      p_tipo_entrega: datosEntrega?.tipo_entrega || 'Pendiente',
      p_comentarios: datosEntrega?.comentarios || 'Sin comentarios',
      p_direccion: datosEntrega?.direccion || ''
    })

    // Si hubo un error a nivel de ejecución SQL
    if (error) throw error

    // Si hubo un error de negocio (ej. falta de stock devuelto por el RPC)
    if (!data.success) {
      return new Response(
        JSON.stringify({ error: data.error }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Retornamos el éxito si todo salió bien
    return new Response(
      JSON.stringify(data), 
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})