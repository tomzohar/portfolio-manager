import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortfoliosPageComponent } from './portfolios-page.component';
import { provideZoneChangeDetection } from '@angular/core';

describe('PortfoliosPageComponent', () => {
  let component: PortfoliosPageComponent;
  let fixture: ComponentFixture<PortfoliosPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfoliosPageComponent],
      providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfoliosPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the page title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('h1');
    expect(title?.textContent).toBe('Portfolios');
  });
});
