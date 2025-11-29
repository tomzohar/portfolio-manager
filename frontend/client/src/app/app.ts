import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthFacade } from '@frontend/data-access-auth';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authFacade = inject(AuthFacade);
  protected title = 'client';

  constructor() {
    // Check auth status on app initialization
    this.authFacade.checkAuth();
  }
}
