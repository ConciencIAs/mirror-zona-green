import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '@src/app/shared/components/footer/footer';
import { Navbar } from '@src/app/shared/components/navbar/navbar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Footer, Navbar],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './main-layout.html',
})
export class MainLayout {}
