import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { FormsModule } from '@angular/forms';
import { FormErrorDisplayComponent } from '../form-error-display/form-error-display';
import { SelectModule } from 'primeng/select';

export interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-form-select',
  standalone: true,
  imports: [FormErrorDisplayComponent, SelectModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4">
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {{ label() }}
        </label>
      }
      <p-select
        class="w-full text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
        [options]="options()"
        optionLabel="label"
        optionValue="value"
        [ngModel]="control().value()"
        (ngModelChange)="control().value.set($event)"
        [class.border-red-500]="isInvalid()"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()"
        [placeholder]="placeholder()"
      />
      <app-form-error-display [errors]="errorMessage()" [touched]="isInvalid()" />
    </div>
  `,
})
export class FormSelectComponent {
  control = input.required<FieldState<string, string>>();
  label = input<string>('');
  options = input.required<SelectOption[]>();
  placeholder = input<string>('Selecciona una opción');

  isInvalid = computed(() => {
    const ctrl = this.control();
    return ctrl.invalid();
  });

  errorMessage = computed(() => {
    return this.control().errors();
  });
}
