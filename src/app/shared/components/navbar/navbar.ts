import { Component, inject, signal, HostListener } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ProfileMenu } from '@src/app/shared/components/profile-menu/profile-menu';

const ROUTES_WITH_OWN_NAV = ['/customer/home', '/auth/'];
const LS_KEY = 'zg-dark';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, ProfileMenu],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly authService = inject(SupabaseAuthService);
  private readonly router = inject(Router);

  protected isAuthenticated = this.authService.isAuthenticated;
  protected authDropOpen  = signal(false);
  protected sidebarOpen   = signal(false);
  protected visible       = signal(this.shouldShow(this.router.url));
  protected isDark        = signal(false);

  constructor() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'true') {
      this.applyDark(true);
      this.isDark.set(true);
    }

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => {
        this.visible.set(this.shouldShow((e as NavigationEnd).urlAfterRedirects));
        this.authDropOpen.set(false);
        this.sidebarOpen.set(false);
      });
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

  toggleAuthDrop(): void  { this.authDropOpen.update(v => !v); }
  closeAuthDrop(): void   { this.authDropOpen.set(false); }
  openSidebar(): void     { this.sidebarOpen.set(true); }
  closeSidebar(): void    { this.sidebarOpen.set(false); }

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
