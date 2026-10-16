import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase/supabase-client.service';
import { Carrito } from '@src/app/shared/models/interfaces/db/db';

export type EdgeAuthMode = 'user' | 'anon' | 'service';

export interface AccountActivationEmailPayload {
  correo: string;
  confirmation_url: string;
}

@Injectable({ providedIn: 'root' })
export class EdgeFunctionsService {
  private readonly supabaseClient = inject(SupabaseClientService);

  /**
   * Correo "Tu correo está confirmado, tu ingreso está en revisión". Se pide
   * con la sesión de la persona, después de confirmar su correo; la función
   * decide en el servidor si corresponde (inactiva, fuera de la base de
   * confianza) y lo envía una sola vez. Correo e id van por compatibilidad con
   * la versión anterior de la función.
   */
  async avisarRegistroEnRevision(correo: string, userId: string) {
    return this.supabaseClient.supabase.functions.invoke('send-registration-email', {
      body: { correo, user_id: userId },
    });
  }

  async sendAccountActivation(payload: AccountActivationEmailPayload) {
    return this.supabaseClient.supabase.functions.invoke('send-account-activation', {
      body: payload,
    });
  }

  async createOrder(carrito: Carrito[], datosEntrega: { tipo_entrega: string, comentarios: string }) {
    return await this.supabaseClient.supabase.functions.invoke(
      'create-order',
      {
        body: JSON.stringify({ carrito, datosEntrega }),
      }
    );
  }
}
