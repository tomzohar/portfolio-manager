import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FillAvailableHeightDirective } from './fill-available-height.directive';

@Component({
  standalone: true,
  imports: [FillAvailableHeightDirective],
  template: '<div fillAvailableHeight class="test-element">Test Content</div>',
})
class TestComponent {}

describe('FillAvailableHeightDirective', () => {
  let fixture: ComponentFixture<TestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should apply the directive to the element', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const element = compiled.querySelector('.test-element');
    
    expect(element).toBeTruthy();
  });

  it('should set height style on the element', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const element = compiled.querySelector('.test-element') as HTMLElement;
    
    // Height should be set after render
    expect(element.style.height).toBeTruthy();
  });

  it('should calculate height based on element Y position', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const element = compiled.querySelector('.test-element') as HTMLElement;
    
    // Get the calculated height
    const heightValue = parseInt(element.style.height, 10);
    
    // Height should be a positive number
    expect(heightValue).toBeGreaterThan(0);
  });

  it('should set height in pixels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const element = compiled.querySelector('.test-element') as HTMLElement;
    
    // Height should end with 'px'
    expect(element.style.height).toMatch(/^\d+px$/);
  });
});
