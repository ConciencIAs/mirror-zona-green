import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserStore } from '@src/app/core/state/customer/customer.state';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
})
export class Footer {
  private readonly userStore = inject(UserStore);

  protected isAuthenticated = this.userStore.isAuthenticated;
}
