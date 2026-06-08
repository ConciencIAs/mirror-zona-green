import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { form, validateStandardSchema } from '@angular/forms/signals';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { SupabaseStorageService } from '@src/app/core/services/supabase/supabase-storage.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import {
  Categoria,
  EstadoProducto,
  Producto,
  ProductoVariante,
  Tag,
} from '@src/app/shared/models/interfaces/db/db';
import { productSchema, productVariantSchema } from '@src/app/shared/models/schemas/product.schema';
import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import { FormDatepickerComponent } from '@src/app/shared/components/form/form-datepicker/form-datapicker';
import { FormChipsComponent } from '@src/app/shared/components/form/form-chips/form-chips';
import {
  FormSelectComponent,
  SelectOption,
} from '@src/app/shared/components/form/form-select/form-select';

import { ProductFormModel, ProductVariantFormModel } from '@src/app/shared/models/interfaces/productos/marketplace.interface';

@Component({
  selector: 'app-products-editor',
  standalone: true,
  imports: [CommonModule, FormInputComponent, FormSelectComponent, FormDatepickerComponent, FormChipsComponent],
  templateUrl: './products-editor.html',
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

  readonly categories = signal<Categoria[]>([]);
  readonly tags = signal<Tag[]>([]);

  readonly productModel = signal<ProductFormModel>({
    nombre: '',
    descripcion: '',
    sku: this.generateRandomSku(),
    precio: 0,
    costo: 0,
    stock_total: 0,
    categoria_id: '',
    status: 'activo',
    tipo_producto: 'simple',
    tags: [],
    urls_imagenes: [],
    has_product_variantes: false,
    // id, timestamps, and other supabase-generated fields are omitted
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
  readonly productVariants = signal<ProductVariantFormModel[]>([]);
  readonly editingVariantIndex = signal<number | null>(null);
  readonly deletedVariantIds = signal<string[]>([]);
  readonly newVariant = signal<ProductVariantFormModel>({
    nombre: '',
    descripcion: '',
    precio: 1,
    stock: 1,
    gramos_disponibles: 1,
    cantidad_minima_venta: 1,
    precio_minimo_venta: 1,
    opciones_venta: [5, 10, 20, 40, 0],
    urls_imagenes: [],
    fecha_llegada: new Date(),
    status: 'activo',
  });
  readonly newVariantForm = form(this.newVariant, (schemaPath) => {
    validateStandardSchema(schemaPath, productVariantSchema);
  });
  readonly showVariantErrorsModal = signal(false);
  readonly variantErrorEntries = computed(() => {
    const errors = this.newVariantForm().errorSummary();
    if (!errors) return [];
    return errors;
  });
  readonly pendingVariantImages = signal<{ file: File; preview: string }[]>([]);
  readonly editingProductId = signal<string | null>(null);

  readonly categoryOptions = computed(() =>
    this.categories().map((category) => ({
      label: category.nombre,
      value: category.id,
    })),
  );

  readonly statusOptions: SelectOption[] = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
  ];

  readonly productTypeOptions: SelectOption[] = [
    { value: 'simple', label: 'Producto simple' },
    { value: 'variantes', label: 'Producto con variantes' },
  ];

  ngOnInit() {
    this.loadInitialData();
  }

  private async loadInitialData() {
    this.loading.set(true);
    const [categoriesRes, tagsRes] = await Promise.all([
      this.dbService.select(TableName.CATEGORIAS),
      this.dbService.select(TableName.TAGS),
    ]);

    if (categoriesRes.error) {
      console.error('Error al cargar categorías', categoriesRes.error);
      this.toastService.error('No se pudo cargar las categorías.');
      this.categories.set([]);
    } else {
      this.categories.set((categoriesRes.data as unknown as Categoria[]) ?? []);
    }

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
      categoria_id: product.categoria_id ?? '',
      status: product.status,
      tipo_producto: product.has_product_variantes ? 'variantes' : 'simple',
      tags: product.tags ?? [],
      urls_imagenes: product.urls_imagenes ?? [],
      has_product_variantes: product.has_product_variantes,
    });
    this.selectedTagNames.set(product.tags ?? []);
    this.productImages.set(product.urls_imagenes ?? []);
    this.pendingImages.set([]);
    this.deletedVariantIds.set([]);

    const variants = await this.loadProductVariants(product.id);
    this.productVariants.set(variants);
    if (variants.length > 0) {
      this.productModel.update((current) => ({ ...current, tipo_producto: 'variantes' }));
    }

    this.generalError.set(null);
    this.loading.set(false);
  }

  async saveProduct(event: Event) {
    event.preventDefault();
    this.generalError.set(null);

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
    const payload = {
      nombre: model.nombre.trim(),
      descripcion: model.descripcion.trim(),
      sku: model.sku.trim(),
      precio: Number(model.precio) || 0,
      costo: Number(model.costo) || 0,
      stock_total: Number(model.stock_total) || 0,
      categoria_id: model.categoria_id,
      status: model.status,
      tags: this.selectedTagNames(),
      urls_imagenes: this.productImages(),
      has_product_variantes: model.tipo_producto === 'variantes',
    };

    if (model.tipo_producto === 'variantes' && this.productVariants().length === 0) {
      this.generalError.set('Agrega al menos una variante para productos con variantes.');
      this.toastService.warn('Agrega al menos una variante.');
      return;
    }

    const uploadedUrls = await this.uploadPendingImages();
    const imageUrls = [...this.productImages(), ...uploadedUrls];
    payload.urls_imagenes = imageUrls;

    this.saving.set(true);
    try {
      let productId = this.editingProductId();
      if (productId) {
        const { error } = await this.dbService.update(TableName.PRODUCTOS, payload, { id: productId });
        if (error) throw error;
        this.toastService.success('Producto actualizado correctamente.');
      } else {
        const { data, error } = await this.dbService.insert(TableName.PRODUCTOS, payload).select('*').single();
        if (error) throw error;
        const insertedProduct = data as Producto;
        if (!insertedProduct?.id) throw new Error('No se pudo obtener el ID del producto creado.');
        productId = insertedProduct.id;
        this.toastService.success('Producto creado correctamente.');
      }

      if (productId) {
        await this.saveProductVariants(productId);
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

  private async saveProductVariants(productId: string) {
    if (this.productModel().tipo_producto !== 'variantes') {
      if (this.editingProductId()) {
        await this.deleteVariantsByProductId(productId);
      }
      return;
    }

    const deleteIds = this.deletedVariantIds();
    if (deleteIds.length > 0) {
      await Promise.all(
        deleteIds.map((id) =>
          this.dbService.delete(TableName.PRODUCTOS_VARIANTES, { id }),
        ),
      );
    }

    await Promise.all(
      this.productVariants().map((variant) => {
        const data = {
          producto_id: productId,
          nombre: variant.nombre.trim(),
          descripcion: variant.descripcion?.trim() ?? null,
          precio: Number(variant.precio) || 0,
          stock: Number(variant.stock) || 0,
          gramos_disponibles: Number(variant.gramos_disponibles) || 0,
          cantidad_minima_venta: Number(variant.cantidad_minima_venta) || 1,
          precio_minimo_venta: Number(variant.precio_minimo_venta) || 0,
          opciones_venta: variant.opciones_venta,
          status: variant.status || 'activo' as EstadoProducto,
          fecha_llegada: variant.fecha_llegada || null,
          urls_imagenes: variant.urls_imagenes,
        };

        if (variant.id) {
          return this.dbService.update(TableName.PRODUCTOS_VARIANTES, data, { id: variant.id });
        }

        return this.dbService.insert(TableName.PRODUCTOS_VARIANTES, data);
      }),
    );
  }

  private async deleteVariantsByProductId(productId: string) {
    await this.dbService.delete(TableName.PRODUCTOS_VARIANTES, { producto_id: productId });
  }

  private async loadProductVariants(productId: string) {
    const { error, data } = await this.dbService
      .from(TableName.PRODUCTOS_VARIANTES)
      .select('*')
      .eq('producto_id', productId);

    if (error) {
      console.error('Error al cargar variantes', error);
      this.toastService.error('No se pudo cargar las variantes.');
      return [];
    }

    const variants = data as ProductoVariante[];
    return variants.map((variant) => ({
      id: variant.id,
      nombre: variant.nombre,
      descripcion: variant.descripcion ?? '',
      precio: variant.precio ?? 0,
      stock: variant.stock ?? 0,
      gramos_disponibles: variant.gramos_disponibles ?? 0,
      cantidad_minima_venta: variant.cantidad_minima_venta ?? 1,
      precio_minimo_venta: variant.precio_minimo_venta ?? 0,
      opciones_venta: variant.opciones_venta ?? [5, 10, 20, 40, 0],
      urls_imagenes: variant.urls_imagenes ?? [],
      fecha_llegada: variant.fecha_llegada ?? '',
      status: variant.status,
    }));
  }

  setNewVariantField(field: keyof ProductVariantFormModel, value: string) {
    this.newVariant.update((current) => ({ ...current, [field]: value }));
  }

  toggleTag(tagName: string) {
    const current = this.selectedTagNames();
    if (current.includes(tagName)) {
      this.selectedTagNames.set(current.filter((tag) => tag !== tagName));
      return;
    }
    this.selectedTagNames.set([...current, tagName]);
  }

  startEditVariant(index: number) {
    const variant = this.productVariants()[index];
    this.editingVariantIndex.set(index);
    this.newVariant.set({ ...variant });
    this.pendingVariantImages.set([]);
  }

  async addVariant() {
    const variant = this.newVariant();
    if (this.newVariantForm().invalid()) {
      this.showVariantErrorsModal.set(true);
      this.toastService.warn('Revisa los datos de la variante.');
      return;
    }

    const uploadedUrls = await this.uploadPendingVariantImages();
    const variantWithImages = {
      ...variant,
      urls_imagenes: [...variant.urls_imagenes, ...uploadedUrls],
    };

    if (this.editingVariantIndex() !== null) {
      const updated = this.productVariants().map((item, idx) =>
        idx === this.editingVariantIndex() ? variantWithImages : item,
      );
      this.productVariants.set(updated);
      this.editingVariantIndex.set(null);
    } else {
      this.productVariants.set([...this.productVariants(), variantWithImages]);
    }

    this.resetVariantForm();
  }

  resetVariantForm() {
    this.editingVariantIndex.set(null);
    this.pendingVariantImages.set([]);
    this.newVariant.set({
      nombre: '',
      descripcion: '',
      precio: 0,
      stock: 0,
      gramos_disponibles: 0,
      cantidad_minima_venta: 1,
      precio_minimo_venta: 1,
      opciones_venta: [5, 10, 20, 40, 0],
      urls_imagenes: [],
      fecha_llegada: new Date(),
      status: 'activo',
    });
  }

  removeVariant(index: number) {
    const variant = this.productVariants()[index];
    if (variant?.id) {
      this.deletedVariantIds.set([...this.deletedVariantIds(), variant.id]);
    }
    this.productVariants.set(this.productVariants().filter((_, idx) => idx !== index));
    if (this.editingVariantIndex() === index) {
      this.resetVariantForm();
    }
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

  async onVariantImageFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    await this.addPendingVariantImages(files);
    input.value = '';
  }

  private async addPendingVariantImages(files: FileList) {
    this.uploadLoading.set(true);
    const pending = [...this.pendingVariantImages()];

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

    this.pendingVariantImages.set(pending);
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

  private async uploadPendingVariantImages() {
    const files = this.pendingVariantImages();
    if (files.length === 0) {
      return [];
    }

    this.uploadLoading.set(true);
    const uploadedUrls: string[] = [];

    for (const item of files) {
      const path = `productos/variantes/${Date.now()}-${item.file.name}`;
      const uploadResult = await this.storageService.upload(
        ProductsEditor.IMAGE_BUCKET,
        path,
        item.file,
        { cacheControl: '3600', upsert: false },
      );

      if ((uploadResult as any).error) {
        console.error('Error al subir imagen de variante', (uploadResult as any).error);
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

    this.pendingVariantImages.set([]);
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

  removePendingVariantImage(index: number) {
    const pending = [...this.pendingVariantImages()];
    const item = pending[index];
    if (item) URL.revokeObjectURL(item.preview);
    pending.splice(index, 1);
    this.pendingVariantImages.set(pending);
  }

  removeVariantImage(imageUrl: string) {
    this.newVariant.update((current) => ({
      ...current,
      urls_imagenes: current.urls_imagenes.filter((url) => url !== imageUrl),
    }));
  }

  getCategoryName(categoryId: string | null) {
    return this.categories().find((category) => category.id === categoryId)?.nombre ?? '-';
  }

  closeErrorsModal() {
    this.showErrorsModal.set(false);
  }

  closeVariantErrorsModal() {
    this.showVariantErrorsModal.set(false);
  }

  cancelEdit() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private generateRandomSku(): string {
    return crypto.randomUUID().toUpperCase();
  }
}
