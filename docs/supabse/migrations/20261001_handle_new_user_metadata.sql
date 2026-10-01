CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_status public.status_profile;
  v_origen text;
  v_referido_por text;
  v_telefono_raw text;
  v_telefono_limpio text;
BEGIN
  v_status := 'inactivo';
  v_origen := 'registro_web';
  v_referido_por := NEW.raw_user_meta_data ->> 'referido_por';
  v_telefono_raw := NEW.raw_user_meta_data ->> 'telefono';

  IF v_telefono_raw IS NOT NULL THEN
    v_telefono_limpio := RIGHT(regexp_replace(v_telefono_raw, '\D', '', 'g'), 10);
  END IF;

  IF v_telefono_limpio IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.base_confianza
    WHERE RIGHT(regexp_replace(telefono, '\D', '', 'g'), 10) = v_telefono_limpio
  ) THEN
    v_status := 'activo';
    v_origen := 'base_confianza';
  END IF;

  INSERT INTO public.perfiles (
    id,
    rol,
    correo,
    full_name,
    telefono,
    documento,
    tipo_documento,
    fecha_nacimiento,
    ubicacion,
    status,
    referido_por,
    origen_autorizacion,
    datos_adicionales
  )
  VALUES (
    NEW.id,
    'customer'::public.rol_usuario,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(v_telefono_limpio, v_telefono_raw),
    NEW.raw_user_meta_data ->> 'documento',
    NULLIF(NEW.raw_user_meta_data ->> 'tipo_documento', '')::public.tipo_doc,
    NULLIF(NEW.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
    NEW.raw_user_meta_data ->> 'ubicacion',
    v_status,
    v_referido_por,
    v_origen,
    jsonb_build_object(
      'acepta_politicas', COALESCE((NEW.raw_user_meta_data ->> 'acepta_politica_privacidad')::boolean, false),
      'acepta_terminos', COALESCE((NEW.raw_user_meta_data ->> 'acepta_terminos')::boolean, false),
      'fecha_aceptacion', NOW(),
      'fecha_registro', NOW()
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;