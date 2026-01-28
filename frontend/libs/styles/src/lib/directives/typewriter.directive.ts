import {
    Directive,
    ElementRef,
    inject,
    input,
    output,
    effect,
    OnDestroy,
} from '@angular/core';

/**
 * TypewriterDirective
 *
 * Animates text content character-by-character to create a typewriter effect.
 * Commonly used for AI responses to create a more engaging user experience.
 *
 * Features:
 * - Character-by-character animation
 * - Configurable speed (ms per character)
 * - Completion event emission
 * - Automatic cleanup on destroy
 * - Handles text changes mid-animation
 *
 * @example
 * ```html
 * <div
 *   [typewriter]="messageContent()"
 *   [speed]="20"
 *   (typewriterComplete)="onAnimationComplete()"
 * >
 * </div>
 * ```
 */
@Directive({
    selector: '[typewriter]',
    standalone: true,
})
export class TypewriterDirective implements OnDestroy {
    private readonly elementRef = inject(ElementRef);

    /**
     * The full text content to animate
     */
    typewriter = input.required<string>();

    /**
     * Animation speed in milliseconds per character
     * Default: 20ms (50 characters per second)
     */
    typewriterSpeed = input<number>(20, { alias: 'speed' });

    /**
     * Skip animation and render text instantly
     * Useful for existing messages that shouldn't animate
     */
    skipAnimation = input<boolean>(false);

    /**
     * Emitted when the animation completes
     */
    typewriterComplete = output<void>();

    /**
     * Current animation timeout ID for cleanup
     */
    private animationTimeoutId: number | null = null;

    /**
     * Current character index being animated
     */
    private currentIndex = 0;

    constructor() {
        // Watch for text changes and trigger animation
        effect(() => {
            const text = this.typewriter();
            this.startAnimation(text);
        });
    }

    ngOnDestroy(): void {
        this.cleanup();
    }

    /**
     * Start the typewriter animation
     */
    private startAnimation(text: string): void {
        // Clean up any existing animation
        this.cleanup();

        // Reset state
        this.currentIndex = 0;
        const element = this.elementRef.nativeElement as HTMLElement;

        // If skip animation, render all at once
        if (this.skipAnimation()) {
            element.innerText = text;
            this.typewriterComplete.emit();
            return;
        }

        element.innerText = '';

        // Handle empty text
        if (!text || text.length === 0) {
            this.typewriterComplete.emit();
            return;
        }

        // Start animation
        this.animateNextCharacter(text);
    }

    /**
     * Animate the next character in the sequence
     */
    private animateNextCharacter(text: string): void {
        const element = this.elementRef.nativeElement as HTMLElement;
        const speed = this.typewriterSpeed();

        if (this.currentIndex < text.length) {
            // Add next character
            element.innerText = text.substring(0, this.currentIndex + 1);
            this.currentIndex++;

            // Schedule next character
            this.animationTimeoutId = window.setTimeout(() => {
                this.animateNextCharacter(text);
            }, speed);
        } else {
            // Animation complete
            this.typewriterComplete.emit();
        }
    }

    /**
     * Clean up animation timeout
     */
    private cleanup(): void {
        if (this.animationTimeoutId !== null) {
            window.clearTimeout(this.animationTimeoutId);
            this.animationTimeoutId = null;
        }
    }
}
