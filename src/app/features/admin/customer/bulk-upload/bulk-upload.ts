import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';

// PrimeNG
import { FileUploadModule, FileUploadHandlerEvent } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

// Service
import { AdminUsersService } from '@src/app/core/services/admin/admin-users.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

@Component({
  selector: 'app-bulk-upload',
  standalone: true,
  imports: [FileUploadModule, ButtonModule, TagModule],
  template: `
    <div class="space-y-6 pt-16 mx-2">

      <!-- Header -->
      <div>
        <h2 class="text-2xl font-semibold text-slate-900">Carga Masiva — Base de Confianza</h2>
        <p class="mt-1 text-sm text-slate-500">
          Sube un archivo Excel (.xlsx) con una columna de correos electrónicos.
          Los correos se agregarán a la base de confianza para auto-aprobación automática en su registro.
        </p>
      </div>

      <!-- ═══════════ EJEMPLO / PLANTILLA DE FORMATO EXCEL ═══════════ -->
      <div class="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 mb-1">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Estructura requerida del archivo Excel
            </span>
            <h3 class="text-base font-semibold text-slate-900">Ejemplo del formato de carga</h3>
            <p class="text-xs text-slate-600">
              El archivo debe ser un archivo <strong>.xlsx</strong> o <strong>.xls</strong>. Puede contener una columna llamada <code class="bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800 font-mono">correo</code> o simplemente listar los correos electrónicos en la primera columna.
            </p>
          </div>

          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 flex-shrink-0"
            (click)="descargarPlantillaEjemplo()"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar Plantilla de Ejemplo
          </button>
        </div>

        <!-- Vista previa de la tabla de ejemplo -->
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 font-mono text-slate-700 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-2">Columna A (correo)</th>
                <th class="px-4 py-2 text-slate-400 font-normal italic">Columna B (opcional/ignorado)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-mono text-slate-600">
              <tr class="bg-white">
                <td class="px-4 py-2 font-bold text-slate-800">correo</td>
                <td class="px-4 py-2 text-slate-400 italic">Nombre (opcional)</td>
              </tr>
              <tr class="bg-slate-50/50">
                <td class="px-4 py-2 text-emerald-700">usuario1&#64;ejemplo.com</td>
                <td class="px-4 py-2 text-slate-400">Juan Pérez</td>
              </tr>
              <tr class="bg-white">
                <td class="px-4 py-2 text-emerald-700">maria.gomez&#64;dominio.co</td>
                <td class="px-4 py-2 text-slate-400">María Gómez</td>
              </tr>
              <tr class="bg-slate-50/50">
                <td class="px-4 py-2 text-emerald-700">cliente.confianza&#64;empresa.org</td>
                <td class="px-4 py-2 text-slate-400">Carlos Ruiz</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Upload Zone -->
      <div class="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 transition hover:border-emerald-400 hover:bg-emerald-50/30">
        <p-fileUpload
          id="bulk-upload-input"
          mode="advanced"
          name="excelFile"
          [accept]="'.xlsx,.xls'"
          [maxFileSize]="5000000"
          [auto]="false"
          [customUpload]="true"
          (uploadHandler)="onUpload($event)"
          chooseLabel="Seleccionar archivo Excel"
          uploadLabel="Procesar y Cargar"
          cancelLabel="Cancelar"
          chooseIcon="pi pi-file-excel"
          uploadIcon="pi pi-cloud-upload"
          [showUploadButton]="true"
          [showCancelButton]="true"
        >
          <ng-template #empty>
            <div class="flex flex-col items-center justify-center py-6 text-slate-400">
              <svg class="h-12 w-12 mb-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p class="text-sm font-medium text-slate-700">Arrastra tu archivo .xlsx aquí</p>
              <p class="text-xs mt-1 text-slate-400">o haz clic en "Seleccionar archivo Excel" (máx. 5MB)</p>
            </div>
          </ng-template>
        </p-fileUpload>
      </div>

      <!-- Resultados del parseo -->
      @if (parsedEmails().length > 0) {
        <div class="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-800">
              Correos extraídos
            </h3>
            <p-tag [value]="parsedEmails().length + ' correos'" severity="info" [rounded]="true" />
          </div>

          <div class="max-h-60 overflow-auto rounded-xl bg-slate-50 p-4 space-y-1">
            @for (email of parsedEmails(); track email) {
              <p class="text-sm text-slate-600 font-mono flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                {{ email }}
              </p>
            }
          </div>

          @if (uploadResult()) {
            <div class="mt-4 rounded-xl p-3 text-sm font-medium"
              [class.bg-emerald-50]="uploadResult() === 'success'"
              [class.text-emerald-700]="uploadResult() === 'success'"
              [class.bg-red-50]="uploadResult() === 'error'"
              [class.text-red-700]="uploadResult() === 'error'"
            >
              @if (uploadResult() === 'success') {
                ✅ {{ parsedEmails().length }} correos cargados exitosamente a la base de confianza.
              }
              @if (uploadResult() === 'error') {
                ❌ Ocurrió un error al cargar los correos. Revisa la consola o intenta de nuevo.
              }
            </div>
          }
        </div>
      }

      <!-- Estado de procesando -->
      @if (processing()) {
        <div class="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 border border-blue-200">
          <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Procesando archivo y registrando en la base de confianza...
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BulkUpload {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly toastService = inject(ToastService);

  readonly parsedEmails = signal<string[]>([]);
  readonly processing = signal(false);
  readonly uploadResult = signal<'success' | 'error' | null>(null);

  /**
   * Genera y descarga dinámicamente un archivo plantilla .xlsx de ejemplo
   */
  async descargarPlantillaEjemplo(): Promise<void> {
    try {
      const XLSX = await import('xlsx');

      const data = [
        ['correo', 'nombre'],
        ['usuario1@ejemplo.com', 'Juan Pérez'],
        ['maria.gomez@dominio.co', 'María Gómez'],
        ['cliente.confianza@empresa.org', 'Carlos Ruiz'],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'BaseConfianza');

      XLSX.writeFile(workbook, 'plantilla_base_confianza.xlsx');
      this.toastService.success('Plantilla de ejemplo descargada.');
    } catch (err) {
      console.error('Error al generar la plantilla de ejemplo:', err);
      this.toastService.error('No se pudo descargar la plantilla.');
    }
  }

  async onUpload(event: FileUploadHandlerEvent): Promise<void> {
    const file = event.files[0];
    if (!file) return;

    this.processing.set(true);
    this.uploadResult.set(null);
    this.parsedEmails.set([]);

    try {
      const XLSX = await import('xlsx');

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const correos: string[] = [];

      for (const row of rows) {
        for (const cell of row) {
          const val = String(cell ?? '').trim().toLowerCase();
          if (emailRegex.test(val)) {
            correos.push(val);
          }
        }
      }

      const correosUnicos = [...new Set(correos)];
      this.parsedEmails.set(correosUnicos);

      if (correosUnicos.length === 0) {
        this.toastService.warn('No se encontraron correos válidos en el archivo.');
        this.processing.set(false);
        return;
      }

      const { success } = await this.adminUsersService.cargarBaseConfianza(correosUnicos);
      this.uploadResult.set(success ? 'success' : 'error');
    } catch (err) {
      console.error('Error al procesar archivo Excel:', err);
      this.toastService.error('Error al leer el archivo Excel. Verifica el formato.');
      this.uploadResult.set('error');
    } finally {
      this.processing.set(false);
    }
  }
}
