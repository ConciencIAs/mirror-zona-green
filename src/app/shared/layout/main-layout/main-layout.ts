import { Component, ChangeDetectionStrategy, ElementRef, signal, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '@src/app/shared/components/footer/footer';
import { Navbar } from '@src/app/shared/components/navbar/navbar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Footer, Navbar],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  // El navbar es fixed y su altura real varía (franja de publicidad,
  // fila extra de perfil en celulares angostos) — un padding-top fijo
  // en CSS se desalinea del contenido cada vez que esa altura cambia.
  // El <header> es position:fixed, así que medimos ese elemento
  // directamente (su contenedor normal colapsaría a 0 de alto).
  protected readonly contentPaddingTop = signal(88);

  constructor() {
    afterNextRender(() => {
      const header = this.hostRef.nativeElement.querySelector('header');
      if (!header) return;
      const update = () => this.contentPaddingTop.set(header.offsetHeight);
      update();
      const observer = new ResizeObserver(update);
      observer.observe(header);
    });
  }
}
