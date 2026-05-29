import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { MenubarModule } from 'primeng/menubar';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { MenuItem } from 'primeng/api';
import { ProfileMenu } from '@src/app/shared/components/profile-menu/profile-menu';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ButtonModule } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { CartStore } from '@src/app/core/state/card/card.state';

@Component({
  selector: 'app-navbar',
  imports: [ProfileMenu, RouterModule, CommonModule, AvatarModule, BadgeModule, MenubarModule, InputTextModule, RippleModule, ButtonModule, OverlayBadgeModule],
  templateUrl: './navbar.html',
  styles: [],
})
export class Navbar implements OnInit {
  private readonly supabaseAuthService = inject(SupabaseAuthService);
  private readonly cartStore = inject(CartStore);

  items: MenuItem[] | undefined;

  isAuthenticated = this.supabaseAuthService.isAuthenticated()
  totalCartItems = this.cartStore.totalItems()

  ngOnInit(): void {
    this.loadNavigationItems();
  }

  loadNavigationItems(): void {
    this.items = [
      {
        label: 'Home',
        icon: 'pi pi-home'
      },
      {
        label: 'Projects',
        icon: 'pi pi-search',
        badge: '3',
        items: [
          {
            label: 'Core',
            icon: 'pi pi-bolt',
            shortcut: '⌘+S'
          },
          {
            label: 'Blocks',
            icon: 'pi pi-server',
            shortcut: '⌘+B'
          },
          {
            separator: true
          },
          {
            label: 'UI Kit',
            icon: 'pi pi-pencil',
            shortcut: '⌘+U'
          }
        ]
      }
    ];
  }

  toggleDarkMode(): void {
    document.documentElement.classList.toggle('dark');
  }


}
