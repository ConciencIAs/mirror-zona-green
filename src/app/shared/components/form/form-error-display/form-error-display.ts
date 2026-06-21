import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { ValidationError, WithFieldTree } from '@angular/forms/signals';

@Component({
  selector: 'app-form-error-display',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (errors().length > 0 && touched()) {
      <div class="errors">
        @for (error of errors(); track error) {
          <p class="mt-1 text-red-500 text-sm">{{ error.message }}</p>
        }
      </div>
    }
  `,
})
export class FormErrorDisplayComponent {
  errors = input<WithFieldTree<ValidationError>[]>([]);
  touched = input<boolean>(false);
}
