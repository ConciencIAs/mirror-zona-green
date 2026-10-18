import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';

// PrimeNG
import { FileUploadModule, FileUploadHandlerEvent } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

// Service
import { AdminUsersService } from '@src/app/core/services/admin/admin-users.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { telefonosDeArchivo, ResumenContactos } from '@src/app/shared/utils/contactos';

@Component({
  selector: 'app-bulk-upload',
  standalone: true,
  imports: [FileUploadModule, ButtonModule, TagModule],
  template: `
    <div class="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-3 pb-8 pt-6 sm:space-y-6 sm:px-5 sm:pt-10 lg:px-8">

      <!-- Header -->
      <div>
        <h2 class="text-xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-2xl">Carga Masiva — Base de Confianza (Por Teléfono)</h2>
        <p class="mt-2 max-w-3xl break-words text-sm leading-relaxed text-slate-500 dark:text-slate-300">
          Sube el archivo de contactos de las personas de confianza. Quien se registre con uno de esos celulares
          entra directamente como usuario activo.
        </p>
      </div>

      <!-- Formatos aceptados -->
      <div class="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm sm:p-5">
        <h3 class="text-base font-semibold leading-snug text-slate-900">Archivos que se aceptan</h3>
        <ul class="mt-2 space-y-1.5 break-words text-sm leading-relaxed text-slate-700">
          <li><strong>Contactos exportados del celular (.vcf):</strong> iPhone o Mac (Contactos → seleccionar todos → Exportar vCard) y Android (Contactos → Exportar). Es el formato recomendado.</li>
          <li><strong>Hoja de cálculo (.xlsx, .xls) o texto (.csv, .txt):</strong> con los números en cualquier columna. No necesita encabezados ni plantilla.</li>
        </ul>
        <p class="mt-3 break-words text-xs leading-relaxed text-slate-600">
          Se leen solo los números de teléfono; los nombres y demás datos del archivo no se guardan.
          Un celular colombiano se reconoce escrito como 3001234567, 573001234567 o +57 300 123 4567; uno extranjero necesita su indicativo (+54…, +1…).
          Los números inválidos y los que ya están en la base de confianza se omiten, y al final se muestra el resumen.
        </p>
      </div>

      <!-- Upload Zone -->
      <div class="min-w-0 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-emerald-400 hover:bg-emerald-50/30 sm:p-8">
        <p-fileUpload
          class="block w-full min-w-0"
          id="bulk-upload-input"
          mode="advanced"
          name="excelFile"
          [accept]="'.vcf,.xlsx,.xls,.csv,.txt'"
          [maxFileSize]="25000000"
          [auto]="false"
          [customUpload]="true"
          (uploadHandler)="onUpload($event)"
          chooseLabel="Seleccionar archivo"
          uploadLabel="Procesar y Cargar"
          cancelLabel="Cancelar"
          chooseIcon="pi pi-address-book"
          uploadIcon="pi pi-cloud-upload"
          [showUploadButton]="true"
          [showCancelButton]="true"
        >
          <ng-template #empty>
            <div class="flex flex-col items-center justify-center py-6 text-slate-400">
              <svg class="h-12 w-12 mb-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
              <p class="text-sm font-medium text-slate-700">Arrastra tu archivo de contactos aquí</p>
              <p class="text-xs mt-1 text-slate-400">o haz clic en "Seleccionar archivo" (.vcf, .xlsx, .csv; máx. 25 MB)</p>
            </div>
          </ng-template>
        </p-fileUpload>
      </div>

      <!-- Resumen de la carga -->
      @if (resumen(); as r) {
        <div class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="text-base font-semibold text-slate-800 sm:text-lg">Resumen de la carga</h3>
            <p-tag [value]="r.nuevos + ' números nuevos'" [severity]="r.nuevos > 0 ? 'success' : 'info'" [rounded]="true" />
          </div>
          <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div class="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt class="text-slate-600">Contactos leídos</dt><dd class="font-semibold text-slate-900">{{ r.contactos }}</dd></div>
            <div class="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt class="text-slate-600">Números encontrados</dt><dd class="font-semibold text-slate-900">{{ r.numeros }}</dd></div>
            <div class="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt class="text-slate-600">Repetidos en el archivo</dt><dd class="font-semibold text-slate-900">{{ r.repetidosEnArchivo }}</dd></div>
            <div class="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt class="text-slate-600">Ya estaban en la base</dt><dd class="font-semibold text-slate-900">{{ r.yaEnBase }}</dd></div>
            <div class="flex justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2"><dt class="text-amber-900">Inválidos (omitidos)</dt><dd class="font-semibold text-amber-900">{{ r.invalidos }}</dd></div>
            <div class="flex justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2"><dt class="text-emerald-900">Cargados ahora</dt><dd class="font-semibold text-emerald-900">{{ r.nuevos }}</dd></div>
          </dl>
          @if (r.invalidos > 0) {
            <p class="mt-3 text-xs text-slate-600">
              Los inválidos no tienen un formato de celular reconocible (colombiano de 10 dígitos que empieza por 3, o extranjero con indicativo).
              Revísalos en el archivo y vuelve a cargarlos corregidos.
            </p>
          }
          @if (uploadResult() === 'error') {
            <div class="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              ❌ Ocurrió un error al guardar en la base de confianza. No se cargó nada; intenta de nuevo.
            </div>
          }
        </div>
      }

      <!-- Estado de procesando -->
      @if (processing()) {
        <div class="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <svg class="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Leyendo el archivo y preparando los teléfonos...
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    :host ::ng-deep .p-fileupload,
    :host ::ng-deep .p-fileupload-header,
    :host ::ng-deep .p-fileupload-content {
      min-width: 0;
    }

    :host ::ng-deep .p-fileupload-header {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    @media (max-width: 639px) {
      :host ::ng-deep .p-fileupload-header {
        align-items: stretch;
        flex-direction: column;
      }

      :host ::ng-deep .p-fileupload-header .p-button {
        justify-content: center;
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BulkUpload {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly toastService = inject(ToastService);

  readonly resumen = signal<(ResumenContactos & { nuevos: number }) | null>(null);
  readonly processing = signal(false);
  readonly uploadResult = signal<'success' | 'error' | null>(null);

  async onUpload(event: FileUploadHandlerEvent): Promise<void> {
    const file = event.files[0];
    if (!file) return;

    this.processing.set(true);
    this.uploadResult.set(null);
    this.resumen.set(null);

    try {
      const leido = await telefonosDeArchivo(file);
      if (leido.numeros === 0) {
        this.toastService.warn('No se encontraron teléfonos en el archivo.');
        return;
      }

      const existentes = await this.adminUsersService.telefonosBaseConfianza();
      const nuevos = leido.unicos.filter((n) => !existentes.has(n));
      const yaEnBase = leido.unicos.length - nuevos.length;

      const { success } = nuevos.length ? await this.adminUsersService.cargarBaseConfianza(nuevos) : { success: true };
      this.uploadResult.set(success ? 'success' : 'error');
      const { unicos, ...resumen } = leido;
      void unicos;
      this.resumen.set({ ...resumen, yaEnBase, nuevos: success ? nuevos.length : 0 });
    } catch (err) {
      console.error('Error al procesar el archivo de contactos:', err);
      this.toastService.error('No se pudo leer el archivo. Verifica que sea un archivo de contactos (.vcf), Excel o CSV.');
      this.uploadResult.set('error');
    } finally {
      this.processing.set(false);
    }
  }
}
