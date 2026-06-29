import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AdvertisingItem } from '@src/app/shared/models/interfaces/page-config.interface';

@Component({
  selector: 'app-advertising-banner',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './advertising-banner.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      @keyframes slide {
        0% {
          transform: translateX(100%);
        }
        100% {
          transform: translateX(-100%);
        }
      }

      .ad-text {
        animation: slide 30s linear infinite;
      }

      .ad-text.paused {
        animation-play-state: paused;
      }
    `,
  ],
})
export class AdvertisingBannerComponent {
  items = input.required<AdvertisingItem[]>();

}
