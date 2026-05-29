import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from "@src/app/shared/components/footer/footer";
import { Navbar } from "@src/app/shared/components/navbar/navbar";

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Footer, Navbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout { }
