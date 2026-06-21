import { Component, inject, signal, HostListener, OnInit, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProfileMenu } from '@src/app/shared/components/profile-menu/profile-menu';

import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';

import { CartStore } from '@src/app/core/state/card/card.state';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { FormsModule } from '@angular/forms';

import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { NavbarConfig, SettingsConfig, AdvertisingBannerConfig} from '@src/app/shared/models/interfaces/page-config.interface';
import { AdvertisingBannerComponent } from '@src/app/shared/components/advertising-banner/advertising-banner';

const LS_KEY = 'zg-dark';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, ProfileMenu, OverlayBadgeModule, InputGroupModule, InputTextModule, ButtonModule, InputGroupAddonModule, FormsModule, AdvertisingBannerComponent],
  templateUrl: './navbar.html',
})
export class Navbar implements OnInit {
  private readonly cartStore = inject(CartStore);
  private readonly userStore = inject(UserStore);
  private readonly router = inject(Router);
  private readonly appConfigStore = inject(AppConfigStore);

  searchQuery = signal<string>('');

  protected authDropOpen = signal(false);
  protected sidebarOpen = signal(false);
  protected isDark = signal(false);

  totalCartItems = this.cartStore.totalItems();

  // Reactive state for configuration
  protected readonly settingsConfig = signal<SettingsConfig | null>(null);
  protected readonly navBarConfig = signal<NavbarConfig | null>(null);
  protected readonly advertisingBannerConfig = signal<AdvertisingBannerConfig>({ items: [] });

  visibleNavSections = computed(() => {
    return this.navBarConfig()?.sections.filter((section) =>
      !section.roles || section.roles.includes(this.currentRole)
    ) || [];
  })

  ngOnInit() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'true') {
      this.applyDark(true);
      this.isDark.set(true);
    }
    this.loadAppConfig();
  }

  async loadAppConfig() {
    try {
      let navbarConfig = this.appConfigStore.navbarConfig();
      let settingsConfig = this.appConfigStore.settingsConfig();
      let advertisingBannerConfig = this.appConfigStore.advertisingConfig();
      this.navBarConfig.set(navbarConfig);
      this.settingsConfig.set(settingsConfig);
      this.advertisingBannerConfig.set(advertisingBannerConfig);

    } catch (err) {
      console.error('Error loading navbar config:', err);
    }
  }

  private applyDark(on: boolean): void {
    document.documentElement.classList.toggle('dark', on);
    document.documentElement.classList.toggle('p-dark', on);
  }

  toggleDark(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyDark(next);
    localStorage.setItem(LS_KEY, String(next));
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

    this.router.navigate(['/marketplace'], {
      queryParams: { q: query.trim() },
    });
  }



  toggleAuthDrop(): void { this.authDropOpen.update(v => !v); }
  closeAuthDrop(): void { this.authDropOpen.set(false); }
  openSidebar(): void { this.sidebarOpen.set(true); }
  closeSidebar(): void { this.sidebarOpen.set(false); }


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
