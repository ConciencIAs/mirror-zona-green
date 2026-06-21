import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './layout.html',
})
export class Layout {}
