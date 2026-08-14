import { Component, ChangeDetectionStrategy, output } from '@angular/core';

@Component({
  selector: 'app-regen-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="regen.emit()"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20a038] hover:bg-[#167f2b] text-white text-[11px] font-bold transition-colors shrink-0 cursor-pointer">
      ↻ Regenerar
    </button>
  `,
})
export class RegenButton {
  regen = output<void>();
}
