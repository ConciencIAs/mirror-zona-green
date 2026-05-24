import { Component, input, computed } from '@angular/core';
import { FormField, FieldTree } from '@angular/forms/signals';
import { FormErrorDisplayComponent } from '../form-error-display/form-error-display';

export interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-form-select',
  standalone: true,
  imports: [FormField, FormErrorDisplayComponent],
  template: `
    <div class="mb-4">
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {{ label() }}
        </label>
      }
      <select
        [formField]="control()"
        class="w-full text-black px-4 py-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 bg-white"
        [class.border-red-500]="isInvalid()"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()"
      >
        @if (placeholder()) {
          <option value="" disabled selected>{{ placeholder() }}</option>
        }
        @for (option of options(); track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>
      <app-form-error-display
        [errors]="errorMessage()"
        [touched]="control()().touched()"
      />
    </div>
  `,
})
export class FormSelectComponent {
  control = input.required<FieldTree<string, string>>();
  label = input<string>('');
  options = input.required<SelectOption[]>();
  placeholder = input<string>('Selecciona una opción');

  isInvalid = computed(() => {
    const ctrl = this.control();
    return ctrl().invalid() && ctrl().touched();
  });

  errorMessage = computed(() => {
    return this.control()().errors();
  });
}
