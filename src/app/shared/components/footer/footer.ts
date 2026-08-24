import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './footer.html',
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
