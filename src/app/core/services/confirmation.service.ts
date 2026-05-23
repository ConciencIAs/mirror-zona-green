import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

export interface ConfirmationModalOptions {
  message: string;
  header?: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  accept?: () => void;
  reject?: () => void;
  acceptVisible?: boolean;
  rejectVisible?: boolean;
  defaultFocus?: 'accept' | 'reject';
}

@Injectable({ providedIn: 'root' })
export class ConfirmationModalService {
  private readonly confirmationService = inject(ConfirmationService);

  confirm(options: ConfirmationModalOptions) {
    this.confirmationService.confirm({
      message: options.message,
      header: options.header ?? 'Confirmación',
      icon: options.icon ?? 'pi pi-exclamation-triangle',
      acceptLabel: options.acceptLabel ?? 'Aceptar',
      rejectLabel: options.rejectLabel ?? 'Cancelar',
      accept: options.accept,
      reject: options.reject,
      acceptVisible: options.acceptVisible ?? true,
      rejectVisible: options.rejectVisible ?? true,
      defaultFocus: options.defaultFocus ?? 'accept',
    });
  }

  confirmDelete(message: string, accept: () => void, reject?: () => void) {
    this.confirm({
      message,
      header: 'Eliminar',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept,
      reject,
    });
  }

  //   this.confirmationModalService.confirm({
  //   message: '¿Estás seguro?',
  //   accept: () => this.doAction(),
  // });
}
