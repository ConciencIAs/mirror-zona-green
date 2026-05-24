import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule, CommonModule, ButtonModule],
  templateUrl: './app.html',
  styles: [],
})
export class App {
  protected readonly title = signal('zg');
}
