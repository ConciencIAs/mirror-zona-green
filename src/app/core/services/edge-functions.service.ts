import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase/supabase-client.service';
import { Carrito } from '@src/app/shared/models/interfaces/db/db';

export type EdgeAuthMode = 'user' | 'anon' | 'service';

@Injectable({ providedIn: 'root' })
export class EdgeFunctionsService {
  private readonly supabaseClient = inject(SupabaseClientService);

  async createOrder(carrito: Carrito[]) {
    return await this.supabaseClient.supabase.functions.invoke(
      'create-order',
      {
        body: JSON.stringify(carrito),
      }
    );
  }
}
