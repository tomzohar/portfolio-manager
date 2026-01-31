import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, ButtonConfig } from '@stocks-researcher/styles';
import { A2UISurfaceApiService } from '@stocks-researcher/data-access-chat';

@Component({
  selector: 'app-a2ui-button',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <lib-button
      [config]="buttonConfig()"
      (clicked)="handleClick()"
    />
  `,
  styles: [`
    :host { display: inline-block; }
  `]
})
export class A2UIButtonComponent {
  surfaceId = input.required<string>();
  dataModel = input<any>();
  bindings = input<any>();
  props = input.required<any>();

  private api = inject(A2UISurfaceApiService);

  buttonConfig = () => ({
    label: this.props().label,
    variant: this.props().variant || 'filled',
    color: this.props().color || 'primary',
  } as ButtonConfig);

  handleClick() {
    this.api.sendEvent(this.surfaceId(), {
      type: 'click',
      name: this.props().action,
      context: this.props().context
    }).subscribe();
  }
}
