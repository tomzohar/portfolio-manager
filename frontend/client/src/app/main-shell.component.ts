import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LayoutComponent } from '@frontend/feature-layout';

@Component({
    selector: 'app-main-shell',
    standalone: true,
    imports: [LayoutComponent, RouterOutlet],
    template: `
    <lib-layout>
      <router-outlet></router-outlet>
    </lib-layout>
  `,
})
export class MainShellComponent { }
