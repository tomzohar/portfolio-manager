import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeComponent } from './badge.component';
import { BadgeConfig } from '../types/badge-config';

describe('BadgeComponent', () => {
  let component: BadgeComponent;
  let fixture: ComponentFixture<BadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeComponent);
    component = fixture.componentInstance;
  });

  describe('Rendering', () => {
    it('should create', () => {
      fixture.componentRef.setInput('config', {
        variant: 'buy',
        label: 'BUY',
      });
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should render BUY badge with correct variant class', () => {
      const config: BadgeConfig = { variant: 'buy', label: 'BUY' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge).toBeTruthy();
      expect(badge.classList.contains('badge--buy')).toBe(true);
      expect(badge.textContent?.trim()).toBe('BUY');
    });

    it('should render SELL badge with correct variant class', () => {
      const config: BadgeConfig = { variant: 'sell', label: 'SELL' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.classList.contains('badge--sell')).toBe(true);
      expect(badge.textContent?.trim()).toBe('SELL');
    });

    it('should render HOLD badge with correct variant class', () => {
      const config: BadgeConfig = { variant: 'hold', label: 'HOLD' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.classList.contains('badge--hold')).toBe(true);
      expect(badge.textContent?.trim()).toBe('HOLD');
    });

    it('should render MONITOR badge with correct variant class', () => {
      const config: BadgeConfig = { variant: 'monitor', label: 'MONITOR' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.classList.contains('badge--monitor')).toBe(true);
      expect(badge.textContent?.trim()).toBe('MONITOR');
    });
  });

  describe('Accessibility', () => {
    it('should use label as aria-label by default', () => {
      const config: BadgeConfig = { variant: 'buy', label: 'BUY' };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.getAttribute('aria-label')).toBe('BUY');
    });

    it('should use custom aria-label when provided', () => {
      const config: BadgeConfig = {
        variant: 'buy',
        label: 'BUY',
        ariaLabel: 'Buy recommendation',
      };
      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.getAttribute('aria-label')).toBe('Buy recommendation');
    });
  });

  describe('Signal Updates', () => {
    it('should update when config signal changes', () => {
      const initialConfig: BadgeConfig = { variant: 'buy', label: 'BUY' };
      fixture.componentRef.setInput('config', initialConfig);
      fixture.detectChanges();

      let badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.classList.contains('badge--buy')).toBe(true);

      const updatedConfig: BadgeConfig = { variant: 'sell', label: 'SELL' };
      fixture.componentRef.setInput('config', updatedConfig);
      fixture.detectChanges();

      badge = fixture.nativeElement.querySelector('.badge');
      expect(badge.classList.contains('badge--sell')).toBe(true);
      expect(badge.textContent?.trim()).toBe('SELL');
    });
  });
});
