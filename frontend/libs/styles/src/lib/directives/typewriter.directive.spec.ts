import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TypewriterDirective } from './typewriter.directive';

@Component({
    standalone: true,
    imports: [TypewriterDirective],
    template: `<div [typewriter]="text()" [typewriterSpeed]="speed()" (typewriterComplete)="onComplete()"></div>`,
})
class TestComponent {
    text = signal<string>('');
    speed = signal<number>(10);
    completeCalled = false;

    onComplete(): void {
        this.completeCalled = true;
    }
}

/**
 * Helper function to wait for a specified duration
 */
function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('TypewriterDirective', () => {
    let fixture: ComponentFixture<TestComponent>;
    let component: TestComponent;
    let element: HTMLElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestComponent],
            providers: [provideZonelessChangeDetection()],
        }).compileComponents();

        fixture = TestBed.createComponent(TestComponent);
        component = fixture.componentInstance;
        element = fixture.nativeElement.querySelector('div') as HTMLElement;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should apply the directive to the element', () => {
        expect(element).toBeTruthy();
    });

    it('should start with empty content', () => {
        expect(element.textContent).toBe('');
    });

    it('should animate text character by character', async () => {
        const testText = 'Hello';
        component.text.set(testText);
        fixture.detectChanges();

        // Wait for complete animation (5 chars * 10ms + buffer)
        await wait(70);
        expect(element.textContent).toBe('Hello');
    });

    it('should emit complete event when animation finishes', async () => {
        const testText = 'Hi';
        component.text.set(testText);
        fixture.detectChanges();

        // Wait for animation to complete
        await wait(25);

        expect(component.completeCalled).toBe(true);
    });

    it('should handle empty text', async () => {
        component.text.set('');
        fixture.detectChanges();

        await wait(10);

        expect(element.textContent).toBe('');
        expect(component.completeCalled).toBe(true);
    });

    it('should respect custom speed', async () => {
        const testText = 'Test';
        component.speed.set(30); // 30ms per character
        component.text.set(testText);
        fixture.detectChanges();

        // Wait for complete animation (4 chars * 30ms = 120ms)
        await wait(130);
        expect(element.textContent).toBe('Test');
        expect(component.completeCalled).toBe(true);
    });

    it('should handle text with special characters', async () => {
        const testText = 'Hi!';
        component.text.set(testText);
        fixture.detectChanges();

        // Wait for full animation
        await wait(50);

        expect(element.textContent).toBe(testText);
    });

    it('should restart animation when text changes', async () => {
        // First text
        component.text.set('Hello');
        fixture.detectChanges();

        // Wait for partial animation
        await wait(25);
        expect(element.textContent?.length).toBeGreaterThan(0);
        expect(element.textContent?.length).toBeLessThan(5);

        // Change text mid-animation
        component.text.set('Hi');
        fixture.detectChanges();

        // Should restart - wait for new animation
        await wait(30);
        expect(element.textContent).toBe('Hi');
    });

    it('should clean up on destroy', async () => {
        component.text.set('Hello World');
        fixture.detectChanges();

        // Start animation
        await wait(15);
        expect(element.textContent?.length).toBeGreaterThan(0);

        // Destroy component - should not throw errors
        expect(() => fixture.destroy()).not.toThrow();
    });
});
