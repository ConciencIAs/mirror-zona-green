import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { themeConfig } from './theme.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideZonelessChangeDetection(),
    providePrimeNG({
      theme: {
        preset: themeConfig,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
