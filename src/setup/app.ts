import { Component, signal, inject, OnInit, ChangeDetectionStrategy, Injector } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { createCustomElement } from '@angular/elements';
import { distinctUntilChanged, filter, skip } from 'rxjs';

import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';

import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { LocalStorageStateService } from '@src/app/core/services//local-storage-state.service';
import { ConfirmationModalService } from '@src/app/core/services/ui/confirmation.service';

import { UserStore } from '@src/app/core/state/customer/customer.state';
import { CartStore } from '@src/app/core/state/card/card.state';

import { ProductCard } from '@src/app/shared/components/marketplace/product-card/product-card';
import { DynamicCarouselComponent } from '@src/app/shared/components/marketplace/dynamic-carousel/dynamic-carousel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule, ButtonModule],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class App implements OnInit {
  private readonly supabaseAuthService = inject(SupabaseAuthService);
  private readonly supabaseDbService = inject(SupabaseDbService);
  private readonly localStorageStateService = inject(LocalStorageStateService);
  private readonly userStore = inject(UserStore);
  private readonly cartStore = inject(CartStore);
  private readonly injector = inject(Injector);

  private readonly confirmationModalService = inject(ConfirmationModalService);

  private readonly USER_SAY_TO_BE_LEGAL_AGE_KEY = 'zg_user_say_to_be_legal_age';

  isLegalAge = signal(false);

  constructor() {
    const productCardEl = createCustomElement(ProductCard, { injector: this.injector });
    const dynamicCarouselEl = createCustomElement(DynamicCarouselComponent, { injector: this.injector });

    // Registra la nueva etiqueta HTML 'mi-prime-carousel'
    customElements.define('el-product-card', productCardEl);
    customElements.define('el-dynamic-carousel', dynamicCarouselEl);
  }

  ngOnInit(): void {
    this.supabaseAuthService.onAuthStateChange();
    this.supabaseAuthService.currentUserEvent
      .pipe(
        // El primer valor es el inicial del BehaviorSubject ({INITIAL_SESSION,
        // session: null}), no un evento real de Supabase: si se procesara,
        // borraría el perfil en cada recarga y los guards mandarían al login.
        // Supabase emite su INITIAL_SESSION real de forma asíncrona, después.
        skip(1),
        distinctUntilChanged((event_a, event_b) => event_a.event === event_b.event),
        filter((event) => {
          if (event.event !== 'INITIAL_SESSION') return true;
          // Al recargar: si la sesión ya no existe pero quedó un perfil en
          // localStorage, se limpia para no mostrar una sesión fantasma.
          if (!event.session && this.userStore.isAuthenticated()) {
            this.userStore.clearPerfil();
            this.cartStore.clearCart();
          }
          // Con sesión válida se relee el perfil, para que un cambio hecho por
          // el admin (activación, bloqueo, rol) se refleje sin volver a entrar.
          return !!event.session;
        }),
      )
      .subscribe(async (event) => {
        const { error, data } = await this.supabaseDbService
          .from(this.supabaseDbService.tableNames.PERFILES)
          .select('*')
          .eq('id', event.session?.user.id)
          .single();
        const { error: cartError, data: cartData } = await this.supabaseDbService
          .from(this.supabaseDbService.tableNames.CARRITO)
          .select('*')
          .eq('usuario_id', event.session?.user.id);
        if (!error) this.userStore.setPerfil(data);
        if (!cartError) this.cartStore.setCart(cartData);
        // La tabla roles solo se puede leer con sesión: se recarga al entrar.
        void this.getRoles();
      });
    this.getRoles();
    this.isLegalAge.set(this.userSaysToBeLegalAge);
    this.verifyCurrentAge();
  }

  get userSaysToBeLegalAge(): boolean {
    return this.localStorageStateService.getState(this.USER_SAY_TO_BE_LEGAL_AGE_KEY, false);
  }

  verifyCurrentAge(): void {
    if (!this.userSaysToBeLegalAge) {
      this.confirmationModalService.confirm({
        header: '!ATENCION¡',
        message: 'Debes ser mayor de edad para acceder a cheynverde.com',
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
    const { error, data } = await this.supabaseDbService
      .from(this.supabaseDbService.tableNames.ROLES)
      .select('*');
    // Sin sesión la consulta devuelve [] (RLS); no se pisa una copia válida.
    if (!error && data?.length) {
      this.localStorageStateService.setState('app_roles', data);
    }
  }
}
