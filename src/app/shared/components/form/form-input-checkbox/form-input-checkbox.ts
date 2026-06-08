import { Component, input, computed } from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { FormErrorDisplayComponent } from '../form-error-display/form-error-display';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-input-checkbox',
  standalone: true,
  imports: [FormErrorDisplayComponent, CheckboxModule, FormsModule],
  template: `
    <div class="mb-4 flex items-center gap-2">
      <p-checkbox [class.border-red-500]="isInvalid()" [inputId]="uid"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()" 
        [ngModel]="getControl().value()" 
        (ngModelChange)="getControl().value.set($event)"  
        [binary]="true" />
      
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700" [for]="uid">
          {{ label() }}
        </label>
      }

        
      <app-form-error-display
        [errors]="errorMessage()"
        [touched]="isInvalid()"
      />
    </div>
  `,
})
export class FormInputCheckboxComponent {
  control = input.required<FieldState<string | number | boolean, string>>();
  label = input<string>('');
  placeholder = input<string>('');
  uid = crypto.randomUUID(); // Genera un ID único para el checkbox

  getControl() {
    return this.control()
  }

  isInvalid = computed(() => {
    const ctrl = this.getControl();
    return ctrl.invalid();
  });

  errorMessage = computed(() => {
    return this.getControl().errors()
  });
}

