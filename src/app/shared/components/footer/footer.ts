import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './footer.html',
  styles: `
    .footer-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.25rem;
    }
    .footer-logo-col {
      grid-column: span 1;
    }
    @media (min-width: 640px) {
      .footer-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .footer-logo-col {
        grid-column: span 2;
      }
    }
    @media (min-width: 1024px) {
      .footer-grid {
        grid-template-columns: 130px repeat(4, 1fr) 1.3fr;
        gap: 2.5rem;
      }
      .footer-logo-col {
        grid-column: span 1;
      }
    }
  `,
})
export class Footer {
  private readonly userStore = inject(UserStore);
  private readonly appConfigStore = inject(AppConfigStore);

  protected isAuthenticated = this.userStore.isAuthenticated;

  // Reactive state for footer configuration — computed() para que se
  // actualice solo cuando el store termina de cargar la config real.
  protected readonly settingsConfig = computed(() => this.appConfigStore.footerConfig());
  protected readonly appSettingsConfig = computed(() => this.appConfigStore.settingsConfig());
}
