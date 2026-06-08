import { Component, input, computed, OnInit } from '@angular/core';
import { DatePickerModule } from 'primeng/datepicker';
import { FormErrorDisplayComponent } from '@src/app/shared/components/form/form-error-display/form-error-display';
import { FieldState } from '@angular/forms/signals';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-datepicker',
  standalone: true,
  imports: [FormErrorDisplayComponent, DatePickerModule, FormsModule],
  template: `
    <div class="mb-4">
      @if (label()) {
        <label class="block text-sm font-medium text-gray-700 mb-2" [for]="uid">
          {{ label() }}
        </label>
      }
      <p-datepicker
        (keydown.enter)="$event.preventDefault()"
        [inputId]="uid"
        [ngModel]="getControl().value()"
        (ngModelChange)="getControl().controlValue.set($event)"
        class="w-full text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
        [placeholder]="placeholder()"
        [showIcon]="showIcon()"
        iconDisplay="input"
        [dateFormat]="dateFormat()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        [class.border-red-500]="isInvalid()"
        [class.ring-2]="isInvalid()"
        [class.ring-red-500]="isInvalid()"
        [class.border-gray-300]="!isInvalid()"
      ></p-datepicker>
      <app-form-error-display
        [errors]="errorMessage()"
        [touched]="isInvalid()"
      />
        </div>
  `,
})
export class FormDatepickerComponent implements OnInit {
  control = input.required<FieldState<Date | null>>();
  label = input<string>('');
  placeholder = input<string>('Seleccionar fecha');
  showIcon = input<boolean>(true);
  dateFormat = input<string>('dd/mm/yy');
  minDate = input<Date | undefined>(undefined);
  maxDate = input<Date | undefined>(undefined);

  uid = '';

  ngOnInit(): void {
    this.uid = crypto.randomUUID();
  }

  getControl() {
    return this.control();
  }

  isInvalid = computed(() => {
    const ctrl = this.getControl();
    return ctrl.invalid();
  });

  errorMessage = computed(() => {
    return this.getControl().errors();
  });
}