import { Component, inject, signal, HostListener, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileMenu } from '@src/app/shared/components/profile-menu/profile-menu';

import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';

import { CartStore } from '@src/app/core/state/card/card.state';
import { UserStore } from '@src/app/core/state/customer/customer.state';

const LS_KEY = 'zg-dark';

type NavItem = {
  path: string;
  label: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
  roles?: string[];
};

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, ProfileMenu, OverlayBadgeModule, InputGroupModule, InputTextModule, ButtonModule, InputGroupAddonModule],
  templateUrl: './navbar.html',
})
export class Navbar implements OnInit {
  private readonly cartStore = inject(CartStore);
  private readonly userStore = inject(UserStore);

  protected authDropOpen = signal(false);
  protected sidebarOpen = signal(false);
  protected isDark = signal(false);

  totalCartItems = this.cartStore.totalItems();

  protected readonly navSections: NavSection[] = [
    {
      title: 'Navegación',
      items: [
        { path: '/customer/home', label: 'Inicio' },
        { path: '/cannabismedicinalencolombia', label: 'Cannabis medicinal en Colombia' },
        { path: '/medicoscannabiscolombia', label: 'Médicos especialistas en cannabis' },
        { path: '/rrd', label: 'Reducción de Riesgos y Daños' },
        { path: '/faq', label: 'Preguntas frecuentes' },
        { path: '/terminos-y-condiciones', label: 'Términos y condiciones' },
      ]
    },
    {
      title: 'Cuenta',
      roles: ['customer', 'admin', 'agente'],
      items: [
        { path: '/marketplace', label: 'Marketplace' },
      ]
    },
    {
      title: 'Administración',
      roles: ['admin'],
      items: [
        { path: '/admin', label: 'Panel admin' },
        { path: '/admin/marketplace', label: 'Marketplace admin' },
        { path: '/admin/marketplace/products', label: 'Productos' },
        { path: '/admin/marketplace/custom', label: 'Custom search' },
        { path: '/admin/marketplace/orders', label: 'Órdenes admin' },
        { path: '/admin/marketplace/history', label: 'Historial' },
        { path: '/admin/dynamic-content', label: 'Contenido dinámico' },
      ]
    },
    {
      title: 'Agente',
      roles: ['agente'],
      items: [
        { path: '/admin', label: 'Panel agente' },
        { path: '/admin/marketplace', label: 'Marketplace agente' },
        { path: '/admin/marketplace/orders', label: 'Órdenes' },
        { path: '/admin/marketplace/custom', label: 'Custom search' },
      ]
    }
  ];


  get visibleNavSections() {
    return this.navSections.filter((section) =>
      !section.roles || section.roles.includes(this.currentRole)
    );
  }

  ngOnInit() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'true') {
      this.applyDark(true);
      this.isDark.set(true);
    }
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
