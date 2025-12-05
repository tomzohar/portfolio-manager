import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { LoadingPageComponent } from './loading-page.component';

describe('LoadingPageComponent', () => {
  let component: LoadingPageComponent;
  let fixture: ComponentFixture<LoadingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingPageComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Rendering', () => {
    it('should always render loader component', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const loader = compiled.querySelector('lib-loader');
      
      expect(loader).toBeTruthy();
    });

    it('should render title when provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Loading Dashboard...',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('.loading-page-title');
      
      expect(title).toBeTruthy();
      expect(title?.textContent?.trim()).toBe('Loading Dashboard...');
    });

    it('should not render title when not provided', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('.loading-page-title');
      
      expect(title).toBeFalsy();
    });

    it('should render subtitle when provided', () => {
      fixture.componentRef.setInput('config', {
        subtitle: 'Please wait while we fetch your data',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const subtitle = compiled.querySelector('.loading-page-subtitle');
      
      expect(subtitle).toBeTruthy();
      expect(subtitle?.textContent?.trim()).toBe('Please wait while we fetch your data');
    });

    it('should not render subtitle when not provided', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const subtitle = compiled.querySelector('.loading-page-subtitle');
      
      expect(subtitle).toBeFalsy();
    });

    it('should render both title and subtitle when both provided', () => {
      fixture.componentRef.setInput('config', {
        title: 'Loading...',
        subtitle: 'Please wait',
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const title = compiled.querySelector('.loading-page-title');
      const subtitle = compiled.querySelector('.loading-page-subtitle');
      
      expect(title).toBeTruthy();
      expect(subtitle).toBeTruthy();
    });
  });

  describe('Loader configuration', () => {
    it('should use default medium loader when no config provided', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const loader = compiled.querySelector('lib-loader');
      
      expect(loader).toBeTruthy();
    });

    it('should pass custom loader config when provided', () => {
      const loaderConfig = {
        size: 'lg' as const,
        label: 'Loading',
      };
      
      fixture.componentRef.setInput('config', {
        loader: loaderConfig,
      });
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const loader = compiled.querySelector('lib-loader');
      
      expect(loader).toBeTruthy();
    });
  });

  describe('Layout', () => {
    it('should have loading-page container', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.loading-page');
      
      expect(container).toBeTruthy();
    });

    it('should have loading-page-content wrapper', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const content = compiled.querySelector('.loading-page-content');
      
      expect(content).toBeTruthy();
    });

    it('should have proper structure with loader inside content', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const content = compiled.querySelector('.loading-page-content');
      const loader = content?.querySelector('lib-loader');
      
      expect(loader).toBeTruthy();
    });
  });

  describe('Empty config', () => {
    it('should work with empty config object', () => {
      fixture.componentRef.setInput('config', {});
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const loader = compiled.querySelector('lib-loader');
      const title = compiled.querySelector('.loading-page-title');
      const subtitle = compiled.querySelector('.loading-page-subtitle');
      
      expect(loader).toBeTruthy();
      expect(title).toBeFalsy();
      expect(subtitle).toBeFalsy();
    });
  });
});
