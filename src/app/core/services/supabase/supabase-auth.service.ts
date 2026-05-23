import { Injectable, inject } from '@angular/core';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly supabaseClient = inject(SupabaseClientService);

  signInWithEmail(email: string, password: string) {
    return this.supabaseClient.supabase.auth.signInWithPassword({
      email,
      password,
    });
  }

  signUpWithEmail(email: string, password: string) {
    return this.supabaseClient.supabase.auth.signUp({
      email,
      password,
    });
  }

  signOut() {
    return this.supabaseClient.supabase.auth.signOut();
  }

  getSession() {
    return this.supabaseClient.supabase.auth.getSession();
  }

  getUser(): Promise<User | null> {
    return this.supabaseClient.supabase.auth.getUser().then((result) => result.data.user);
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.supabaseClient.supabase.auth.onAuthStateChange(callback);
  }
}
