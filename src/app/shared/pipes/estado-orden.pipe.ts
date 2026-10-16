import { Pipe, PipeTransform } from '@angular/core';
import { nombreEstadoOrden } from '@src/app/shared/utils/estados-orden';

/**
 * Pipe para mostrar el estado de un pedido con su nombre.
 *
 * Uso:
 *   {{ order.status | estadoOrden }}   → "Aporte recibido"
 */
@Pipe({
  name: 'estadoOrden',
  standalone: true,
  pure: true,
})
export class EstadoOrdenPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return nombreEstadoOrden(value);
  }
}
