import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { ProfileMenu } from '@src/app/shared/components/profile-menu/profile-menu';

const ROUTES_WITH_OWN_NAV = ['/customer/home', '/auth/'];
const LS_KEY = 'zg-dark';
import { ButtonModule } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { CartStore } from '@src/app/core/state/card/card.state';
import { UserStore } from '@src/app/core/state/customer/customer.state';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, ProfileMenu],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  private readonly cartStore = inject(CartStore);
  private readonly userStore = inject(UserStore);

  protected authDropOpen = signal(false);
  protected sidebarOpen = signal(false);
  protected isDark = signal(false);

  ngOnInit() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'true') {
      this.applyDark(true);
      this.isDark.set(true);
    }
  }

  private shouldShow(url: string): boolean {
    return !ROUTES_WITH_OWN_NAV.some(r => url.startsWith(r));
  }

  private applyDark(on: boolean): void {
    document.documentElement.classList.toggle('dark', on);
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
