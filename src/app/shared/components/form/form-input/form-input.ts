import { Component, input, computed } from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { FormErrorDisplayComponent } from '../form-error-display/form-error-display';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-input',
  standalone: true,
  imports: [FormsModule, FormErrorDisplayComponent, InputTextModule, InputNumberModule],
  template: `
    <div class="mb-4">
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700 mb-2" [for]="uid">
          {{ label() }}
        </label>
      }
      @if (type() === 'number') {
        <p-inputNumber
        (keydown.enter)="$event.preventDefault()"
        [id]="uid"
        [ngModel]="getControl().value()"
        mode="decimal"
        (ngModelChange)="getControl().controlValue.set($event)"
        [placeholder]="placeholder()"
        class="w-full text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 overflow-hidden"
        [class.border-red-500]="isInvalid()"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()"
      />
      }
      @else {
      <input pInputText
        (keydown.enter)="$event.preventDefault()"
        [id]="uid"
        [ngModel]="getControl().value()"
        (ngModelChange)="getControl().controlValue.set($event)"
        [placeholder]="placeholder()"
        type="text"
        class="w-full text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 overflow-hidden"
        [class.border-red-500]="isInvalid()"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()"
      />
      }
      <app-form-error-display
        [errors]="errorMessage()"
        [touched]="isInvalid()"
      />
    </div>
  `,
})
export class FormInputComponent {
  control = input.required<FieldState<string | number>>();
  label = input<string>('');
  type = input<'text' | 'number'>('text');
  placeholder = input<string>('');

  // para input tipo precio podemos usar la libreria prime ng el componente InputNumber
  uid = crypto.randomUUID();

  getControl() {
    return this.control()
  }


  isInvalid = computed(() => {
    const ctrl = this.getControl();
    return ctrl.invalid()
  });

  errorMessage = computed(() => {
    return this.getControl().errors()
  });
}

