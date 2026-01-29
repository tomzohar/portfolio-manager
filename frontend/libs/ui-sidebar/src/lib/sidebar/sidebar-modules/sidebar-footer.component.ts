import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-sidebar-footer',
    standalone: true,
    imports: [CommonModule],
    template: `<ng-content></ng-content>`,
    styles: [`
    :host {
      display: block;
      padding: var(--spacing-md, 12px);
      border-top: 1px solid var(--color-border-primary);
      background-color: var(--color-bg-elevated);
    }
  `],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarFooterComponent { }
