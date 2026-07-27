import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { OrderListModule } from 'primeng/orderlist';
import { DialogModule } from 'primeng/dialog';
import { FooterConfig, FooterItem } from '@src/app/shared/models/interfaces/page-config.interface';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';

@Component({
  selector: 'app-config-footer',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, TooltipModule, OrderListModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './config-footer.component.html',
})
export class ConfigFooterComponent implements OnInit {
  public readonly configStore = inject(AppConfigStore);
  private readonly pageConfigDbService = inject(PageConfigDbService);
  private readonly toastService = inject(ToastService);

  loading = signal(false);
  saving = signal(false);
  config = signal<FooterConfig>({
    background_color: '#ffffff',
    texto_copyright: '',
    contact: { email: '', direccion: '', whatsapp_phone: '', whatsapp_link: '' },
    social: { facebook: '', instagram: '', linkedin: '', youtube: '' },
    sections: [],
  });
  editSectionModalVisible = signal(false);
  editingSectionIndex = signal<number | null>(null);
  editSectionDraft = signal<{ title: string }>({ title: '' });
  editLinkModalVisible = signal(false);
  editingLinkContext = signal<{ sectionIdx: number; itemIdx: number | null; item: FooterItem | null }>({ sectionIdx: -1, itemIdx: null, item: null });
  editLinkDraft = signal<FooterItem>({ label: '', url: '' });

  newFooterSectionTitle = signal('');
  newFooterItems: Record<number, FooterItem> = {};

  async ngOnInit() {
    await this.loadConfig();
  }

  async loadConfig() {
    this.loading.set(true);
    try {
      await this.configStore.ensureFooter();
      const deepClone = <T>(obj: T): T =>
        typeof structuredClone !== 'undefined'
          ? structuredClone(obj)
          : JSON.parse(JSON.stringify(obj));
      this.config.set(deepClone(this.configStore.footerConfig()));
    } catch (err) {
      this.toastService.error('Error al cargar la configuración del Footer');
    } finally {
      this.loading.set(false);
    }
  }

  async saveConfig() {
    this.saving.set(true);
    try {
      const res = await this.pageConfigDbService.saveConfigByName('footer', this.config());
      if (res.error) throw res.error;
      await this.configStore.ensureFooter(true);
      const deepClone = <T>(obj: T): T =>
        typeof structuredClone !== 'undefined'
          ? structuredClone(obj)
          : JSON.parse(JSON.stringify(obj));
      this.config.set(deepClone(this.configStore.footerConfig()));
      this.toastService.success('Footer actualizado correctamente');
    } catch (err) {
      this.toastService.error('Error al guardar el Footer');
    } finally {
      this.saving.set(false);
    }
  }

  addFooterSection(): void {
    const title = this.newFooterSectionTitle().trim();
    if (!title) {
      this.toastService.warn('El título es obligatorio');
      return;
    }
    this.config.update((c) => ({ ...c, sections: [...c.sections, { title, items: [] }] }));
    this.newFooterSectionTitle.set('');
  }

  removeFooterSection(index: number): void {
    this.config.update((c) => ({ ...c, sections: c.sections.filter((_, itemIndex) => itemIndex !== index) }));
  }

  updateFooterSectionTitle(index: number, value: string): void {
    this.config.update((c) => {
      const sections = [...c.sections];
      if (sections[index]) {
        sections[index] = { ...sections[index], title: value };
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
    this.editSectionDraft.set({ title: section.title });
    this.editSectionModalVisible.set(true);
  }

  closeSectionEditModal(): void {
    this.editSectionModalVisible.set(false);
    this.editingSectionIndex.set(null);
    this.editSectionDraft.set({ title: '' });
  }

  saveEditedSection(): void {
    const index = this.editingSectionIndex();
    if (index === null) {
      return;
    }

    this.config.update((c) => {
      const sections = [...c.sections];
      if (sections[index]) {
        sections[index] = { ...sections[index], title: this.editSectionDraft().title.trim() };
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
    this.editLinkDraft.set({ label: '', url: '' });
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

  updateFooterLink(sectionIdx: number, itemIdx: number, field: 'label' | 'url', value: string): void {
    this.config.update((c) => {
      const sections = [...c.sections];
      const items = [...sections[sectionIdx].items];
      items[itemIdx] = { ...items[itemIdx], [field]: value };
      sections[sectionIdx] = { ...sections[sectionIdx], items };
      return { ...c, sections };
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
      const sections = [...c.sections];
      sections[sectionIdx] = { ...sections[sectionIdx], items: [...sections[sectionIdx].items, { label: item.label.trim(), url: item.url.trim() }] };
      return { ...c, sections };
    });
    this.newFooterItems[sectionIdx] = { label: '', url: '' };
  }

  removeFooterLink(sectionIdx: number, itemIdx: number): void {
    this.config.update((c) => {
      const sections = [...c.sections];
      const items = [...sections[sectionIdx].items];
      items.splice(itemIdx, 1);
      sections[sectionIdx] = { ...sections[sectionIdx], items };
      return { ...c, sections };
    });
  }
}
