import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { OrderListModule } from 'primeng/orderlist';
import { DialogModule } from 'primeng/dialog';
import { NavbarConfig, NavItem } from '@src/app/shared/models/interfaces/page-config.interface';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';

@Component({
  selector: 'app-config-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, TooltipModule, OrderListModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './config-navbar.component.html',
})
export class ConfigNavbarComponent implements OnInit {
  public readonly configStore = inject(AppConfigStore);
  private readonly pageConfigDbService = inject(PageConfigDbService);
  private readonly toastService = inject(ToastService);

  loading = signal(false);
  saving = signal(false);
  config = signal<NavbarConfig>({ background_color: '#ffffff', sections: [] });
  editSectionModalVisible = signal(false);
  editingSectionIndex = signal<number | null>(null);
  editSectionDraft = signal<{ title: string; rolesText: string }>({ title: '', rolesText: '' });
  editLinkModalVisible = signal(false);
  editingLinkContext = signal<{ sectionIdx: number; itemIdx: number | null; item: NavItem | null }>({ sectionIdx: -1, itemIdx: null, item: null });
  editLinkDraft = signal<NavItem>({ label: '', path: '' });

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
      const deepClone = <T>(obj: T): T =>
        typeof structuredClone !== 'undefined'
          ? structuredClone(obj)
          : JSON.parse(JSON.stringify(obj));
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
      const deepClone = <T>(obj: T): T =>
        typeof structuredClone !== 'undefined'
          ? structuredClone(obj)
          : JSON.parse(JSON.stringify(obj));
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
    this.config.update((c) => ({ ...c, sections: [...c.sections, { title, items: [], roles }] }));
    this.newNavbarSectionTitle.set('');
    this.newNavbarSectionRoles.set('');
  }

  removeNavbarSection(index: number): void {
    this.config.update((c) => ({ ...c, sections: c.sections.filter((_, itemIndex) => itemIndex !== index) }));
  }

  getNavbarSectionRolesText(index: number): string {
    return this.config().sections[index]?.roles?.join(', ') ?? '';
  }

  updateNavbarSectionTitle(index: number, value: string): void {
    this.config.update((c) => {
      const sections = [...c.sections];
      if (sections[index]) {
        sections[index] = { ...sections[index], title: value };
      }
      return { ...c, sections };
    });
  }

  updateNavbarSectionRoles(index: number, value: string): void {
    const roles = value
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    this.config.update((c) => {
      const sections = [...c.sections];
      if (sections[index]) {
        sections[index] = { ...sections[index], roles: roles.length > 0 ? roles : undefined };
      }
      return { ...c, sections };
    });
  }

  openSectionEditModal(index: number): void {
    const section = this.config().sections[index];
    if (!section) {
      return;
    }

    this.editingSectionIndex.set(index);
    this.editSectionDraft.set({
      title: section.title,
      rolesText: section.roles?.join(', ') ?? '',
    });
    this.editSectionModalVisible.set(true);
  }

  closeSectionEditModal(): void {
    this.editSectionModalVisible.set(false);
    this.editingSectionIndex.set(null);
    this.editSectionDraft.set({ title: '', rolesText: '' });
  }

  saveEditedSection(): void {
    const index = this.editingSectionIndex();
    if (index === null) {
      return;
    }

    const roles = this.editSectionDraft().rolesText
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);

    this.config.update((c) => {
      const sections = [...c.sections];
      if (sections[index]) {
        sections[index] = {
          ...sections[index],
          title: this.editSectionDraft().title.trim(),
          roles: roles.length > 0 ? roles : undefined,
        };
      }
      return { ...c, sections };
    });

    this.closeSectionEditModal();
  }

  openLinkEditModal(sectionIdx: number, itemIdx: number): void {
    const item = this.config().sections[sectionIdx]?.items[itemIdx];
    if (!item) {
      return;
    }

    this.editingLinkContext.set({ sectionIdx, itemIdx, item: { ...item } });
    this.editLinkDraft.set({ ...item });
    this.editLinkModalVisible.set(true);
  }

  closeLinkEditModal(): void {
    this.editLinkModalVisible.set(false);
    this.editingLinkContext.set({ sectionIdx: -1, itemIdx: null, item: null });
    this.editLinkDraft.set({ label: '', path: '' });
  }

  saveEditedLink(): void {
    const context = this.editingLinkContext();
    if (context.itemIdx === null || !context.item) {
      return;
    }

    this.config.update((c) => {
      const sections = [...c.sections];
      const items = [...sections[context.sectionIdx].items];
      items[context.itemIdx!] = { ...this.editLinkDraft() };
      sections[context.sectionIdx] = { ...sections[context.sectionIdx], items };
      return { ...c, sections };
    });

    this.closeLinkEditModal();
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
      const sections = [...c.sections];
      sections[sectionIdx] = {
        ...sections[sectionIdx],
        items: [
          ...sections[sectionIdx].items,
          {
            label: item.label.trim(),
            path: item.path.trim(),
          },
        ],
      };
      return { ...c, sections };
    });
    this.newNavbarItems[sectionIdx] = { label: '', path: '' };
  }

  removeNavbarLink(sectionIdx: number, itemIdx: number): void {
    this.config.update((c) => {
      const sections = [...c.sections];
      const items = [...sections[sectionIdx].items];
      items.splice(itemIdx, 1);
      sections[sectionIdx] = { ...sections[sectionIdx], items };
      return { ...c, sections };
    });
  }
}
