import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { distinctUntilChanged } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { LocalStorageStateService } from '@src/app/core/services//local-storage-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule, CommonModule, ButtonModule],
  templateUrl: './app.html',
  styles: [],
})
export class App implements OnInit {

  private readonly supabaseAuthService = inject(SupabaseAuthService);
  private readonly supabaseDbService = inject(SupabaseDbService);
  private readonly LocalStorageStateService = inject(LocalStorageStateService);

  ngOnInit(): void {
    this.supabaseAuthService.onAuthStateChange();
    this.supabaseAuthService.currentUserEvent.pipe(distinctUntilChanged((event_a, event_b) => event_a.event === event_b.event)).subscribe((event) => {
      this.LocalStorageStateService.setState('zg-customer', event.session)
    });
    this.getRoles();
  }

  async getRoles() {
    const { error, data } = await this.supabaseDbService.from(this.supabaseDbService.tableNames.ROLES).select('*');
    if (!error) {
      this.LocalStorageStateService.setState('app_roles', data);
    }
  }

  getDynamicContent() {
    const appConfig = this.supabaseDbService.from(this.supabaseDbService.tableNames.PAGE_CONFIG).select('*');
    const appHome = this.supabaseDbService.from(this.supabaseDbService.tableNames.PAGE_HOME).select('*');
    const appDocumentos = this.supabaseDbService.from(this.supabaseDbService.tableNames.PAGE_DOCUMENTOS).select('*');
    return { appConfig, appHome, appDocumentos };
  }
}
