export interface CustomerData {
  full_name: string;
  correo: string;
  telefono: number;
  documento: number;
  fecha_nacimiento: Date;
  tipo_documento: 'CC' | 'CE' | 'NIT' | 'Pasaporte';
  ubicacion: string;
  acepta_terminos: boolean;
  acepta_politica_privacidad: boolean;
}