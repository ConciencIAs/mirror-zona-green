import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase/supabase-client.service';
import { ProductReview } from '@src/app/shared/models/interfaces/db/db';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {

  private readonly supabase = inject(SupabaseClientService).supabase;

  /** Guarda o actualiza la reseña del usuario autenticado para un producto */
  async saveReview(productId: string, rating: number, comment: string) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    return this.supabase
      .from('product_reviews')
      .upsert(
        { product_id: productId, user_id: user.id, rating, comment },
        { onConflict: 'product_id,user_id' }
      )
      .select()
      .single();
  }

  /** Obtiene la reseña del usuario autenticado para un producto, si existe */
  async getMyReview(productId: string): Promise<ProductReview | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data } = await this.supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .maybeSingle();

    return data as ProductReview | null;
  }

  /** Elimina la reseña del usuario autenticado para un producto */
  async deleteReview(productId: string) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    return this.supabase
      .from('product_reviews')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', user.id);
  }
}
