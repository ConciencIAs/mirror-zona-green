import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ConfigGeneralComponent } from './components/general/config-general.component';
import { ConfigNavbarComponent } from './components/navbar/config-navbar.component';
import { ConfigFooterComponent } from './components/footer/config-footer.component';
import { ConfigPublicidadComponent } from './components/publicidad/config-publicidad.component';

import { TabsModule } from 'primeng/tabs';

@Component({
  selector: 'app-config-app',
  standalone: true,
  imports: [CommonModule, ConfigGeneralComponent, ConfigNavbarComponent, ConfigFooterComponent, ConfigPublicidadComponent, TabsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './config-app.html',
})
export class ConfigApp {
  tab = signal<'general' | 'navbar' | 'footer' | 'publicidad'>('general');
}
