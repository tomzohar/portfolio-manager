import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TabsConfig } from '../../types/tabs-config';

/**
 * TabsComponent
 * 
 * Generic tabs navigation component with router integration.
 * Tabs are displayed horizontally with active state indicated by purple underline.
 * 
 * @example
 * ```html
 * <lib-tabs [config]="tabsConfig()" />
 * ```
 * 
 * ```typescript
 * tabsConfig = signal<TabsConfig>({
 *   tabs: [
 *     { id: 'overview', label: 'Overview', route: '/dashboard/overview' },
 *     { id: 'performance', label: 'Performance', route: '/dashboard/performance' },
 *   ],
 * });
 * ```
 */
@Component({
  selector: 'lib-tabs',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  /**
   * Tabs configuration
   */
  config = input.required<TabsConfig>();

  /**
   * Get tabs array from config
   */
  tabs = computed(() => this.config().tabs);
}

