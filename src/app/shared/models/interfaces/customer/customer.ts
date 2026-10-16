export interface CustomerData {
  full_name: string;
  correo: string;
  /** Celular tal como lo escribió la persona; se normaliza al guardar. */
  telefono: string;
  documento: number;
  fecha_nacimiento: Date;
  tipo_documento: 'CC' | 'CE' | 'NIT' | 'Pasaporte';
  ubicacion: string;
  acepta_terminos: boolean;
  acepta_politica_privacidad: boolean;
  codigo_referido?: string;
}