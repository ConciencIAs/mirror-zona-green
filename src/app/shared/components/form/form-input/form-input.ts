import { Component, input, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { FormErrorDisplayComponent } from '../form-error-display/form-error-display';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-input',
  standalone: true,
  imports: [FormsModule, FormErrorDisplayComponent, InputTextModule, InputNumberModule],
  changeDetection: ChangeDetectionStrategy.Eager,
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
          (ngModelChange)="getControl().controlValue.set($event)"
          [placeholder]="placeholder()"
          [useGrouping]="false"
          class="w-full text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 overflow-hidden"
          [class.border-red-500]="isInvalid()"
          [class.ring-2]="isInvalid()"
          [class.ring-red-500]="isInvalid()"
          [class.border-gray-300]="!isInvalid()"
        />
      } @else {
        <div class="relative">
          <input
            pInputText
            (keydown.enter)="$event.preventDefault()"
            [id]="uid"
            [ngModel]="getControl().value()"
            (ngModelChange)="getControl().controlValue.set($event)"
            [placeholder]="placeholder()"
            [type]="inputType()"
            [attr.autocomplete]="autocomplete() || null"
            class="w-full text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 overflow-hidden"
            [class.pr-12]="type() === 'password'"
            [class.border-red-500]="isInvalid()"
            [class.ring-2]="isInvalid()"
            [class.ring-red-500]="isInvalid()"
            [class.border-gray-300]="!isInvalid()"
          />
          @if (type() === 'password') {
            <button
              type="button"
              (click)="mostrarPassword.set(!mostrarPassword())"
              [attr.aria-label]="mostrarPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              [attr.aria-pressed]="mostrarPassword()"
              [attr.aria-controls]="uid"
              class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <i class="pi" [class.pi-eye]="!mostrarPassword()" [class.pi-eye-slash]="mostrarPassword()"></i>
            </button>
          }
        </div>
      }
      <app-form-error-display [errors]="errorMessage()" [touched]="isInvalid()" />
    </div>
  `,
})
export class FormInputComponent {
  control = input.required<FieldState<string | number>>();
  label = input<string>('');
  type = input<'text' | 'number' | 'password'>('text');
  placeholder = input<string>('');
  autocomplete = input<string>('');

  // para input tipo precio podemos usar la libreria prime ng el componente InputNumber
  uid = crypto.randomUUID();

  /** Solo aplica a type="password": alterna entre ver y ocultar lo escrito. */
  readonly mostrarPassword = signal(false);
  readonly inputType = computed(() =>
    this.type() === 'password' && this.mostrarPassword() ? 'text' : this.type(),
  );

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
