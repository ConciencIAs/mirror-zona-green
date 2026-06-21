import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

// Importación del Store Centralizado
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import {
  AppConfig,
  DEFAULT_APP_CONFIG,
  NavItem,
  FooterItem,
  AdvertisingItem,
  NavbarConfig,
  FooterConfig,
  SettingsConfig,
  AdvertisingBannerConfig,
} from '@src/app/shared/models/interfaces/page-config.interface';

@Component({
  selector: 'app-config-app',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './config-app.html',
})
export class ConfigApp implements OnInit {
  // Inyección del nuevo Store único de lectura/carga
  public readonly configStore = inject(AppConfigStore);
  private readonly pageConfigDbService = inject(PageConfigDbService);
  private readonly toastService = inject(ToastService);

  loading = signal(false);
  saving = signal(false);
  activeTab = signal<'general' | 'navbar' | 'footer' | 'publicidad'>('general');

  // Estado local e independiente para los inputs del Formulario
  config = signal<AppConfig>({ ...DEFAULT_APP_CONFIG });

  // Estados de gestión interna de formularios
  newNavbarSectionTitle = signal('');
  newNavbarSectionRoles = signal('');
  newNavbarItems: Record<number, NavItem> = {};
  newFooterSectionTitle = signal('');
  newFooterItems: Record<number, FooterItem> = {};
  newAdvertisingItem = signal<AdvertisingItem>({ text: '', link: '', icon: 'pi pi-megaphone' });

  async ngOnInit(): Promise<void> {
    await this.loadConfig();
  }

