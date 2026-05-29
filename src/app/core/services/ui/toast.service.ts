import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

export type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messageService = inject(MessageService)

  show(message: string, summary?: string, severity: ToastSeverity = 'info', life = 5000) {
    this.messageService.add({
      severity,
      summary: summary ?? this.getDefaultSummary(severity),
      detail: message,
      life,
    });
  }

  success(message: string, summary = 'Éxito', life = 5000) {
    this.show(message, summary, 'success', life);
  }

  info(message: string, summary = 'Información', life = 5000) {
    this.show(message, summary, 'info', life);
  }

  warn(message: string, summary = 'Aviso', life = 5000) {
    this.show(message, summary, 'warn', life);
  }

  error(message: string, summary = 'Error', life = 8000) {
    this.show(message, summary, 'error', life);
  }

  clear(key?: string) {
    this.messageService.clear(key);
  }

  private getDefaultSummary(severity: ToastSeverity) {
    switch (severity) {
      case 'success':
        return 'Éxito';
      case 'info':
        return 'Información';
      case 'warn':
        return 'Aviso';
      case 'error':
        return 'Error';
      default:
        return 'Notificación';
    }
  }
}
