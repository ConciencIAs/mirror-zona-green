import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private readonly authService = inject(SupabaseAuthService);
  protected isAuthenticated = this.authService.isAuthenticated;
}
