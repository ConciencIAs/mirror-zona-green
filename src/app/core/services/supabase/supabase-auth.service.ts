import { Injectable, inject, signal, computed } from '@angular/core';
import type { Session, AuthChangeEvent, User } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client.service';


@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly supabaseClient = inject(SupabaseClientService);

  session = signal<{ event: AuthChangeEvent, session: Session | null }>({ event: "INITIAL_SESSION", session: null });

  get auth() {
    return this.supabaseClient.supabase.auth;
  }

  getSession = computed(() =>
    this.session()
  );

  isAuthenticated = computed(() =>
    !!this.session()?.session?.user
  );

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

  getUser(): Promise<User | null> {
    return this.supabaseClient.supabase.auth.getUser().then((result) => result.data.user);
  }

  onAuthStateChange(): void {
    this.supabaseClient.supabase.auth.onAuthStateChange(
      (event, session) => {
        this.session.set({ event, session });
      }
    );
  }
}
