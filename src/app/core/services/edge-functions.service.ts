import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase/supabase-client.service';
import { Carrito } from '@src/app/shared/models/interfaces/db/db';

export type EdgeAuthMode = 'user' | 'anon' | 'service';

export interface RegistrationEmailPayload {
  nombre: string;
  correo: string;
  telefono: string;
  token_referido: string | null;
  confirmation_url: string | null;
}

export interface AccountActivationEmailPayload {
  correo: string;
  confirmation_url: string;
}

@Injectable({ providedIn: 'root' })
export class EdgeFunctionsService {
  private readonly supabaseClient = inject(SupabaseClientService);

  async sendRegistrationEmail(payload: RegistrationEmailPayload) {
    return this.supabaseClient.supabase.functions.invoke('send-registration-email', {
      body: payload,
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
