import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { NavbarConfig, NavItem } from '@src/app/shared/models/interfaces/page-config.interface';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';

@Component({
  selector: 'app-config-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, TooltipModule],
  templateUrl: './config-navbar.component.html'
})
export class ConfigNavbarComponent implements OnInit {
  public readonly configStore = inject(AppConfigStore);
  private readonly pageConfigDbService = inject(PageConfigDbService);
  private readonly toastService = inject(ToastService);

  loading = signal(false);
  saving = signal(false);
  config = signal<NavbarConfig>({ background_color: '#ffffff', sections: [] });

  newNavbarSectionTitle = signal('');
  newNavbarSectionRoles = signal('');
  newNavbarItems: Record<number, NavItem> = {};

  async ngOnInit() {
    await this.loadConfig();
  }

  async loadConfig() {
    this.loading.set(true);
    try {
      await this.configStore.ensureNavbar();
      const deepClone = <T>(obj: T): T => typeof structuredClone !== 'undefined' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
      this.config.set(deepClone(this.configStore.navbarConfig()));
    } catch (err) {
      this.toastService.error('Error al cargar la configuración de la Navbar');
    } finally {
      this.loading.set(false);
    }
  }

  async saveConfig() {
    this.saving.set(true);
    try {
      const res = await this.pageConfigDbService.saveConfigByName('navbar', this.config());
      if (res.error) throw res.error;
      await this.configStore.ensureNavbar(true);
      const deepClone = <T>(obj: T): T => typeof structuredClone !== 'undefined' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
      this.config.set(deepClone(this.configStore.navbarConfig()));
      this.toastService.success('Navbar actualizada correctamente');
    } catch (err) {
      this.toastService.error('Error al guardar la Navbar');
    } finally {
      this.saving.set(false);
    }
  }

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
      c.sections.push({ title, items: [], roles });
      return { ...c };
    });
    this.newNavbarSectionTitle.set('');
    this.newNavbarSectionRoles.set('');
  }

  removeNavbarSection(index: number): void {
    this.config.update((c) => {
      c.sections.splice(index, 1);
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
      c.sections[sectionIdx].items.push({
        label: item.label.trim(),
        path: item.path.trim(),
      });
      return { ...c };
    });
    this.newNavbarItems[sectionIdx] = { label: '', path: '' };
  }

  removeNavbarLink(sectionIdx: number, itemIdx: number): void {
    this.config.update((c) => {
      c.sections[sectionIdx].items.splice(itemIdx, 1);
      return { ...c };
    });
  }
}
