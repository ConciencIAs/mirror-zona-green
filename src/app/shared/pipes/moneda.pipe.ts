import { Pipe, PipeTransform } from '@angular/core';

export type MonedaCodigo = 'COP' | 'USD' | 'EUR';

/**
 * Pipe para formatear valores monetarios.
 *
 * Uso:
 *   {{ valor | moneda }}              → "$ 12.500"       (COP por defecto, sin decimales)
 *   {{ valor | moneda:'USD' }}        → "US$ 12,50"
 *   {{ valor | moneda:'EUR' }}        → "€ 12,50"
 *   {{ valor | moneda:'COP':true }}   → "$ 12.500,00"    (con decimales)
 *
 * Acepta: number o null/undefined → devuelve '—'
 */
@Pipe({
  name: 'moneda',
  standalone: true,
  pure: true,
})
export class MonedaPipe implements PipeTransform {

  private readonly CONFIG: Record<MonedaCodigo, { locale: string; decimales: number }> = {
    COP: { locale: 'es-CO', decimales: 0 },
    USD: { locale: 'en-US', decimales: 2 },
    EUR: { locale: 'es-ES', decimales: 2 },
  };

  transform(
    value: number | null | undefined,
    moneda: MonedaCodigo = 'COP',
    conDecimales?: boolean
  ): string {
    if (value === null || value === undefined || isNaN(value)) return '—';

    const { locale, decimales } = this.CONFIG[moneda];
    const fraccionDigitos = conDecimales !== undefined
      ? (conDecimales ? decimales || 2 : 0)
      : decimales;

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: fraccionDigitos,
      maximumFractionDigits: fraccionDigitos,
    }).format(value);
  }
}
