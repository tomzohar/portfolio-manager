import { Component, inject } from '@angular/core';
import { AuthFacade } from '@frontend/data-access-auth';
import { LayoutComponent } from '@frontend/feature-layout';
import { RouterOutlet } from "@angular/router";

@Component({
  imports: [LayoutComponent, RouterOutlet],
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
