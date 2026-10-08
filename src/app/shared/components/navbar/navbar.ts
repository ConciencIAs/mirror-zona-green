import {
  Component,
  inject,
  signal,
  HostListener,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProfileMenu } from '@src/app/shared/components/profile-menu/profile-menu';

import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';

import { CartStore } from '@src/app/core/state/card/card.state';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { FormsModule } from '@angular/forms';

import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { DarkModeState } from '@src/app/core/state/app/dark-mode.state';
import { AdvertisingBannerComponent } from '@src/app/shared/components/advertising-banner/advertising-banner';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    ProfileMenu,
    OverlayBadgeModule,
    InputGroupModule,
    InputTextModule,
    ButtonModule,
    InputGroupAddonModule,
    FormsModule,
    AdvertisingBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './navbar.html',
})
export class Navbar {
  private readonly cartStore = inject(CartStore);
  private readonly userStore = inject(UserStore);
  private readonly router = inject(Router);
  private readonly appConfigStore = inject(AppConfigStore);
  private readonly authService = inject(SupabaseAuthService);
  private readonly darkModeState = inject(DarkModeState);

  searchQuery = signal<string>('');

  protected authDropOpen = signal(false);
  protected sidebarOpen = signal(false);
  protected readonly isDark = this.darkModeState.isDark;

  totalCartItems = this.cartStore.totalItems;

  // Reactive state for configuration — computed() en vez de una copia
  // única para que se actualice solo cuando el store termina de cargar
  // la config real (antes se congelaba con el valor por defecto).
  protected readonly settingsConfig = computed(() => this.appConfigStore.settingsConfig());
  protected readonly navBarConfig = computed(() => this.appConfigStore.navbarConfig());
  protected readonly advertisingBannerConfig = computed(() => this.appConfigStore.advertisingConfig());

  public searchBarEnabled = false

  visibleNavSections = computed(() => {
    return (
      this.navBarConfig()?.sections.filter(
        (section) => !section.roles || section.roles.includes(this.currentRole),
      ) || []
    );
  });

  toggleDark(): void {
    this.darkModeState.toggle();
  }

  isAuthenticated() {
    return this.userStore.isAuthenticated();
  }

  get isAdmin() {
    return this.userStore.isAdmin();
  }

  get isCustomer() {
    return this.userStore.isCustomer();
  }

  get isAgent() {
    return this.userStore.isAgent();
  }

  get fullName() {
    return this.userStore.fullName();
  }

  get currentRole() {
    return this.userStore.currentRole();
  }

  onSearch() {
    const query = this.searchQuery();

    if (!query.trim()) return;

    this.router.navigate(['/seleccion'], {
      queryParams: { q: query.trim() },
    });
  }

  toggleAuthDrop(): void {
    this.authDropOpen.update((v) => !v);
  }
  closeAuthDrop(): void {
    this.authDropOpen.set(false);
  }
  openSidebar(): void {
    this.sidebarOpen.set(true);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  async signOut(): Promise<void> {
    this.closeSidebar();
    await this.authService.signOut();
    this.userStore.clearPerfil();
    this.cartStore.clearCart();
    this.router.navigate(['/']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.nav-auth-wrap')) {
      this.authDropOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.authDropOpen.set(false);
    this.sidebarOpen.set(false);
  }
}