  /**
   * Asegura que el store tenga la información actualizada y clona los datos
   * al estado local del formulario para evitar mutaciones directas.
   */
  async loadConfig(): Promise<void> {
    this.loading.set(true);
    try {
      // Forzamos la verificación/carga inicial en el store de todas las secciones paralelamente
      await Promise.all([
        this.configStore.ensureSettings(),
        this.configStore.ensureNavbar(),
        this.configStore.ensureFooter(),
        this.configStore.ensureAdvertising(),
      ]);

      this.syncFormWithStore();
    } catch (err) {
      console.error(err);
      this.toastService.error('Error al sincronizar datos con el servidor');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Realiza una copia profunda (Deep Copy) desde las señales computadas del Store
   * hacia el formulario local.
   */
  private syncFormWithStore(): void {
    const store = this.configStore;

    // Helper seguro de clonación compatible con navegadores modernos
    const deepClone = <T>(obj: T): T =>
      typeof structuredClone !== 'undefined'
        ? structuredClone(obj)
        : JSON.parse(JSON.stringify(obj));

    this.config.set({
      nombre: store.settingsConfig().nombre,
      logo_url: store.settingsConfig().logo_url,
      telefono: store.settingsConfig().telefono,
      navbar: deepClone(store.navbarConfig()),
      footer: deepClone(store.footerConfig()),
      advertising_banner: deepClone(store.advertisingConfig().items),
    });
  }

  /**
   * Guarda de forma exclusiva y atómica el JSON de la sección activa
   */
  async saveConfig(): Promise<void> {
    const tab = this.activeTab();
    const currentForm = this.config();
    this.saving.set(true);

    try {
      let error = null;

      switch (tab) {
        case 'general': {
          const settingsPayload: SettingsConfig = {
            nombre: currentForm.nombre,
            logo_url: currentForm.logo_url,
            telefono: currentForm.telefono,
          };
          const res = await this.pageConfigDbService.saveConfigByName('settings', settingsPayload);
          error = res.error;
          // Si no hay error, forzamos al Store público a refrescar inmediatamente su fragmento
          if (!error) await this.configStore.ensureSettings(true);
          break;
        }

        case 'navbar': {
          const res = await this.pageConfigDbService.saveConfigByName('navbar', currentForm.navbar);
          error = res.error;
          if (!error) await this.configStore.ensureNavbar(true);
          break;
        }

        case 'footer': {
          const res = await this.pageConfigDbService.saveConfigByName('footer', currentForm.footer);
          error = res.error;
          if (!error) await this.configStore.ensureFooter(true);
          break;
        }

        case 'publicidad': {
          const advertisingPayload: AdvertisingBannerConfig = {
            items: currentForm.advertising_banner,
          };
          const res = await this.pageConfigDbService.saveConfigByName(
            'advertising_banner',
            advertisingPayload,
          );
          error = res.error;
          if (!error) await this.configStore.ensureAdvertising(true);
          break;
        }
      }

      if (error) {
        this.toastService.error('Error al guardar la configuración en la base de datos');
        return;
      }

      // Volvemos a sincronizar el formulario para asegurar coherencia visual completa
      this.syncFormWithStore();
      this.toastService.success('Sección actualizada correctamente');
    } catch (err) {
      console.error(err);
      this.toastService.error('Ocurrió un error inesperado al procesar el guardado');
    } finally {
      this.saving.set(false);
    }
  }

  // --- MÉTODOS AUXILIARES DE LOGICA INTERNA (Se mantienen idénticos) ---
  addNavbarSection(): void {
    const title = this.newNavbarSectionTitle().trim();
    if (!title) {
      this.toastService.warn('El título es obligatorio');
      return;
    }
    const rolesInput = this.newNavbarSectionRoles().trim();
    const roles = rolesInput
      ? rolesInput
          .split(',')
          .map((r) => r.trim())
          .filter((r) => r)
      : undefined;
    this.config.update((c) => {
      c.navbar.sections.push({ title, items: [], roles });
      return { ...c };
    });
    this.newNavbarSectionTitle.set('');
    this.newNavbarSectionRoles.set('');
  }

  removeNavbarSection(index: number): void {
    this.config.update((c) => {
      c.navbar.sections.splice(index, 1);
      return { ...c };
    });
  }
  getNewNavbarItem(sectionIdx: number): NavItem {
    if (!this.newNavbarItems[sectionIdx]) this.newNavbarItems[sectionIdx] = { label: '', path: '' };
    return this.newNavbarItems[sectionIdx];
  }
  addNavbarLink(sectionIdx: number): void {
    const item = this.getNewNavbarItem(sectionIdx);
    if (!item.label.trim() || !item.path.trim()) {
      this.toastService.warn('Etiqueta y Ruta obligatorias');
      return;
    }
    this.config.update((c) => {
      c.navbar.sections[sectionIdx].items.push({
        label: item.label.trim(),
        path: item.path.trim(),
      });
      return { ...c };
    });
    this.newNavbarItems[sectionIdx] = { label: '', path: '' };
  }
  removeNavbarLink(sectionIdx: number, itemIdx: number): void {
    this.config.update((c) => {
      c.navbar.sections[sectionIdx].items.splice(itemIdx, 1);
      return { ...c };
    });
  }

  addFooterSection(): void {
    const title = this.newFooterSectionTitle().trim();
    if (!title) {
      this.toastService.warn('El título es obligatorio');
      return;
    }
    this.config.update((c) => {
      c.footer.sections.push({ title, items: [] });
      return { ...c };
    });
    this.newFooterSectionTitle.set('');
  }
  removeFooterSection(index: number): void {
    this.config.update((c) => {
      c.footer.sections.splice(index, 1);
      return { ...c };
    });
  }
  getNewFooterItem(sectionIdx: number): FooterItem {
    if (!this.newFooterItems[sectionIdx]) this.newFooterItems[sectionIdx] = { label: '', url: '' };
    return this.newFooterItems[sectionIdx];
  }
  addFooterLink(sectionIdx: number): void {
    const item = this.getNewFooterItem(sectionIdx);
    if (!item.label.trim() || !item.url.trim()) {
      this.toastService.warn('Campos obligatorios');
      return;
    }
    this.config.update((c) => {
      c.footer.sections[sectionIdx].items.push({ label: item.label.trim(), url: item.url.trim() });
      return { ...c };
    });
    this.newFooterItems[sectionIdx] = { label: '', url: '' };
  }
  removeFooterLink(sectionIdx: number, itemIdx: number): void {
    this.config.update((c) => {
      c.footer.sections[sectionIdx].items.splice(itemIdx, 1);
      return { ...c };
    });
  }

  addAdvertisingItem(): void {
    const item = this.newAdvertisingItem();
    if (!item.text.trim()) {
      this.toastService.warn('El texto es requerido');
      return;
    }
    this.config.update((c) => {
      if (!c.advertising_banner) c.advertising_banner = [];
      c.advertising_banner.push({
        text: item.text.trim(),
        link: item.link.trim(),
        icon: item.icon.trim() || 'pi pi-megaphone',
      });
      return { ...c };
    });
    this.newAdvertisingItem.set({ text: '', link: '', icon: 'pi pi-megaphone' });
  }
  removeAdvertisingItem(index: number): void {
    this.config.update((c) => {
      c.advertising_banner.splice(index, 1);
      return { ...c };
    });
  }
  setTab(tab: 'general' | 'navbar' | 'footer' | 'publicidad'): void {
    this.activeTab.set(tab);
  }
}
