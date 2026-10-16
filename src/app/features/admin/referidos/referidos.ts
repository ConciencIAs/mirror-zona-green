import { Component, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';

/** Fila de public.arbol_referidos() (Fase 2b). */
interface NodoReferido {
  perfil_id: string;
  referente_id: string | null;
  nivel: number;
  ruta: string[];
  full_name: string | null;
  correo: string;
  status: string;
  codigo_invitacion: string | null;
  estado_relacion: 'resuelto' | 'no_resuelto' | 'asignado_manual' | null;
  codigo_usado: string | null;
  alerta: string | null;
  registrado: string | null;
  directos: number;
}

/** Fila de public.ranking_referentes(). */
interface FilaRanking {
  perfil_id: string;
  full_name: string | null;
  correo: string;
  status: string;
  codigo_invitacion: string | null;
  directos: number;
  red_total: number;
  ultimos_30_dias: number;
  con_alerta: number;
}

interface OpcionReferente {
  value: string;
  label: string;
}

type Pestana = 'arbol' | 'ranking' | 'no-resueltos';

/**
 * Trazabilidad de referidos para el admin: quién invitó a quién (árbol),
 * quién trae más personas (ranking) y los registros cuyo código no se pudo
 * atribuir (asignación manual). Los datos salen de funciones de la base que
 * verifican que quien consulta es admin.
 */
@Component({
  selector: 'app-admin-referidos',
  imports: [FormsModule, RouterLink, SelectModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  // CSS propio y no utilidades sm: (el Tailwind del CDN puede anularlas, ver CLAUDE.md).
  styles: `
    @media (max-width: 639px) { .col-num { display: none; } }
    @media (min-width: 640px) { .resumen-movil { display: none; } }
  `,
  template: `
    <div class="pt-16 mx-2 pb-10">
      <a routerLink="/admin" class="text-sm font-semibold text-emerald-700 hover:underline">
        <i class="pi pi-arrow-left text-xs"></i> Gestión de usuarios
      </a>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Árbol de referidos</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-300">Quién invitó a quién, desde el primer registro con código.</p>

      <!-- Resumen -->
      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        @for (kpi of resumen(); track kpi.etiqueta) {
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <p class="text-xs font-medium uppercase tracking-wider text-slate-500">{{ kpi.etiqueta }}</p>
            <p class="mt-1 text-2xl font-bold text-slate-900">{{ kpi.valor }}</p>
          </div>
        }
      </div>

      <!-- Pestañas -->
      <div class="mt-6 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
        @for (p of pestanas; track p.id) {
          <button type="button" role="tab" [attr.aria-selected]="pestana() === p.id" (click)="pestana.set(p.id)"
            class="rounded-lg px-3 py-2 text-sm font-semibold"
            [class]="pestana() === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'">
            {{ p.etiqueta }}
            @if (p.id === 'no-resueltos' && noResueltos().length) {
              <span class="ml-1 rounded-full bg-amber-200 px-1.5 text-xs text-amber-900">{{ noResueltos().length }}</span>
            }
          </button>
        }
      </div>

      @if (cargando()) {
        <p class="mt-6 text-sm text-slate-500"><i class="pi pi-spin pi-spinner"></i> Cargando…</p>
      } @else if (error()) {
        <div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ error() }}</div>
      } @else {
        @switch (pestana()) {
          @case ('arbol') {
            <div class="mt-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
              @if (!arbol().length) {
                <p class="text-sm text-slate-500">Todavía nadie se ha registrado con un código de invitación.</p>
              }
              <ul class="space-y-1">
                @for (nodo of arbol(); track nodo.perfil_id) {
                  <li class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg py-1.5 pr-2 hover:bg-slate-50"
                    [style.padding-left.px]="8 + (nodo.nivel - 1) * 22">
                    @if (nodo.nivel > 1) { <span class="text-slate-300">└</span> }
                    <span class="font-semibold text-slate-900">{{ nodo.full_name || nodo.correo }}</span>
                    <span class="text-xs text-slate-500">{{ nodo.correo }}</span>
                    @if (nodo.codigo_invitacion) {
                      <span class="rounded bg-emerald-50 px-1.5 font-mono text-xs text-emerald-800">{{ nodo.codigo_invitacion }}</span>
                    }
                    @if (nodo.directos) {
                      <span class="text-xs text-slate-600">· {{ nodo.directos }} {{ nodo.directos === 1 ? 'referido' : 'referidos' }}</span>
                    }
                    @if (nodo.estado_relacion === 'no_resuelto') {
                      <span class="rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-900"
                        [pTooltip]="'Usó el código ' + nodo.codigo_usado + ', que no pertenece a nadie'" tooltipPosition="top">No resuelto</span>
                    }
                    @if (nodo.estado_relacion === 'asignado_manual') {
                      <span class="rounded-full bg-blue-100 px-2 text-[11px] font-semibold text-blue-900">Asignado a mano</span>
                    }
                    @if (nodo.alerta) {
                      <span class="rounded-full bg-red-100 px-2 text-[11px] font-semibold text-red-800"
                        pTooltip="Su referente registró más de 20 personas en 24 horas" tooltipPosition="top">Revisar</span>
                    }
                    @if (nodo.status !== 'activo') {
                      <span class="text-[11px] text-slate-500">({{ nodo.status }})</span>
                    }
                  </li>
                }
              </ul>
            </div>
          }
          @case ('ranking') {
            <div class="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th class="px-4 py-3">#</th>
                    <th class="px-4 py-3">Referente</th>
                    <th class="col-num px-4 py-3 text-right">Directos</th>
                    <th class="col-num px-4 py-3 text-right">Red total</th>
                    <th class="col-num px-4 py-3 text-right">Últimos 30 días</th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of ranking(); track fila.perfil_id; let i = $index) {
                    <tr class="border-t border-slate-100">
                      <td class="px-4 py-3 text-slate-500">{{ i + 1 }}</td>
                      <td class="px-4 py-3">
                        <div class="font-semibold text-slate-900">{{ fila.full_name || fila.correo }}</div>
                        <div class="text-xs text-slate-500">{{ fila.correo }}
                          @if (fila.codigo_invitacion) { · <span class="font-mono">{{ fila.codigo_invitacion }}</span> }
                        </div>
                        <div class="resumen-movil mt-1 text-xs font-semibold text-slate-700">
                          {{ fila.directos }} {{ fila.directos === 1 ? 'directo' : 'directos' }} · {{ fila.red_total }} en su red · {{ fila.ultimos_30_dias }} en 30 días
                        </div>
                        @if (fila.con_alerta) {
                          <span class="rounded-full bg-red-100 px-2 text-[11px] font-semibold text-red-800">{{ fila.con_alerta }} con alerta</span>
                        }
                      </td>
                      <td class="col-num px-4 py-3 text-right font-semibold text-slate-900">{{ fila.directos }}</td>
                      <td class="col-num px-4 py-3 text-right text-slate-700">{{ fila.red_total }}</td>
                      <td class="col-num px-4 py-3 text-right text-slate-700">{{ fila.ultimos_30_dias }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="px-4 py-6 text-slate-500">Aún no hay referentes.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('no-resueltos') {
            <div class="mt-4 space-y-3">
              <p class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                Personas que se registraron con un código que no pertenece a ningún perfil activo (por ejemplo, un código revocado).
                Si sabes quién las invitó, asígnalo; queda registrado quién lo hizo y cuándo.
              </p>
              @for (nodo of noResueltos(); track nodo.perfil_id) {
                <div class="rounded-2xl border border-amber-200 bg-white p-4">
                  <div class="flex flex-wrap items-baseline gap-x-2">
                    <span class="font-semibold text-slate-900">{{ nodo.full_name || nodo.correo }}</span>
                    <span class="text-xs text-slate-500">{{ nodo.correo }}</span>
                    <span class="text-xs text-slate-500">· registrado {{ fecha(nodo.registrado) }}</span>
                  </div>
                  <p class="mt-1 text-sm text-slate-700">Código usado: <span class="font-mono font-semibold">{{ nodo.codigo_usado }}</span></p>
                  <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <p-select [options]="opcionesReferente()" [(ngModel)]="seleccion[nodo.perfil_id]" [filter]="true"
                      filterBy="label" placeholder="Elige quién lo invitó" class="w-full sm:w-80" appendTo="body" />
                    <input type="text" [(ngModel)]="notas[nodo.perfil_id]" placeholder="Nota (opcional): cómo lo confirmaste"
                      class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-72" />
                    <button type="button" (click)="asignar(nodo)" [disabled]="!seleccion[nodo.perfil_id] || guardando() === nodo.perfil_id"
                      class="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                      {{ guardando() === nodo.perfil_id ? 'Guardando…' : 'Asignar' }}
                    </button>
                  </div>
                </div>
              } @empty {
                <p class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No hay referidos sin resolver.</p>
              }
            </div>
          }
        }
      }
    </div>
  `,
})
export class AdminReferidos implements OnInit {
  private readonly db = inject(SupabaseDbService);
  private readonly toast = inject(ToastService);

  readonly pestanas: { id: Pestana; etiqueta: string }[] = [
    { id: 'arbol', etiqueta: 'Árbol' },
    { id: 'ranking', etiqueta: 'Ranking' },
    { id: 'no-resueltos', etiqueta: 'No resueltos' },
  ];
  readonly pestana = signal<Pestana>('arbol');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal<string | null>(null);

  readonly arbol = signal<NodoReferido[]>([]);
  readonly ranking = signal<FilaRanking[]>([]);
  readonly opcionesReferente = signal<OpcionReferente[]>([]);
  seleccion: Record<string, string | undefined> = {};
  notas: Record<string, string | undefined> = {};

  readonly noResueltos = computed(() => this.arbol().filter((n) => n.estado_relacion === 'no_resuelto'));
  readonly resumen = computed(() => {
    const referidos = this.arbol().filter((n) => n.estado_relacion !== null);
    return [
      { etiqueta: 'Referidos', valor: referidos.length },
      { etiqueta: 'Referentes', valor: this.ranking().length },
      { etiqueta: 'Niveles', valor: Math.max(0, ...this.arbol().map((n) => n.nivel)) },
      { etiqueta: 'Sin resolver', valor: this.noResueltos().length },
    ];
  });

  ngOnInit(): void {
    void this.cargar();
  }

  fecha(valor: string | null): string {
    return valor ? new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const [arbol, ranking, perfiles] = await Promise.all([
      this.db.rpc('arbol_referidos'),
      this.db.rpc('ranking_referentes'),
      this.db
        .from(TableName.PERFILES)
        .select('id, full_name, correo, codigo_invitacion')
        .eq('status', 'activo')
        .order('full_name'),
    ]);
    if (arbol.error || ranking.error) {
      this.error.set(
        'No se pudo cargar el árbol. Si es la primera vez, falta aplicar la migración 20261016140000_fase2b_referidos.sql.',
      );
    } else {
      this.arbol.set((arbol.data ?? []) as NodoReferido[]);
      this.ranking.set((ranking.data ?? []) as FilaRanking[]);
    }
    const lista = (perfiles.data ?? []) as { id: string; full_name: string | null; correo: string; codigo_invitacion: string | null }[];
    this.opcionesReferente.set(
      lista.map((p) => ({
        value: p.id,
        label: `${p.full_name || p.correo} (${p.correo})${p.codigo_invitacion ? ' · ' + p.codigo_invitacion : ''}`,
      })),
    );
    this.cargando.set(false);
  }

  async asignar(nodo: NodoReferido): Promise<void> {
    const referente = this.seleccion[nodo.perfil_id];
    if (!referente) return;
    this.guardando.set(nodo.perfil_id);
    const { error } = await this.db.rpc('admin_asignar_referente', {
      p_referido: nodo.perfil_id,
      p_referente: referente,
      p_nota: this.notas[nodo.perfil_id]?.trim() || null,
    });
    this.guardando.set(null);
    if (error) {
      this.toast.error(error.message || 'No se pudo asignar el referente.');
      return;
    }
    this.toast.success('Referente asignado.');
    await this.cargar();
  }
}
