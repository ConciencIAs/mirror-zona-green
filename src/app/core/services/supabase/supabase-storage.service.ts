import { Injectable, inject} from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class SupabaseStorageService {
  private readonly supabaseClient = inject(SupabaseClientService);

  upload(bucket: string, path: string, file: File | Blob, options?: { cacheControl?: string; upsert?: boolean }) {
    return this.supabaseClient.supabase.storage
      .from(bucket)
      .upload(path, file, options);
  }

  download(bucket: string, path: string) {
    return this.supabaseClient.supabase.storage.from(bucket).download(path);
  }

  getPublicUrl(bucket: string, path: string) {
    return this.supabaseClient.supabase.storage.from(bucket).getPublicUrl(path);
  }

  remove(bucket: string, path: string) {
    return this.supabaseClient.supabase.storage.from(bucket).remove([path]);
  }
}
