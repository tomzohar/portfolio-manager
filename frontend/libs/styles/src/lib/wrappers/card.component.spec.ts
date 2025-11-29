import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';
import { provideZonelessChangeDetection } from '@angular/core';

describe('CardComponent', () => {
  let component: CardComponent;
  let fixture: ComponentFixture<CardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(CardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title when provided', () => {
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const titleElement = compiled.querySelector('mat-card-title');
    expect(titleElement?.textContent).toContain('Test Title');
  });

  it('should render subtitle when provided', () => {
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.componentRef.setInput('subtitle', 'Test Subtitle');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const subtitleElement = compiled.querySelector('mat-card-subtitle');
    expect(subtitleElement?.textContent).toContain('Test Subtitle');
  });

  it('should not render header when title is not provided', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const headerElement = compiled.querySelector('mat-card-header');
    expect(headerElement).toBeNull();
  });

  it('should have correct CSS class', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const cardElement = compiled.querySelector('.lib-card');
    expect(cardElement).toBeTruthy();
  });
});
