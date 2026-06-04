export interface CustomerData {
  full_name: string;
  correo: string;
  telefono: string;
  documento: string;
  fecha_nacimiento: string;
  tipo_documento: 'CC' | 'CE' | 'NIT' | 'Pasaporte';
  ubicacion: string;
  acepta_terminos: boolean;
  acepta_politica_privacidad: boolean;
}