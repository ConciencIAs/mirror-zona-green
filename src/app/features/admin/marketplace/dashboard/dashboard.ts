import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';

import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { Orden, SnapshotAnalitica } from '@src/app/shared/models/interfaces/db/db';

import { NgApexchartsModule } from 'ng-apexcharts';

// Interfaces procesadas para las tablas del dashboard
export interface PaqueteVendido {
  gramos: number;
  cantidadVendida: number;
  ingresos: number;
}

export interface ProductoResumen {
  nombre: string;
  sku: string;
  es_por_gramos: boolean;
  cantidad: number;
  totalGramos: number;
  ingresos: number;
  ordenes: number; // en cuántas órdenes aparece
  paquetesVendidos: PaqueteVendido[]; // desglose por paquete (solo gramos)
}

export interface UsuarioResumen {
  nombre: string;
  correo: string;
  totalOrdenes: number;
  gastado: number;
  ultimaOrden: string | null;
  productosComprados: number;
  gramosComprados: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePickerModule,
    TableModule,
    NgApexchartsModule,
    CardModule,
    ButtonModule,
    TagModule,
    SelectModule,
    TabsModule,
    TooltipModule,
  ],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit {
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);

  // Filtros
  fechaInicio: Date | undefined;
  fechaFin: Date | undefined;
  usuarioSeleccionado: string | null = null;

  // Datos crudos
  ordenesDb: Orden[] = [];
  ordenesFiltradas: Orden[] = [];

  // KPIs
  totalVentas: number = 0;
  totalOrdenes: number = 0;
  ticketPromedio: number = 0;
  totalProductosVendidos: number = 0;
  totalGramosVendidos: number = 0;
  tasaCancelacion: number = 0;
  ordenesCompletadas: number = 0;

  // Datos procesados
  topProductosGramos: ProductoResumen[] = [];
  topProductosUnidad: ProductoResumen[] = [];
  topUsuarios: UsuarioResumen[] = [];
  listaUsuarios: { label: string; value: string }[] = [];

  // ApexCharts – Donut de estados
  chartSeries: number[] = [];
  chartLabels: string[] = [];
  chartConfig: any = {};
  chartDataLabels: any = {};
  chartLegend: any = {};
  chartColors: string[] = [];
  chartResponsive: any[] = [];

  // ApexCharts – Barras de productos top
  barChartSeries: any[] = [];
  barChartConfig: any = {};
  barChartXaxis: any = {};
  barChartDataLabels: any = {};
  barChartColors: string[] = [];
  barChartPlotOptions: any = {};

  cargando: boolean = true;

  ngOnInit() {
    this.inicializarOpcionesGraficas();
    void this.cargarTodasLasOrdenes();
  }

  async cargarTodasLasOrdenes() {
    this.cargando = true;
    try {
      const { error, data } = await this.dbService
        .from(TableName.ORDENES)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.toastService.error('Error al cargar órdenes', error.message);
        return;
      }

      this.ordenesDb = (data as Orden[]) || [];
      this.construirListaUsuarios(this.ordenesDb);
      this.analizarDatos(this.ordenesDb);
    } catch (e) {
      this.toastService.error('Error inesperado al cargar datos');
    } finally {
      this.cargando = false;
    }
  }

  async filtrarPorFechas() {
    if (!this.fechaInicio || !this.fechaFin) {
      this.toastService.warn('Debe seleccionar un rango de fechas');
      return;
    }

    this.cargando = true;
    const inicio = this.fechaInicio.toISOString();
    const fin = new Date(this.fechaFin);
    fin.setHours(23, 59, 59, 999);

    const { error, data } = await this.dbService
      .from(TableName.ORDENES)
      .select('*')
      .gte('created_at', inicio)
      .lte('created_at', fin.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      this.toastService.error('Error al filtrar órdenes', error.message);
      this.cargando = false;
      return;
    }

    this.ordenesDb = data || [];
    this.construirListaUsuarios(this.ordenesDb);
    this.aplicarFiltroUsuario();
    this.cargando = false;
  }

  limpiarFiltros() {
    this.fechaInicio = undefined;
    this.fechaFin = undefined;
    this.usuarioSeleccionado = null;
    void this.cargarTodasLasOrdenes();
  }

  onUsuarioChange() {
    this.aplicarFiltroUsuario();
  }

  private aplicarFiltroUsuario() {
    if (this.usuarioSeleccionado) {
      const filtradas = this.ordenesDb.filter(o => o.correo_cliente === this.usuarioSeleccionado);
      this.analizarDatos(filtradas);
    } else {
      this.analizarDatos(this.ordenesDb);
    }
  }

  private construirListaUsuarios(datos: Orden[]) {
    const mapaUsuarios = new Map<string, string>();
    datos.forEach(orden => {
      if (orden.correo_cliente && !mapaUsuarios.has(orden.correo_cliente)) {
        mapaUsuarios.set(orden.correo_cliente, orden.nombre_cliente || orden.correo_cliente);
      }
    });
    this.listaUsuarios = [
      { label: 'Todos los usuarios', value: '' },
      ...Array.from(mapaUsuarios.entries()).map(([correo, nombre]) => ({
        label: `${nombre} (${correo})`,
        value: correo
      }))
    ];
  }

  analizarDatos(datos: Orden[]) {
    this.ordenesFiltradas = datos;

    // ── KPIs Generales ──
    this.totalOrdenes = datos.length;
    this.totalVentas = datos.reduce((sum, o) => sum + (o.precio_total || 0), 0);
    this.ticketPromedio = this.totalOrdenes > 0 ? this.totalVentas / this.totalOrdenes : 0;

    const canceladas = datos.filter(o => o.status === 'cancelado').length;
    this.tasaCancelacion = this.totalOrdenes > 0 ? (canceladas / this.totalOrdenes) * 100 : 0;
    this.ordenesCompletadas = datos.filter(o => o.status === 'entregado').length;

    // ── Contadores globales de productos ──
    let totalProductos = 0;
    let totalGramos = 0;

    // ── Análisis por Producto (separado gramos / unidad) ──
    const mapaProductos = new Map<string, ProductoResumen>();

    datos.forEach(orden => {
      if (!orden.lista_productos) return;
      orden.lista_productos.forEach((prod: SnapshotAnalitica) => {
        const key = prod.sku || prod.nombre;
        const actual = mapaProductos.get(key) || {
          nombre: prod.nombre,
          sku: prod.sku,
          es_por_gramos: prod.es_por_gramos,
          cantidad: 0,
          totalGramos: 0,
          ingresos: 0,
          ordenes: 0,
          paquetesVendidos: []
        };

        actual.cantidad += prod.cantidad_comprada;
        actual.ingresos += prod.subtotal;
        actual.ordenes += 1;

        if (prod.es_por_gramos) {
          const gramos = prod.total_gramos_entregados || (prod.paquete_gramos || 0) * prod.cantidad_comprada;
          actual.totalGramos += gramos;
          totalGramos += gramos;

          // Desglose por paquete
          if (prod.paquete_gramos) {
            const paqueteExistente = actual.paquetesVendidos.find(p => p.gramos === prod.paquete_gramos);
            if (paqueteExistente) {
              paqueteExistente.cantidadVendida += prod.cantidad_comprada;
              paqueteExistente.ingresos += prod.subtotal;
            } else {
              actual.paquetesVendidos.push({
                gramos: prod.paquete_gramos,
                cantidadVendida: prod.cantidad_comprada,
                ingresos: prod.subtotal
              });
            }
          }
        }

        totalProductos += prod.cantidad_comprada;
        mapaProductos.set(key, actual);
      });
    });

    this.totalProductosVendidos = totalProductos;
    this.totalGramosVendidos = totalGramos;

    const todosProductos = Array.from(mapaProductos.values());
    this.topProductosGramos = todosProductos
      .filter(p => p.es_por_gramos)
      .sort((a, b) => b.ingresos - a.ingresos);

    this.topProductosUnidad = todosProductos
      .filter(p => !p.es_por_gramos)
      .sort((a, b) => b.ingresos - a.ingresos);

    // ── Análisis por Estado (Donut chart) ──
    const conteoEstados: Record<string, number> = {};
    datos.forEach(orden => {
      conteoEstados[orden.status] = (conteoEstados[orden.status] || 0) + 1;
    });

    this.chartLabels = Object.keys(conteoEstados).map(k => this.formatEstado(k));
    this.chartSeries = Object.values(conteoEstados);

    // ── Análisis por Usuario ──
    const mapaUsuarios = new Map<string, UsuarioResumen>();
    datos.forEach(orden => {
      const correo = orden.correo_cliente || 'desconocido';
      const actual = mapaUsuarios.get(correo) || {
        nombre: orden.nombre_cliente || 'Sin nombre',
        correo,
        totalOrdenes: 0,
        gastado: 0,
        ultimaOrden: null,
        productosComprados: 0,
        gramosComprados: 0
      };

      actual.totalOrdenes += 1;
      actual.gastado += orden.precio_total || 0;

      if (!actual.ultimaOrden || (orden.created_at && orden.created_at > actual.ultimaOrden)) {
        actual.ultimaOrden = orden.created_at;
      }

      if (orden.lista_productos) {
        orden.lista_productos.forEach((prod: SnapshotAnalitica) => {
          actual.productosComprados += prod.cantidad_comprada;
          if (prod.es_por_gramos) {
            actual.gramosComprados += prod.total_gramos_entregados || (prod.paquete_gramos || 0) * prod.cantidad_comprada;
          }
        });
      }

      mapaUsuarios.set(correo, actual);
    });

    this.topUsuarios = Array.from(mapaUsuarios.values())
      .sort((a, b) => b.gastado - a.gastado);

    // ── Barras top 5 productos ──
    const top5 = todosProductos.sort((a, b) => b.ingresos - a.ingresos).slice(0, 5);
    this.barChartSeries = [{
      name: 'Ingresos',
      data: top5.map(p => p.ingresos)
    }];
    this.barChartXaxis = {
      categories: top5.map(p => p.nombre.length > 18 ? p.nombre.substring(0, 18) + '…' : p.nombre),
      labels: { style: { fontSize: '11px' } }
    };
  }

  formatEstado(status: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      pagado: 'Pagado',
      en_proceso: 'En Proceso',
      enviado: 'Enviado',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    };
    return map[status] || status;
  }

  getSeverity(status: string): any {
    switch (status) {
      case 'entregado': return 'success';
      case 'enviado': return 'info';
      case 'en_proceso': return 'warn';
      case 'pagado': return 'info';
      case 'cancelado': return 'danger';
      case 'pendiente': return 'secondary';
      default: return 'secondary';
    }
  }

  formatGramos(gramos: number): string {
    if (gramos >= 1000) {
      return `${(gramos / 1000).toFixed(1)} kg`;
    }
    return `${gramos} g`;
  }

  private inicializarOpcionesGraficas() {
    // Donut chart
    this.chartConfig = {
      type: 'donut' as const,
      height: 280,
      fontFamily: 'Inter, sans-serif',
    };
    this.chartColors = ['#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ef4444', '#8b5cf6'];
    this.chartDataLabels = { enabled: true };
    this.chartLegend = { position: 'bottom', fontSize: '12px' };
    this.chartResponsive = [{
      breakpoint: 480,
      options: { chart: { width: 260 }, legend: { position: 'bottom' } }
    }];

    // Bar chart
    this.barChartConfig = {
      type: 'bar' as const,
      height: 280,
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
    };
    this.barChartColors = ['#6366f1'];
    this.barChartDataLabels = { enabled: false };
    this.barChartPlotOptions = {
      bar: { borderRadius: 6, horizontal: false, columnWidth: '55%' }
    };
  }
}