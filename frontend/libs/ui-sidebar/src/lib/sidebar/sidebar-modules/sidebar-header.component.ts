import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-sidebar-header',
    standalone: true,
    imports: [CommonModule],
    template: `<ng-content></ng-content>`,
    styles: [`
    :host {
      display: flex;
      align-items: center;
      padding: var(--spacing-header-padding, 16px);
      border-bottom: 1px solid var(--color-border-primary);
      min-height: var(--header-height, 65px);
      background-color: var(--color-bg-elevated);
    }
  `],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarHeaderComponent { }
