import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-a2ui-text',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [ngClass]="['a2ui-text', props().variant || 'body']">
      {{ props().text }}
    </div>
  `,
  styles: [`
    .body { font-size: 14px; opacity: 0.9; }
    .h1 { font-size: 24px; font-weight: bold; margin: 8px 0; }
    .h2 { font-size: 18px; font-weight: bold; margin: 6px 0; }
    .caption { font-size: 12px; opacity: 0.6; }
  `]
})
export class A2UITextComponent {
  surfaceId = input<string>();
  dataModel = input<any>();
  bindings = input<any>();
  props = input.required<any>();
}
