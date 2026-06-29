import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FooterConfig, FooterItem } from '@src/app/shared/models/interfaces/page-config.interface';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';

@Component({
  selector: 'app-config-footer',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, TooltipModule],
  templateUrl: './config-footer.component.html'
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
    sections: []
  });

  newFooterSectionTitle = signal('');
  newFooterItems: Record<number, FooterItem> = {};

  async ngOnInit() {
    await this.loadConfig();
  }

  async loadConfig() {
    this.loading.set(true);
    try {
      await this.configStore.ensureFooter();
      const deepClone = <T>(obj: T): T => typeof structuredClone !== 'undefined' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
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
      const deepClone = <T>(obj: T): T => typeof structuredClone !== 'undefined' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
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
    this.config.update((c) => {
      c.sections.push({ title, items: [] });
      return { ...c };
    });
    this.newFooterSectionTitle.set('');
  }

  removeFooterSection(index: number): void {
    this.config.update((c) => {
      c.sections.splice(index, 1);
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
      c.sections[sectionIdx].items.push({ label: item.label.trim(), url: item.url.trim() });
      return { ...c };
    });
    this.newFooterItems[sectionIdx] = { label: '', url: '' };
  }

  removeFooterLink(sectionIdx: number, itemIdx: number): void {
    this.config.update((c) => {
      c.sections[sectionIdx].items.splice(itemIdx, 1);
      return { ...c };
    });
  }
}
