import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  templateUrl: './app.html',
  styles: [],
})
export class App {
  protected readonly title = signal('zg');
  protected readonly counter = signal(0);

  increment() {
    this.counter.update((v) => v + 1);
  }
}
