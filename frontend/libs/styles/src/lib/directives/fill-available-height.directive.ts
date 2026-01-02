import { Directive, ElementRef, inject, afterNextRender, input } from '@angular/core';

/**
 * FillAvailableHeightDirective
 * 
 * Calculates and applies the available max-height to an element based on its Y position.
 * The max-height is calculated as: window.innerHeight - element.getBoundingClientRect().y
 * 
 * This is useful for scrollable components that should not exceed the viewport height
 * but should only take as much space as needed when content is smaller.
 * 
 * @example
 * ```html
 * <div libFillAvailableHeight>
 *   <!-- Content will fill up to viewport bottom, scrolling if needed -->
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
   * Calculate available height and apply it as max-height to the element
   */
  private calculateAndApplyHeight(): void {
    const element = this.elementRef.nativeElement as HTMLElement;
    const elementY = element.getBoundingClientRect().y;
    const availableHeight = window.innerHeight - elementY;

    element.style.maxHeight = `${availableHeight - this.marginBottom()}px`;
  }
}
