import { normalizarCelular } from './telefono';

/** Qué se encontró en un archivo de contactos (sin guardar nombres ni otros datos). */
export interface ResumenContactos {
  /** Contactos o filas leídas. */
  contactos: number;
  /** Números de teléfono encontrados (con repetidos). */
  numeros: number;
  /** Números sin formato de celular reconocible. */
  invalidos: number;
  /** Válidos que aparecían más de una vez en el archivo. */
  repetidosEnArchivo: number;
  /** Ya existían en la base de confianza (lo completa quien carga). */
  yaEnBase: number;
}

export interface LecturaContactos extends Omit<ResumenContactos, 'yaEnBase'> {
  /** Números válidos y distintos, en formato internacional (+57…). */
  unicos: string[];
}

/** Líneas de una tarjeta vCard continúan en la siguiente cuando ésta empieza con espacio o tabulador. */
function desdoblarVcf(texto: string): string[] {
  return texto.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

/** Teléfonos de un archivo .vcf (iPhone, Mac, Android). Ignora nombres, fotos y demás campos. */
export function telefonosDeVcf(texto: string): { contactos: number; telefonos: string[] } {
  const lineas = desdoblarVcf(texto);
  const telefonos: string[] = [];
  let contactos = 0;
  for (const linea of lineas) {
    if (/^BEGIN:VCARD/i.test(linea)) contactos++;
    const m = /^(?:[A-Za-z0-9-]+\.)?TEL(?:;[^:]*)?:(.*)$/i.exec(linea);
    if (m && m[1].trim()) telefonos.push(m[1].trim());
  }
  return { contactos, telefonos };
}

/** Celdas con pinta de número de teléfono (dígitos, +, espacios, guiones, paréntesis): descarta nombres y encabezados. */
function pareceTelefono(valor: string): boolean {
  return /^[+\d][\d\s().+-]{5,}$/.test(valor.trim());
}

/** Teléfonos de una hoja de cálculo o de texto separado por comas, punto y coma o tabulaciones. */
export function telefonosDeFilas(filas: unknown[][]): { contactos: number; telefonos: string[] } {
  const telefonos: string[] = [];
  let contactos = 0;
  for (const fila of filas) {
    if (!Array.isArray(fila)) continue;
    const encontrados = fila.map((c) => String(c ?? '').trim()).filter(pareceTelefono);
    if (encontrados.length) contactos++;
    telefonos.push(...encontrados);
  }
  return { contactos, telefonos };
}

/** Normaliza, valida y quita repetidos con las mismas reglas que la base de datos (normalizar_telefono). */
export function prepararTelefonos(contactos: number, crudos: string[]): LecturaContactos {
  const vistos = new Set<string>();
  let invalidos = 0;
  let repetidos = 0;
  for (const crudo of crudos) {
    const n = normalizarCelular(crudo);
    if (!n) {
      invalidos++;
      continue;
    }
    if (vistos.has(n)) repetidos++;
    else vistos.add(n);
  }
  return { contactos, numeros: crudos.length, invalidos, repetidosEnArchivo: repetidos, unicos: [...vistos] };
}

/** Lee un archivo .vcf, .xlsx/.xls, .csv o .txt y devuelve sus teléfonos preparados. */
export async function telefonosDeArchivo(archivo: File): Promise<LecturaContactos> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
    const filas = libro.SheetNames.flatMap((hoja) => XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[hoja], { header: 1 }));
    const { contactos, telefonos } = telefonosDeFilas(filas);
    return prepararTelefonos(contactos, telefonos);
  }

  const texto = await archivo.text();
  if (nombre.endsWith('.vcf') || /^\s*BEGIN:VCARD/i.test(texto)) {
    const { contactos, telefonos } = telefonosDeVcf(texto);
    return prepararTelefonos(contactos, telefonos);
  }
  const filas = texto.split(/\r?\n/).map((linea) => linea.split(/[;,\t]/));
  const { contactos, telefonos } = telefonosDeFilas(filas);
  return prepararTelefonos(contactos, telefonos);
}
