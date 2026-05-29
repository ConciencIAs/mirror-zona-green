import { Component, inject, signal, OnInit } from '@angular/core';

import { LocalStorageStateService } from '@src/app/core/services/local-storage-state.service';

import { ConfirmationModalService } from '@src/app/core/services/ui/confirmation.service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterOutlet],
  templateUrl: './home.html',
  styles: ``,
})
export class Home implements OnInit {
  private readonly localStorageState = inject(LocalStorageStateService);
  private readonly confirmationModalService = inject(ConfirmationModalService);

  private readonly USER_SAY_TO_BE_LEGAL_AGE_KEY = 'zg_user_say_to_be_legal_age';

  isLegalAge = signal(false);

  ngOnInit(): void {
    this.isLegalAge.set(this.userSaysToBeLegalAge);
    this.verifyCurrentAge();
  }

  get userSaysToBeLegalAge(): boolean {
    return this.localStorageState.getState(
      this.USER_SAY_TO_BE_LEGAL_AGE_KEY,
      false,
    );
  }

  verifyCurrentAge(): void {
    if (!this.userSaysToBeLegalAge) {
      this.confirmationModalService.confirm({
        header: '!ATENCION¡',
        message: 'Debes ser mayor de edad para acceder a zonagree.co',
        reject: () => this.isLegalAge.set(false),
        acceptLabel: 'Sí, soy mayor de edad',
        rejectLabel: 'No, no soy mayor de edad',
        accept: () => {
          this.isLegalAge.set(true);
          this.localStorageState.setState(this.USER_SAY_TO_BE_LEGAL_AGE_KEY, true);
        },
      });
    }
  }
}
