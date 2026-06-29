import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SettingsConfig } from '@src/app/shared/models/interfaces/page-config.interface';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

@Component({
  selector: 'app-config-general',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule],
  template: `
    @if (loading()) {
      <div class="flex flex-col items-center justify-center py-20 gap-3">
        <i class="pi pi-spin pi-spinner text-4xl text-emerald-600"></i>
        <p class="text-slate-500 dark:text-slate-400 text-sm">Cargando configuración...</p>
      </div>
    } @else {
      <div class="flex flex-col gap-4">
        <div class="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 m-0">Información General</h2>
            <p class="text-slate-500 dark:text-slate-400 mt-1 text-sm">Configuración básica que se utiliza en diferentes partes del sitio web.</p>
          </div>
          <p-button label="Guardar Sección General" icon="pi pi-check" [loading]="saving()" (onClick)="saveConfig()" styleClass="p-button-emerald"></p-button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          <div class="flex flex-col gap-2">
            <label for="config-nombre" class="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre de la Aplicación / Marca</label>
            <input id="config-nombre" pInputText type="text" [(ngModel)]="settings().nombre" placeholder="Zona Green" class="w-full" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="config-telefono" class="text-sm font-semibold text-slate-700 dark:text-slate-300">Teléfono General</label>
            <input id="config-telefono" pInputText type="text" [(ngModel)]="settings().telefono" placeholder="+57 300 123 4567" class="w-full" />
          </div>

          <div class="flex flex-col gap-2 md:col-span-2">
            <label for="config-logo" class="text-sm font-semibold text-slate-700 dark:text-slate-300">URL del Logo (Imagen)</label>
            <div class="flex items-center gap-4">
              <input id="config-logo" pInputText type="text" [(ngModel)]="settings().logo_url" placeholder="https://ejemplo.com/logo.png" class="flex-1" />
              @if (settings().logo_url) {
              <div class="w-14 h-14 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-1 flex-shrink-0">
                <img [src]="settings().logo_url" alt="Preview logo" class="max-w-full max-h-full object-contain" />
              </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfigGeneralComponent implements OnInit {
  public readonly configStore = inject(AppConfigStore);
  private readonly pageConfigDbService = inject(PageConfigDbService);
  private readonly toastService = inject(ToastService);

  loading = signal(false);
  saving = signal(false);
  settings = signal<SettingsConfig>({ nombre: '', logo_url: '', telefono: '' });

  async ngOnInit() {
    await this.loadConfig();
  }

  async loadConfig() {
    this.loading.set(true);
    try {
      await this.configStore.ensureSettings();
      const deepClone = <T>(obj: T): T => typeof structuredClone !== 'undefined' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
      this.settings.set(deepClone(this.configStore.settingsConfig()));
    } catch (err) {
      this.toastService.error('Error al cargar la configuración general');
    } finally {
      this.loading.set(false);
    }
  }

  async saveConfig() {
    this.saving.set(true);
    try {
      const res = await this.pageConfigDbService.saveConfigByName('settings', this.settings());
      if (res.error) throw res.error;
      await this.configStore.ensureSettings(true);
      const deepClone = <T>(obj: T): T => typeof structuredClone !== 'undefined' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
      this.settings.set(deepClone(this.configStore.settingsConfig()));
      this.toastService.success('Sección actualizada correctamente');
    } catch (err) {
      this.toastService.error('Error al guardar la configuración');
    } finally {
      this.saving.set(false);
    }
  }
}
