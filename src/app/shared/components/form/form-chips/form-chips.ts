import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldState } from '@angular/forms/signals';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { FormErrorDisplayComponent } from '@src/app/shared/components/form/form-error-display/form-error-display';

@Component({
  selector: 'app-form-chips',
  standalone: true,
  imports: [AutoCompleteModule, FormsModule, FormErrorDisplayComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4">
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700 mb-2" [for]="uid">
          {{ label() }}
        </label>
      }
      <p-autocomplete
        class="w-full text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
        [ngModel]="control().value()"
        (ngModelChange)="control().controlValue.set($event)"
        (keydown.enter)="$event.preventDefault()"
        [inputId]="uid"
        multiple
        fluid
        [typeahead]="false"
        [placeholder]="placeholder()"
        [class.border-red-500]="isInvalid()"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()"
      />

      <app-form-error-display [errors]="errorMessage()" [touched]="isInvalid()" />
    </div>
  `,
})
export class FormChipsComponent {
  control = input.required<FieldState<string[] | number[]>>();
  label = input<string>('');
  placeholder = input<string>('');
  uid = crypto.randomUUID();

  isInvalid = computed(() => {
    return this.control().invalid();
  });

  errorMessage = computed(() => {
    return this.control().errors();
  });
}
