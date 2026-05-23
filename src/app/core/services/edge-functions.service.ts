import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@src/environments/environment';
import { SupabaseClientService } from './supabase/supabase-client.service';

export type EdgeAuthMode = 'user' | 'anon' | 'service';

@Injectable({ providedIn: 'root' })
export class EdgeFunctionsService {
  private readonly http = inject(HttpClient);
  private readonly supabaseClient = inject(SupabaseClientService);

  private get baseUrl(): string {
    const url = environment.supabase?.url;
    if (!url) throw new Error('environment.supabase.url no está definido');
    return `${url.replace(/\/+$/,'')}/functions/v1`;
  }

  /**
   * Invoca una Edge Function y devuelve el JSON parseado.
   * Por defecto usa POST y `Content-Type: application/json`.
   * auth: 'user' añade el token de sesión actual (si existe) como Bearer.
   */
  async invoke<T = any>(
    name: string,
    options?: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      auth?: EdgeAuthMode;
      responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
    }
  ): Promise<T> {
    const url = `${this.baseUrl}/${name}`;
    const method = (options?.method ?? 'POST').toUpperCase();

    let headers = new HttpHeaders({ 'Content-Type': 'application/json', ...(options?.headers ?? {}) });

    if (options?.auth === 'user') {
      const sessionRes = await this.supabaseClient.supabase.auth.getSession();
      const token = sessionRes?.data?.session?.access_token;
      if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    }

    const respType = options?.responseType ?? 'json';

    const request$ = this.http.request<T>(method, url, {
      body: options?.body ?? null,
      headers,
      responseType: respType as any,
      observe: 'body',
    });

    return firstValueFrom(request$);
  }

  /**
   * Invoca una función y devuelve la respuesta sin procesar (útil para texto o blobs).
   */
  async invokeRaw(
    name: string,
    options?: { method?: string; body?: any; headers?: Record<string, string>; auth?: EdgeAuthMode }
  ): Promise<Response> {
    const url = `${this.baseUrl}/${name}`;
    const method = (options?.method ?? 'POST').toUpperCase();

    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers ?? {}) };

    if (options?.auth === 'user') {
      const sessionRes = await this.supabaseClient.supabase.auth.getSession();
      const token = sessionRes?.data?.session?.access_token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const resp = await fetch(url, {
      method,
      headers,
      body: options?.body != null ? JSON.stringify(options.body) : undefined,
    });

    return resp;
  }
}
