import { Component, input, computed, OnInit } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { FormErrorDisplayComponent } from '../form-error-display/form-error-display';
import { CheckboxModule } from 'primeng/checkbox';

@Component({
  selector: 'app-form-input-checkbox',
  standalone: true,
  imports: [FormField, FormErrorDisplayComponent, CheckboxModule],
  template: `
    <div class="mb-4 flex items-center gap-2">
      <p-checkbox [class.border-red-500]="isInvalid()" [inputId]="uid"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()" [formField]="getControl()" [binary]="true"/>
      
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700" [for]="uid">
          {{ label() }}
        </label>
      }

        
      <app-form-error-display
        [errors]="errorMessage()"
        [touched]="getControl()().touched()"
      />
    </div>
  `,
})
export class FormInputCheckboxComponent implements OnInit {
  control = input.required<FieldTree<string | number | boolean, string>>();
  label = input<string>('');
  type = input<string>('text');
  placeholder = input<string>('');
  uid = ''; // Genera un ID único para el checkbox

  // para input tipo precio podemos usar la libreria prime ng el componente InputNumber

  ngOnInit(): void {
    this.uid = Math.random().toString(36).substring(2, 15);
  }

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

