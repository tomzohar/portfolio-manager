import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'lib-sidebar-section',
  standalone: true,
  imports: [],
  template: `
    @if (label()) {
      <div class="sidebar-section-header">
        <span class="label">{{ label() }}</span>
      </div>
    }
    <div class="sidebar-section-content">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin-bottom: var(--spacing-lg, 20px);
    }
    
    .sidebar-section-header {
      padding: 0 var(--spacing-xs, 4px) var(--spacing-sm, 8px);
      margin-bottom: var(--spacing-xs, 4px);
    }
    
    .label {
      font-size: var(--font-size-xs, 12px);
      font-weight: var(--font-weight-medium, 500);
      color: var(--color-text-subtle);
      text-transform: uppercase;
      letter-spacing: var(--letter-spacing-wide, 0.6px);
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarSectionComponent {
  label = input<string>();
}
