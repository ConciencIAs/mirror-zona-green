import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@src/environments/environment';
import { Database } from '@src/app/core/models/db/supabase-types';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly client: SupabaseClient<Database>;

  constructor() {
    const url = environment.supabase?.url;
    const key = environment.supabase?.key;

    if (!url || !key) {
      throw new Error(
        'Supabase config inválida. Define environment.supabase.url y environment.supabase.key.'
      );
    }

    this.client = createClient(url, key);
  }

  get supabase(): SupabaseClient {
    return this.client;
  }
}
