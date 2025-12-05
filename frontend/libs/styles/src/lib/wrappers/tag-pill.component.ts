import { Component, input } from '@angular/core';

/**
 * TagPillComponent
 *
 * Displays category/topic tags (e.g., "Tech", "Growth", "Semiconductors").
 *
 * @example
 * ```html
 * <lib-tag-pill label="Tech" />
 * <lib-tag-pill label="Growth" />
 * ```
 */
@Component({
  selector: 'lib-tag-pill',
  standalone: true,
  template: ` <span class="tag-pill">{{ label() }}</span> `,
  styleUrl: './tag-pill.component.scss',
})
export class TagPillComponent {
  /**
   * Tag label text
   */
  label = input.required<string>();
}
