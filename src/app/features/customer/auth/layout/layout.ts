import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './layout.html',
})
export class Layout {
  protected isDark = signal(false);
  protected sidebarOpen = signal(false);
  protected submenuOpen = signal(false);

  toggleDark(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    document.documentElement.classList.toggle('dark', next);
  }

  openSidebar(): void {
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleSubmenu(): void {
    this.submenuOpen.update(v => !v);
  }
}
