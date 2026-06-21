import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';

import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';

import { UserStore } from '@src/app/core/state/customer/customer.state';
import { CartStore } from '@src/app/core/state/card/card.state';

@Component({
  selector: 'app-profile-menu',
  imports: [ButtonModule, MenuModule, AvatarModule],
  templateUrl: './profile-menu.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class ProfileMenu implements OnInit {
  items: MenuItem[] | undefined;
  private supabaseAuthService = inject(SupabaseAuthService);
  private userState = inject(UserStore);
  private cartState = inject(CartStore);

  labelAvater = this.userState.fullName().charAt(0).toUpperCase() || 'U';

  ngOnInit() {
    this.items = [
      {
        label: 'Mi perfil',
        icon: 'pi pi-user',
        routerLink: '/customer/perfil',
      },
      {
        label: 'Mis ordenes',
        icon: 'pi pi-shopping-cart',
        routerLink: '/customer/orders',
      },
      // {
      //   label: 'Mis productos favoritos',
      //   icon: 'pi pi-heart',
      //   routerLink: '/customer/favorites'
      // },
      {
        label: 'Cerrar sesión',
        icon: 'pi pi-sign-out',
        command: async () => {
          await this.supabaseAuthService.signOut();
          this.userState.clearPerfil();
          this.cartState.clearCart();
        },
      },
    ];
  }
}
