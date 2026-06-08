import { Pipe, PipeTransform } from '@angular/core';

export type FechaFormato = 'corto' | 'largo' | 'solo-fecha' | 'solo-hora';

/**
 * Pipe para formatear fechas en español (Colombia).
 *
 * Uso:
 *   {{ valor | fechaFormato }}              → "08/06/2026, 16:30"  (formato por defecto: 'largo')
 *   {{ valor | fechaFormato:'corto' }}      → "08/06/2026"
 *   {{ valor | fechaFormato:'largo' }}      → "8 de junio de 2026, 4:30 p. m."
 *   {{ valor | fechaFormato:'solo-fecha' }} → "08/06/2026"
 *   {{ valor | fechaFormato:'solo-hora' }}  → "04:30 p. m."
 *
 * Acepta: string ISO, Date, number (timestamp) o null/undefined → devuelve '—'
 */
@Pipe({
  name: 'fechaFormato',
  standalone: true,
  pure: true,
})
export class FechaFormatoPipe implements PipeTransform {

  transform(
    value: string | Date | number | null | undefined,
    formato: FechaFormato = 'largo'
  ): string {
    if (value === null || value === undefined || value === '') return '—';

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '—';

    const locale = 'es-CO';

    switch (formato) {
      case 'corto':
        return date.toLocaleDateString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

      case 'largo':
        return date.toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

      case 'solo-fecha':
        return date.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

      case 'solo-hora':
        return date.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        });

      default:
        return date.toLocaleString(locale);
    }
  }
}
