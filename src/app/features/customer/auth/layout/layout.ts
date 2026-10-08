import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './layout.html',
  styles: `
    .auth-logo-img {
      height: 7rem;
    }
    @media (min-width: 640px) {
      .auth-logo-img {
        height: 8rem;
      }
    }
  `,
})
export class Layout {
  private readonly appConfigStore = inject(AppConfigStore);

  protected readonly logoUrl = computed(
    () => this.appConfigStore.settingsConfig()?.logo_url || '/images/logo-cheyn-verde.png',
  );
}
