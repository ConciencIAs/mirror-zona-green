import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';
import { AppConfigStore } from '@src/app/core/state/app/app-config.state';
import { SettingsConfig, FooterConfig } from '@src/app/shared/models/interfaces/page-config.interface';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
})
export class Footer implements OnInit {
  private readonly userStore = inject(UserStore);
  private readonly appConfigStore = inject(AppConfigStore);

  protected isAuthenticated = this.userStore.isAuthenticated;

  // Reactive state for footer configuration
  protected readonly settingsConfig = signal<FooterConfig | null>(null);
  protected readonly appSettingsConfig = signal<SettingsConfig | null>(null);

  ngOnInit() {
    this.loadAppConfig();
  }

  async loadAppConfig() {
      let footerConfig = this.appConfigStore.footerConfig();
      let appConfig = this.appConfigStore.settingsConfig();
      this.settingsConfig.set(footerConfig);
      this.appSettingsConfig.set(appConfig);
  }
}

