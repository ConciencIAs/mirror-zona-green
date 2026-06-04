import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { distinctUntilChanged, filter } from 'rxjs';

import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';

import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { LocalStorageStateService } from '@src/app/core/services//local-storage-state.service';
import { ConfirmationModalService } from '@src/app/core/services/ui/confirmation.service';

import { UserStore } from '@src/app/core/state/customer/customer.state';
import { CartStore } from '@src/app/core/state/card/card.state';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule, ButtonModule],
  templateUrl: './app.html',
  styles: [],
})
export class App implements OnInit {

  private readonly supabaseAuthService = inject(SupabaseAuthService);
  private readonly supabaseDbService = inject(SupabaseDbService);
  private readonly localStorageStateService = inject(LocalStorageStateService);
  private readonly userStore = inject(UserStore);
  private readonly cartStore = inject(CartStore);

  private readonly confirmationModalService = inject(ConfirmationModalService);

  private readonly USER_SAY_TO_BE_LEGAL_AGE_KEY = 'zg_user_say_to_be_legal_age';

  isLegalAge = signal(false);

  ngOnInit(): void {
    this.supabaseAuthService.onAuthStateChange();
    this.supabaseAuthService.currentUserEvent.pipe(
      distinctUntilChanged((event_a, event_b) => event_a.event === event_b.event),
      filter(event => event.event !== 'INITIAL_SESSION'),
    ).subscribe(async (event) => {
      const { error, data } = await this.supabaseDbService.from(this.supabaseDbService.tableNames.PERFILES).select('*').eq('id', event.session?.user.id).single();
      const { error: cartError, data: cartData } = await this.supabaseDbService.from(this.supabaseDbService.tableNames.CARRITO).select('*').eq('id', event.session?.user.id).single();
      if (!error) this.userStore.setPerfil(data);
      if (!cartError) this.cartStore.setCart(cartData);
    });
    this.getRoles();
    this.isLegalAge.set(this.userSaysToBeLegalAge);
    this.verifyCurrentAge();
  }

  get userSaysToBeLegalAge(): boolean {
    return this.localStorageStateService.getState(
      this.USER_SAY_TO_BE_LEGAL_AGE_KEY,
      false,
    );
  }

  verifyCurrentAge(): void {
    if (!this.userSaysToBeLegalAge) {
      this.confirmationModalService.confirm({
        header: '!ATENCION¡',
        message: 'Debes ser mayor de edad para acceder a zonagree.co',
        reject: () => this.isLegalAge.set(false),
        acceptLabel: 'Sí, soy mayor de edad',
        rejectLabel: 'No, no soy mayor de edad',
        accept: () => {
          this.isLegalAge.set(true);
          this.localStorageStateService.setState(this.USER_SAY_TO_BE_LEGAL_AGE_KEY, true);
        },
      });
    }
  }

  async getRoles() {
    const { error, data } = await this.supabaseDbService.from(this.supabaseDbService.tableNames.ROLES).select('*');
    if (!error) {
      this.localStorageStateService.setState('app_roles', data);
    }
  }

  getDynamicContent() {
    const appConfig = this.supabaseDbService.from(this.supabaseDbService.tableNames.PAGE_CONFIG).select('*');
    const appHome = this.supabaseDbService.from(this.supabaseDbService.tableNames.PAGE_HOME).select('*');
    const appDocumentos = this.supabaseDbService.from(this.supabaseDbService.tableNames.PAGE_DOCUMENTOS).select('*');
    return { appConfig, appHome, appDocumentos };
  }
}
