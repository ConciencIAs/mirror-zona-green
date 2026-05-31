import { Component, input, computed } from '@angular/core';
import {FieldTree, form, FormField} from '@angular/forms/signals';
import { FormErrorDisplayComponent } from '../form-error-display/form-error-display';

@Component({
  selector: 'app-form-input',
  standalone: true,
  imports: [FormField, FormErrorDisplayComponent],
  template: `
    <div class="mb-4">
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {{ label() }}
        </label>
      }
      <input
        [formField]="getControl()"
        [type]="type()"
        [placeholder]="placeholder()"
        class="w-full text-black px-4 py-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
        [class.border-red-500]="isInvalid()"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()"
      />
      <app-form-error-display
        [errors]="errorMessage()"
        [touched]="getControl()().touched()"
      />
    </div>
  `,
})
export class FormInputComponent {
  control = input.required<FieldTree<string | number, string>>();
  label = input<string>('');
  type = input<string>('text');
  placeholder = input<string>('');

  // para input tipo precio podemos usar la libreria prime ng el componente InputNumber

  getControl() {
    return this.control()
  }

  isInvalid = computed(() => {
    const ctrl = this.getControl();
    return ctrl().invalid() && ctrl().touched();
  });

  errorMessage = computed(() => {
    return this.getControl()().errors()
  });
}

