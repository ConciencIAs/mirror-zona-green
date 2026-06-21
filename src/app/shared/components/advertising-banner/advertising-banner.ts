import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  HostListener,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AdvertisingItem } from '@src/app/shared/models/interfaces/page-config.interface';

@Component({
  selector: 'app-advertising-banner',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './advertising-banner.html',
  styles: [`
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
  `],
})
export class AdvertisingBannerComponent implements OnInit, OnDestroy {
  @Input() items: AdvertisingItem[] = [];

  currentIndex = signal(0);
  isPaused = signal(false);
  private autoPlayInterval: any;
  private readonly AUTO_PLAY_INTERVAL_MS = 5000; // 5 seconds per item

  ngOnInit(): void {
    if (this.items && this.items.length > 0) {
      this.startAutoPlay();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  get currentItem(): AdvertisingItem | undefined {
    return this.items[this.currentIndex()];
  }

  private startAutoPlay(): void {
    this.autoPlayInterval = setInterval(() => {
      if (!this.isPaused()) {
        this.next();
      }
    }, this.AUTO_PLAY_INTERVAL_MS);
  }

  private stopAutoPlay(): void {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
    }
  }

  next(): void {
    if (this.items.length === 0) return;
    this.currentIndex.set((this.currentIndex() + 1) % this.items.length);
  }

  prev(): void {
    if (this.items.length === 0) return;
    this.currentIndex.set(
      (this.currentIndex() - 1 + this.items.length) % this.items.length
    );
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.isPaused.set(true);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.isPaused.set(false);
  }

  onLinkClick(): void {
    const item = this.currentItem;
    if (item?.link) {
      window.open(item.link, '_blank');
    }
  }
}
