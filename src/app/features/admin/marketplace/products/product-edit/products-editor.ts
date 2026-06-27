
import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { form, validateStandardSchema } from '@angular/forms/signals';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { SupabaseStorageService } from '@src/app/core/services/supabase/supabase-storage.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import {
  Producto,
  PresentacionProducto,
  Tag,
} from '@src/app/shared/models/interfaces/db/db';
import { productSchema } from '@src/app/shared/models/schemas/product.schema';
import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import {
  FormSelectComponent,
  SelectOption,
} from '@src/app/shared/components/form/form-select/form-select';
import { CarouselModule } from 'primeng/carousel';
import { ImageModule } from 'primeng/image';
import { ButtonModule } from 'primeng/button';

import { ProductFormModel } from '@src/app/shared/models/interfaces/productos/marketplace.interface';

@Component({
  selector: 'app-products-editor',
  standalone: true,
  imports: [
    FormInputComponent,
    FormSelectComponent,
    CarouselModule,
    ImageModule,
    ButtonModule,
  ],
  templateUrl: './products-editor.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProductsEditor implements OnInit {
  private readonly dbService = inject(SupabaseDbService);
  private readonly storageService = inject(SupabaseStorageService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  static readonly IMAGE_BUCKET = 'productos';

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploadLoading = signal(false);
  readonly generalError = signal<string | null>(null);

  readonly tags = signal<Tag[]>([]);

  readonly productModel = signal<ProductFormModel>({
    nombre: '',
    descripcion: '',
    sku: this.generateRandomSku(),
    precio: 0,
    costo: 0,
    stock_total: 0,
    status: 'activo',
    es_por_gramos: false,
    presentaciones: [],
    tags: [],
    urls_imagenes: [],
  });

  readonly productForm = form(this.productModel, (schemaPath) => {
    validateStandardSchema(schemaPath, productSchema);
  });
  readonly showErrorsModal = signal(false);
  readonly errorEntries = computed(() => {
    const errors = this.productForm().errorSummary();
    if (!errors) return [];
    return errors;
  });
  readonly selectedTagNames = signal<string[]>([]);
  readonly productImages = signal<string[]>([]);
  readonly pendingImages = signal<{ file: File; preview: string }[]>([]);

  readonly presentations = signal<PresentacionProducto[]>([]);
  readonly newPresentation = signal<PresentacionProducto>({
    gramos: 0,
    precio: 0,
    stock: 0,
  });
  readonly editingPresentationIndex = signal<number | null>(null);

  readonly editingProductId = signal<string | null>(null);

  readonly totalStockFromPresentations = computed(() =>
    this.presentations().reduce((sum, p) => sum + p.stock, 0)
  );

  readonly statusOptions: SelectOption[] = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
  ];

  ngOnInit() {
    this.loadInitialData();
  }

  private async loadInitialData() {
    this.loading.set(true);
    const tagsRes = await this.dbService.select(TableName.TAGS);

    if (tagsRes.error) {
      console.error('Error al cargar tags', tagsRes.error);
      this.toastService.error('No se pudo cargar las etiquetas.');
      this.tags.set([]);
    } else {
      this.tags.set((tagsRes.data as unknown as Tag[]) ?? []);
    }

    const productId = this.route.snapshot.paramMap.get('id');
    if (productId) {
      await this.loadProduct(productId);
    }

    this.loading.set(false);
  }

  private async loadProduct(productId: string) {
    this.loading.set(true);

    const { error, data } = await this.dbService
      .from(TableName.PRODUCTOS)
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !data) {
      console.error('Error al cargar el producto', error);
      this.toastService.error('No se pudo cargar el producto.');
      await this.router.navigate(['../'], { relativeTo: this.route });
      return;
    }

    const product = data as Producto;
    this.editingProductId.set(product.id);
    this.productModel.set({
      nombre: product.nombre,
      descripcion: product.descripcion ?? '',
      sku: product.sku,
      precio: product.precio ?? 0,
      costo: product.costo ?? 0,
      stock_total: product.stock_total ?? 0,
      status: product.status,
      es_por_gramos: product.es_por_gramos ?? false,
      presentaciones: product.presentaciones ?? [],
      tags: product.tags ?? [],
      urls_imagenes: product.urls_imagenes ?? [],
    });
    this.selectedTagNames.set(product.tags ?? []);
    this.productImages.set(product.urls_imagenes ?? []);
    this.pendingImages.set([]);
    this.presentations.set(product.presentaciones ?? []);

    this.generalError.set(null);
    this.loading.set(false);
  }

  setSaleType(esPorGramos: boolean) {
    this.productModel.update((current) => ({
      ...current,
      es_por_gramos: esPorGramos,
    }));
  }

  async saveProduct(event: Event) {
    event.preventDefault();
    this.generalError.set(null);

    // Sync product images signal to model before validation including pending ones
    this.productModel.update((current) => ({
      ...current,
      urls_imagenes: [...this.productImages(), ...this.pendingImages().map(imagen => imagen.preview)],
    }));

    if (this.productForm().invalid()) {
      this.generalError.set('Revisa los campos del formulario.');
      this.showErrorsModal.set(true);
      this.toastService.warn('Revisa los datos del producto.');
      return;
    }

    const model = this.productModel();
    if (!model.sku) {
      model.sku = this.generateRandomSku();
    }

    const isGrams = model.es_por_gramos;
    const currentPresentations = this.presentations();

    const payload = {
      nombre: model.nombre.trim(),
      descripcion: model.descripcion.trim(),
      sku: model.sku.trim(),
      precio: isGrams ? 0 : Number(model.precio) || 0,
      costo: Number(model.costo),
      stock_total: isGrams
        ? currentPresentations.reduce((sum, p) => sum + p.stock, 0)
        : Number(model.stock_total),
      status: model.status,
      tags: this.selectedTagNames(),
      urls_imagenes: this.productImages(),
      es_por_gramos: isGrams,
      presentaciones: isGrams ? currentPresentations : [],
    };

    const uploadedUrls = await this.uploadPendingImages();
    const imageUrls = [...this.productImages(), ...uploadedUrls];
    payload.urls_imagenes = imageUrls;

    // Validate images again after upload
    if (payload.urls_imagenes.length === 0) {
      this.generalError.set('Debes agregar al menos una imagen.');
      this.toastService.warn('Debes agregar al menos una imagen.');
      return;
    }

    this.saving.set(true);
    try {
      let productId = this.editingProductId();
      if (productId) {
        const { error } = await this.dbService.update(TableName.PRODUCTOS, payload, {
          id: productId,
        });
        if (error) throw error;
        this.toastService.success('Producto actualizado correctamente.');
      } else {
        const { data, error } = await this.dbService
          .from(TableName.PRODUCTOS)
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        const insertedProduct = data as Producto;
        if (!insertedProduct?.id) throw new Error('No se pudo obtener el ID del producto creado.');
        productId = insertedProduct.id;
        this.toastService.success('Producto creado correctamente.');
      }

      await this.router.navigate(['../'], { relativeTo: this.route });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar el producto.';
      console.error(message, error);
      this.generalError.set(message);
      this.toastService.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  setNewPresentationField(field: keyof PresentacionProducto, value: string | number) {
    this.newPresentation.update((current) => ({
      ...current,
      [field]: Number(value) || 0,
    }));
  }

  addPresentation() {
    const pres = this.newPresentation();
    if (pres.gramos <= 0) {
      this.toastService.warn('Los gramos deben ser mayores a 0.');
      return;
    }
    if (pres.precio <= 0) {
      this.toastService.warn('El precio debe ser mayor a 0.');
      return;
    }
    if (pres.stock < 0) {
      this.toastService.warn('El stock no puede ser negativo.');
      return;
    }

    const existsIndex = this.presentations().findIndex((p) => p.gramos === pres.gramos);
    if (existsIndex !== -1 && existsIndex !== this.editingPresentationIndex()) {
      this.toastService.warn(`Ya existe una presentación para ${pres.gramos} gramos.`);
      return;
    }

    if (this.editingPresentationIndex() !== null) {
      const updated = this.presentations().map((item, idx) =>
        idx === this.editingPresentationIndex() ? pres : item,
      );
      this.presentations.set(updated);
      this.editingPresentationIndex.set(null);
    } else {
      this.presentations.set([...this.presentations(), pres]);
    }

    this.productModel.update((current) => ({
      ...current,
      presentaciones: this.presentations(),
    }));

    this.resetPresentationForm();
  }

  startEditPresentation(index: number) {
    const pres = this.presentations()[index];
    this.editingPresentationIndex.set(index);
    this.newPresentation.set({ ...pres });
  }

  removePresentation(index: number) {
    const updated = this.presentations().filter((_, idx) => idx !== index);
    this.presentations.set(updated);
    this.productModel.update((current) => ({
      ...current,
      presentaciones: updated,
    }));
    if (this.editingPresentationIndex() === index) {
      this.resetPresentationForm();
    }
  }

  resetPresentationForm() {
    this.editingPresentationIndex.set(null);
    this.newPresentation.set({
      gramos: 0,
      precio: 0,
      stock: 0,
    });
  }

  toggleTag(tagName: string) {
    const current = this.selectedTagNames();
    if (current.includes(tagName)) {
      this.selectedTagNames.set(current.filter((tag) => tag !== tagName));
      return;
    }
    this.selectedTagNames.set([...current, tagName]);
  }

  async onImageFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    await this.addPendingImages(files);
    input.value = '';
  }

  private async addPendingImages(files: FileList) {
    this.uploadLoading.set(true);
    const pending = [...this.pendingImages()];

    for (let index = 0; index < files.length; index++) {
      const file = files.item(index);
      if (!file) continue;

      const isSquare = await this.validateImageSquare(file);
      if (!isSquare) {
        this.toastService.warn(`La imagen ${file.name} debe ser cuadrada.`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      pending.push({ file, preview });
    }

    this.pendingImages.set(pending);
    this.uploadLoading.set(false);
  }

  private validateImageSquare(file: File) {
    return new Promise<boolean>((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const valid = img.naturalWidth === img.naturalHeight;
        URL.revokeObjectURL(objectUrl);
        resolve(valid);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };
      img.src = objectUrl;
    });
  }

  private async uploadPendingImages() {
    const files = this.pendingImages();
    if (files.length === 0) {
      return [];
    }

    this.uploadLoading.set(true);
    const uploadedUrls: string[] = [];

    for (const item of files) {
      const path = `productos/${Date.now()}-${item.file.name}`;
      const uploadResult = await this.storageService.upload(
        ProductsEditor.IMAGE_BUCKET,
        path,
        item.file,
        { cacheControl: '3600', upsert: false },
      );

      if ((uploadResult as any).error) {
        console.error('Error al subir imagen', (uploadResult as any).error);
        this.toastService.error(`No se pudo subir ${item.file.name}`);
        continue;
      }

      const publicUrlResult = await this.storageService.getPublicUrl(
        ProductsEditor.IMAGE_BUCKET,
        path,
      );

      if ((publicUrlResult as any).error || !(publicUrlResult as any).data?.publicUrl) {
        console.error('Error al obtener URL pública', publicUrlResult);
        this.toastService.error(`No se pudo obtener la URL pública de ${item.file.name}`);
        continue;
      }

      uploadedUrls.push((publicUrlResult as any).data.publicUrl);
    }

    this.pendingImages.set([]);
    this.uploadLoading.set(false);
    return uploadedUrls;
  }

  removePendingImage(index: number) {
    const pending = [...this.pendingImages()];
    const item = pending[index];
    if (item) URL.revokeObjectURL(item.preview);
    pending.splice(index, 1);
    this.pendingImages.set(pending);
  }

  removeImage(imageUrl: string) {
    this.productImages.set(this.productImages().filter((url) => url !== imageUrl));
  }

  closeErrorsModal() {
    this.showErrorsModal.set(false);
  }

  cancelEdit() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private generateRandomSku(): string {
    return crypto.randomUUID().toUpperCase();
  }
}
