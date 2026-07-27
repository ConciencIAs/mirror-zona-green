import { Component, OnInit, signal, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { OrderListModule } from 'primeng/orderlist';
import { DialogModule } from 'primeng/dialog';

import {
  AdvertisingItem,
  AdvertisingBannerConfig,
} from '@src/app/shared/models/interfaces/page-config.interface';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { PageConfigDbService } from '@src/app/core/services/supabase/dynamic-content/page-config-db.service';
import { AdvertisingBannerComponent } from '@src/app/shared/components/advertising-banner/advertising-banner';

@Component({
  selector: 'app-config-publicidad',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, OrderListModule, DialogModule, AdvertisingBannerComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './config-publicidad.component.html',
})
export class ConfigPublicidadComponent implements OnInit, OnDestroy {
  public readonly configStore = inject(AppConfigStore);
  private readonly pageConfigDbService = inject(PageConfigDbService);
  private readonly toastService = inject(ToastService);

  loading = signal(false);
  saving = signal(false);
  config = signal<AdvertisingItem[]>([]);
  editModalVisible = signal(false);
  editingItemIndex = signal<number | null>(null);
  editDraft = signal<AdvertisingItem>({ text: '', link: '', icon: 'pi pi-megaphone' });

  newAdvertisingItem = signal<AdvertisingItem>({ text: '', link: '', icon: 'pi pi-megaphone' });

  async ngOnInit() {
    await this.loadConfig();
  }

  async loadConfig() {
    this.loading.set(true);
    try {
      await this.configStore.ensureAdvertising();
      const deepClone = <T>(obj: T): T =>
        typeof structuredClone !== 'undefined'
          ? structuredClone(obj)
          : JSON.parse(JSON.stringify(obj));
      this.config.set(deepClone(this.configStore.advertisingConfig().items));
    } catch (err) {
      this.toastService.error('Error al cargar la configuración de Publicidad');
    } finally {
      this.loading.set(false);
    }
  }

  async saveConfig() {
    this.saving.set(true);
    try {
      const payload: AdvertisingBannerConfig = { items: this.config() };
      const res = await this.pageConfigDbService.saveConfigByName('advertising_banner', payload);
      if (res.error) throw res.error;
      await this.configStore.ensureAdvertising(true);
      const deepClone = <T>(obj: T): T =>
        typeof structuredClone !== 'undefined'
          ? structuredClone(obj)
          : JSON.parse(JSON.stringify(obj));
      this.config.set(deepClone(this.configStore.advertisingConfig().items));
      this.toastService.success('Anuncios actualizados correctamente');
    } catch (err) {
      this.toastService.error('Error al guardar Anuncios');
    } finally {
      this.saving.set(false);
    }
  }

  addAdvertisingItem(): void {
    const item = this.newAdvertisingItem();
    if (!item.text.trim()) {
      this.toastService.warn('El texto es requerido');
      return;
    }
    this.config.update((c) => [
      ...c,
      {
        text: item.text.trim(),
        link: item.link.trim(),
        icon: item.icon.trim() || 'pi pi-megaphone',
      },
    ]);
    this.newAdvertisingItem.set({ text: '', link: '', icon: 'pi pi-megaphone' });
  }

  ngOnDestroy(): void {
    this.editModalVisible.set(false);
    this.editingItemIndex.set(null);
    this.editDraft.set({ text: '', link: '', icon: 'pi pi-megaphone' });
  }

  openEditModal(index: number): void {
    const item = this.config()[index];
    if (!item) {
      return;
    }

    this.editingItemIndex.set(index);
    this.editDraft.set({ ...item });
    this.editModalVisible.set(true);
  }

  closeEditModal(): void {
    this.editModalVisible.set(false);
    this.editingItemIndex.set(null);
    this.editDraft.set({ text: '', link: '', icon: 'pi pi-megaphone' });
  }

  updateEditDraft(field: 'text' | 'link' | 'icon', value: string): void {
    this.editDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  saveEditedItem(): void {
    const index = this.editingItemIndex();
    if (index === null) {
      return;
    }

    const items = [...this.config()];
    items[index] = { ...this.editDraft() };
    this.config.set(items);
    this.closeEditModal();
  }

  onAdvertisingReorder(event: { value: AdvertisingItem[] }): void {
    const reordered = [...event.value];
    this.config.set(reordered);
  }

  removeAdvertisingItem(index: number): void {
    this.config.update((c) => c.filter((_, itemIndex) => itemIndex !== index));
  }
}
