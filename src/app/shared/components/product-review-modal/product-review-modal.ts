import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService } from '@src/app/core/services/review.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { ProductReview } from '@src/app/shared/models/interfaces/db/db';

@Component({
  selector: 'app-product-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-review-modal.html',
  styles: `
    .stars-row button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    .stars-row button:hover {
      transform: scale(1.2);
    }
  `,
})
export class ProductReviewModalComponent implements OnInit {
  private readonly reviewService = inject(ReviewService);
  private readonly toastService = inject(ToastService);

  // ─── Inputs ──────────────────────────────────────────────────────────────
  /** ID del producto a reseñar */
  productId = input.required<string>();
  /** Nombre del producto para mostrar en el título */
  productName = input<string>('Producto');
  /** Reseña existente del usuario (si ya opinó) */
  existingReview = input<ProductReview | null>(null);

  // ─── Outputs ─────────────────────────────────────────────────────────────
  closed = output<void>();
  saved = output<ProductReview>();
  deleted = output<string>(); // product_id eliminado

  // ─── Estado interno (signals) ─────────────────────────────────────────────
  readonly rating = signal<number>(0);
  readonly comment = signal<string>('');
  readonly hovered = signal<number>(0);
  readonly loading = signal<boolean>(false);

  readonly stars = [1, 2, 3, 4, 5] as const;

  readonly isEditing = computed(() => !!this.existingReview());

  /** Verdadero si el formulario es válido */
  readonly canSubmit = computed(
    () => this.rating() >= 1 && this.rating() <= 5 && this.comment().trim().length >= 3
  );

  ngOnInit(): void {
    const existing = this.existingReview();
    if (existing) {
      this.rating.set(existing.rating);
      this.comment.set(existing.comment);
    }
  }

  setRating(value: number): void {
    this.rating.set(value);
  }

  setHovered(value: number): void {
    this.hovered.set(value);
  }

  clearHover(): void {
    this.hovered.set(0);
  }

  /** Estrella activa: hover tiene prioridad, luego el rating guardado */
  isStarActive(star: number): boolean {
    const display = this.hovered() || this.rating();
    return star <= display;
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.loading.set(true);
    try {
      const { data, error } = await this.reviewService.saveReview(
        this.productId(),
        this.rating(),
        this.comment().trim()
      );
      if (error) throw error;
      this.toastService.success(
        this.isEditing() ? '¡Reseña actualizada!' : '¡Gracias por tu opinión!'
      );
      this.saved.emit(data as ProductReview);
      this.closed.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar la reseña';
      this.toastService.error(msg);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteReview(): Promise<void> {
    if (!this.isEditing()) return;
    this.loading.set(true);
    try {
      const { error } = await this.reviewService.deleteReview(this.productId());
      if (error) throw error;
      this.toastService.success('Reseña eliminada.');
      this.deleted.emit(this.productId());
      this.closed.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la reseña';
      this.toastService.error(msg);
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }
}
