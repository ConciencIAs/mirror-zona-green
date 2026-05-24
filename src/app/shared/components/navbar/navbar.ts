import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon?: string;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.html',
  styles: [],
})
export class Navbar implements OnInit {
  navItems: NavItem[] = [];

  ngOnInit(): void {
    this.loadNavigationItems();
  }

  loadNavigationItems(): void {
    // Cargar dinámicamente los items de navegación
    this.navItems = [
      { label: 'Inicio', route: '/home', icon: '🏠' },
      { label: 'Servicios', route: '/servicios', icon: '⚙️' },
      { label: 'Sobre Nosotros', route: '/about', icon: 'ℹ️' },
      { label: 'Contacto', route: '/contact', icon: '📧' },
    ];
  }
}
