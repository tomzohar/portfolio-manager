import { Directive, ElementRef, inject, afterNextRender, input } from '@angular/core';

/**
 * FillAvailableHeightDirective
 * 
 * Calculates and applies the available height to an element based on its Y position.
 * The height is calculated as: window.innerHeight - element.getBoundingClientRect().y
 * 
 * This is useful for full-page components that need to fill the remaining viewport
 * space after accounting for headers, navbars, or other fixed elements above them.
 * 
 * @example
 * ```html
 * <div libFillAvailableHeight>
 *   <!-- Content will fill from this point to bottom of viewport -->
 * </div>
 * ```
 */
@Directive({
  selector: '[fillAvailableHeight]',
  standalone: true,
})
export class FillAvailableHeightDirective {
  private readonly elementRef = inject(ElementRef);

  marginBottom = input<number>(8);

  constructor() {
    afterNextRender(() => {
      this.calculateAndApplyHeight();
    });
  }

  /**
   * Calculate available height and apply it to the element
   */
  private calculateAndApplyHeight(): void {
    const element = this.elementRef.nativeElement as HTMLElement;
    const elementY = element.getBoundingClientRect().y;
    const availableHeight = window.innerHeight - elementY;

    element.style.height = `${availableHeight - this.marginBottom()}px`;
  }
}
