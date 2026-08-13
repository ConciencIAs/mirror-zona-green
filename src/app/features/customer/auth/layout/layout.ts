import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './layout.html',
})
export class Layout {
  private readonly appConfigStore = inject(AppConfigStore);

  protected readonly logoUrl = computed(
    () => this.appConfigStore.settingsConfig()?.logo_url || '/images/logo-zona-green-blanco.svg',
  );
}
