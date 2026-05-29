import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';

@Component({
  selector: 'app-customer-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class CustomerHome {
  private readonly authService = inject(SupabaseAuthService);

  protected isAuthenticated = this.authService.isAuthenticated;
  protected authDropOpen = signal(false);

  toggleAuthDrop(): void { this.authDropOpen.update(v => !v); }
  closeAuthDrop(): void  { this.authDropOpen.set(false); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.home-auth-wrap')) {
      this.authDropOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.authDropOpen.set(false); }
}
