import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TabsComponent } from './tabs.component';
import { TabsConfig } from '../../types/tabs-config';

describe('TabsComponent', () => {
  let component: TabsComponent;
  let fixture: ComponentFixture<TabsComponent>;

  const mockTabsConfig: TabsConfig = {
    tabs: [
      { id: 'overview', label: 'Overview', route: '/dashboard/overview', icon: 'dashboard' },
      { id: 'performance', label: 'Performance', route: '/dashboard/performance', icon: 'trending_up' },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TabsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all tabs', () => {
    fixture.componentRef.setInput('config', mockTabsConfig);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.tab');
    expect(tabs.length).toBe(2);
  });

  it('should display tab labels', () => {
    fixture.componentRef.setInput('config', mockTabsConfig);
    fixture.detectChanges();

    const labels = fixture.nativeElement.querySelectorAll('.tab-label');
    expect(labels[0].textContent).toContain('Overview');
    expect(labels[1].textContent).toContain('Performance');
  });

  it('should display tab icons when provided', () => {
    fixture.componentRef.setInput('config', mockTabsConfig);
    fixture.detectChanges();

    const icons = fixture.nativeElement.querySelectorAll('.tab-icon');
    expect(icons.length).toBe(2);
    expect(icons[0].textContent).toContain('dashboard');
  });

  it('should apply disabled class to disabled tabs', () => {
    const configWithDisabled: TabsConfig = {
      tabs: [
        { id: 'overview', label: 'Overview', route: '/overview' },
        { id: 'performance', label: 'Performance', route: '/performance', disabled: true },
      ],
    };

    fixture.componentRef.setInput('config', configWithDisabled);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.tab');
    expect(tabs[1].classList.contains('disabled')).toBeTruthy();
  });

  it('should have proper ARIA attributes', () => {
    fixture.componentRef.setInput('config', mockTabsConfig);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.tabs-container');
    expect(container.getAttribute('role')).toBe('tablist');

    const tabs = fixture.nativeElement.querySelectorAll('.tab');
    expect(tabs[0].getAttribute('role')).toBe('tab');
  });
});

