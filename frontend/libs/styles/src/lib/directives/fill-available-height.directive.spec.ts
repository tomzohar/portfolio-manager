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

  it('should set max-height style on the element', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const element = compiled.querySelector('.test-element') as HTMLElement;
    
    // Max-height should be set after render
    expect(element.style.maxHeight).toBeTruthy();
  });

  it('should calculate max-height based on element Y position', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const element = compiled.querySelector('.test-element') as HTMLElement;
    
    // Get the calculated max-height
    const heightValue = parseInt(element.style.maxHeight, 10);
    
    // Max-height should be a positive number
    expect(heightValue).toBeGreaterThan(0);
  });

  it('should set max-height in pixels', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const element = compiled.querySelector('.test-element') as HTMLElement;
    
    // Max-height should end with 'px'
    expect(element.style.maxHeight).toMatch(/^\d+px$/);
  });
});
