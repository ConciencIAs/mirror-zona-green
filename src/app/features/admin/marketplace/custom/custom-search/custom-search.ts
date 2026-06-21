import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Tags } from '../component/tags/tags';

@Component({
  selector: 'app-custom-search',
  imports: [Tags],
  templateUrl: './custom-search.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class CustomSearch {}
