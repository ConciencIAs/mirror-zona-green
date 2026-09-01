import { Component, computed, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { EstadoOrden, Orden, Perfil } from '@src/app/shared/models/interfaces/db/db';
import { MonedaPipe, FechaFormatoPipe } from '@src/app/shared/pipes/';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-ordenes',
  standalone: true,
  imports: [
    CommonModule,
    FechaFormatoPipe,
    MonedaPipe,
    FormsModule,
    ButtonModule,
    SelectModule,
    TextareaModule,
    IftaLabelModule,
    DatePickerModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    FloatLabelModule,
    DialogModule,
    TooltipModule,
  ],
  templateUrl: './ordenes.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Ordenes implements OnInit {
  private readonly dbService = inject(SupabaseDbService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly orders = signal<Orden[]>([]);
  protected readonly perfilesMap = signal<Map<string, Perfil>>(new Map());

  // ── Modal e Impresión ──
  protected readonly showPrintModal = signal(false);
  protected readonly selectedOrderForPrint = signal<Orden | null>(null);
  protected readonly customObservaciones = signal<string>('');

  protected readonly statusOptions: { label: string; value: EstadoOrden | '' }[] = [
    { label: 'Todos', value: '' },
    { label: 'Selección', value: 'seleccion' },
    { label: 'Aporte', value: 'aporte' },
    { label: 'En preparación', value: 'en_proceso' },
    { label: 'En ruta', value: 'enviado' },
    { label: 'Entregado', value: 'entregado' },
    { label: 'Cancelado', value: 'cancelado' },
  ];

  protected readonly updateStatusOptions: { label: string; value: EstadoOrden }[] = [
    { label: 'Selección', value: 'seleccion' },
    { label: 'Aporte', value: 'aporte' },
    { label: 'En preparación', value: 'en_proceso' },
    { label: 'En ruta', value: 'enviado' },
    { label: 'Entregado', value: 'entregado' },
    { label: 'Cancelado', value: 'cancelado' },
  ];

  protected readonly tipoEntregaOptions = [
    { label: 'Todos', value: '' },
    { label: 'Envío', value: 'envío' },
    { label: 'Recoger en punto', value: 'recoger en punto' },
  ];

  protected readonly filterStatus = signal<EstadoOrden | ''>('');
  protected readonly filterTipoEntrega = signal<string>('');
  protected readonly filterCorreoCliente = signal<string>('');
  protected readonly filterFechaRango = signal<Date[] | null>(null);

  protected readonly filteredOrders = computed(() => {
    let currentOrders = this.orders();

    const fStatus = this.filterStatus();
    if (fStatus) {
      currentOrders = currentOrders.filter((o) => o.status === fStatus);
    }

    const fTipoEntrega = this.filterTipoEntrega().toLowerCase();
    if (fTipoEntrega) {
      currentOrders = currentOrders.filter((o) =>
        o.tipo_entrega?.toLowerCase().includes(fTipoEntrega),
      );
    }

    const fCorreoCliente = this.filterCorreoCliente().toLowerCase();
    if (fCorreoCliente) {
      currentOrders = currentOrders.filter((o) =>
        o.correo_cliente?.toLowerCase().includes(fCorreoCliente),
      );
    }

    const fFechaRango = this.filterFechaRango();
    if (fFechaRango && fFechaRango.length > 0) {
      const start = fFechaRango[0];
      const end = fFechaRango[1] || fFechaRango[0];

      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);

      currentOrders = currentOrders.filter((o) => {
        if (!o.created_at) return false;
        const orderDate = new Date(o.created_at);
        return orderDate >= startDate && orderDate <= endDate;
      });
    }

    return currentOrders;
  });

  protected getStatusColor(status: EstadoOrden): string {
    switch (status) {
      case 'seleccion':
        return 'bg-pink-100 text-pink-700';
      case 'aporte':
        return 'bg-blue-100 text-blue-700';
      case 'en_proceso':
        return 'bg-yellow-100 text-yellow-700';
      case 'enviado':
        return 'bg-orange-100 text-orange-700';
      case 'entregado':
        return 'bg-green-100 text-green-700';
      case 'cancelado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  protected readonly hasOrders = computed(() => this.filteredOrders().length > 0);

  ngOnInit(): void {
    void this.loadOrders();
  }

  private async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      // Cargar órdenes
      const { error, data } = await this.dbService
        .from(TableName.ORDENES)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const orders = (data as Orden[]) || [];
      this.orders.set(orders);

      // Cargar perfiles para obtener teléfonos y nombres completos
      const { data: perfilesData } = await this.dbService.select(TableName.PERFILES);
      if (perfilesData) {
        const map = new Map<string, Perfil>();
        for (const p of perfilesData as unknown as Perfil[]) {
          map.set(p.id, p);
        }
        this.perfilesMap.set(map);
      }
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo cargar las órdenes. Intenta nuevamente.');
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Helpers de información del cliente ──
  protected getNombreCliente(order: Orden): string {
    const perfil = this.perfilesMap().get(order.usuario_id);
    return order.nombre_cliente || perfil?.full_name || order.correo_cliente || '—';
  }

  protected getTelefonoCliente(order: Orden): string {
    const perfil = this.perfilesMap().get(order.usuario_id);
    return perfil?.telefono || '—';
  }

  protected getDireccionEntrega(order: Orden): string {
    const perfil = this.perfilesMap().get(order.usuario_id);
    return order.direccion || perfil?.ubicacion || '—';
  }

  // ── Funcionalidad de Impresión 10x15 cm ──
  protected abrirModalImpresion(order: Orden): void {
    this.selectedOrderForPrint.set(order);
    this.customObservaciones.set(order.comentarios_usuario || '');
    this.showPrintModal.set(true);
  }

  protected imprimirEtiqueta(orderInput?: Orden | null): void {
    const order = orderInput || this.selectedOrderForPrint();
    if (!order) return;

    const nombre = this.getNombreCliente(order);
    const direccion = this.getDireccionEntrega(order);
    const telefono = this.getTelefonoCliente(order);
    const observaciones = this.customObservaciones() || order.comentarios_usuario || 'Sin observaciones';

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Etiqueta de Envío (10x15cm) - Orden #${order.id.slice(0, 8)}</title>
          <style>
            @page {
              size: 100mm 150mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: Arial, Helvetica, sans-serif;
            }
            body {
              width: 100mm;
              height: 150mm;
              padding: 6mm;
              background: #ffffff;
              color: #000000;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              font-size: 10pt;
            }
            .header-banner {
              border-bottom: 2px solid #000;
              padding-bottom: 3mm;
              margin-bottom: 4mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .brand-name {
              font-size: 13pt;
              font-weight: 800;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .order-badge {
              font-size: 9pt;
              font-family: monospace;
              font-weight: bold;
              border: 1px solid #000;
              padding: 1mm 2mm;
              border-radius: 2mm;
            }
            .label-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 4mm;
            }
            .label-table th, .label-table td {
              border: 1px solid #000;
              padding: 3mm;
              vertical-align: top;
            }
            .title-cell {
              width: 28%;
              font-size: 8pt;
              font-weight: bold;
              text-transform: uppercase;
              background-color: #f2f2f2;
              color: #222;
            }
            .value-cell {
              font-size: 10.5pt;
              font-weight: 600;
              word-break: break-word;
            }
            .value-large {
              font-size: 12pt;
              font-weight: bold;
            }
            .obs-container {
              border: 1.5px solid #000;
              border-radius: 1mm;
              flex-grow: 1;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              min-height: 48mm;
            }
            .obs-header {
              font-size: 8.5pt;
              font-weight: bold;
              text-transform: uppercase;
              border-bottom: 1px dashed #666;
              padding-bottom: 1.5mm;
              margin-bottom: 2mm;
              color: #333;
            }
            .obs-body {
              font-size: 9.5pt;
              white-space: pre-wrap;
              color: #111;
              flex-grow: 1;
              line-height: 1.3;
            }
            .footer-info {
              margin-top: 3mm;
              text-align: center;
              font-size: 7.5pt;
              color: #555;
              border-top: 1px solid #ccc;
              padding-top: 1.5mm;
            }
          </style>
        </head>
        <body>
          <div>
            <div class="header-banner">
              <span class="brand-name">CHEIN VERDEN</span>
              <span class="order-badge">ORDEN #${order.id.slice(0, 8)}</span>
            </div>

            <table class="label-table">
              <tr>
                <td class="title-cell">PARA:</td>
                <td class="value-cell value-large">${nombre}</td>
              </tr>
              <tr>
                <td class="title-cell">DIRECCIÓN:</td>
                <td class="value-cell">${direccion}</td>
              </tr>
              <tr>
                <td class="title-cell">CONTACTO:</td>
                <td class="value-cell">${telefono}</td>
              </tr>
            </table>

            <div class="obs-container">
              <div class="obs-header">OBSERVACIONES</div>
              <div class="obs-body">${observaciones}</div>
            </div>
          </div>

          <div class="footer-info">
            CHEIN VERDEN — Etiqueta de Despacho (10 x 15 cm)
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  protected async saveOrder(order: Orden): Promise<void> {
    this.saving.set(true);
    this.error.set('');

    try {
      const newStatus = order.status;
      const newTrackingRecord = { status: newStatus, date: new Date().toISOString() };

      const updates = {
        status: newStatus,
        tracking: [...(order.tracking || []), newTrackingRecord],
      };

      const { error } = await this.dbService.update(TableName.ORDENES, updates, {
        id: order.id,
      });

      if (error) {
        throw error;
      }

      await this.loadOrders();
    } catch (error) {
      console.error(error);
      this.error.set('No se pudo actualizar la orden. Intenta nuevamente.');
    } finally {
      this.saving.set(false);
    }
  }
}
