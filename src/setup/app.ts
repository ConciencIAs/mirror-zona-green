import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule, CommonModule, ButtonModule],
  templateUrl: './app.html',
  styles: [],
})
export class App implements OnInit {
  protected readonly title = signal('zg');

  private readonly supabaseAuthService = inject(SupabaseAuthService);

  ngOnInit(): void {
    this.supabaseAuthService.onAuthStateChange();
  }
}
