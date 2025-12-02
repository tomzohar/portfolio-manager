import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { IconRegistryService } from './icon-registry.service';

describe('IconRegistryService', () => {
  let service: IconRegistryService;
  let iconRegistry: MatIconRegistry;
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        IconRegistryService,
        MatIconRegistry,
      ],
    });

    service = TestBed.inject(IconRegistryService);
    iconRegistry = TestBed.inject(MatIconRegistry);
    sanitizer = TestBed.inject(DomSanitizer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize default font set', () => {
    const setDefaultFontSpy = jest.spyOn(iconRegistry, 'setDefaultFontSetClass');
    
    service.init();
    
    expect(setDefaultFontSpy).toHaveBeenCalledWith('material-icons');
  });

  it('should register custom SVG icon', () => {
    const addSvgIconSpy = jest.spyOn(iconRegistry, 'addSvgIcon');
    const bypassSecuritySpy = jest.spyOn(sanitizer, 'bypassSecurityTrustResourceUrl');
    
    service.registerSvgIcon('custom-icon', 'assets/icons/custom.svg');
    
    expect(bypassSecuritySpy).toHaveBeenCalledWith('assets/icons/custom.svg');
    expect(addSvgIconSpy).toHaveBeenCalled();
  });

  it('should register namespaced SVG icon', () => {
    const addSvgIconInNamespaceSpy = jest.spyOn(iconRegistry, 'addSvgIconInNamespace');
    const bypassSecuritySpy = jest.spyOn(sanitizer, 'bypassSecurityTrustResourceUrl');
    
    service.registerSvgIconInNamespace('custom', 'icon-name', 'assets/icons/icon.svg');
    
    expect(bypassSecuritySpy).toHaveBeenCalledWith('assets/icons/icon.svg');
    expect(addSvgIconInNamespaceSpy).toHaveBeenCalled();
  });
});

