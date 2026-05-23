import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class SupabaseDbService {
  private readonly supabaseClient = inject(SupabaseClientService);

  from<T = unknown>(table: string) {
    return //this.supabaseClient.supabase.from<T>(table);
  }

  select<T = unknown>(table: string, columns = '*') {
    return //this.from<T>(table).select(columns);
  }

  insert<T = unknown>(table: string, values: T | T[]) {
    return //this.from<T>(table).insert(values);
  }

  update<T = unknown>(table: string, values: Partial<T>, match: Record<string, unknown>) {
    return //this.from<T>(table).update(values).match(match);
  }

  delete<T = unknown>(table: string, match: Record<string, unknown>) {
    return //this.from<T>(table).delete().match(match);
  }
}
