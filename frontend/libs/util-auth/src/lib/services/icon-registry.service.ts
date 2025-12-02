import { Injectable, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Icon registry for the application
 * 
 * Provides centralized icon management and configuration.
 * Sets default icon fonts and can register custom SVG icons.
 */
@Injectable({
  providedIn: 'root',
})
export class IconRegistryService {
  private iconRegistry = inject(MatIconRegistry);
  private sanitizer = inject(DomSanitizer);

  /**
   * Initialize icon configuration
   * Call this during app bootstrap
   */
  init(): void {
    // Set default font class to Material Icons
    this.iconRegistry.setDefaultFontSetClass('material-icons');
    
    // Register custom SVG icons here if needed
    // Example:
    // this.iconRegistry.addSvgIcon(
    //   'custom-icon',
    //   this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/custom.svg')
    // );
  }

  /**
   * Register a custom SVG icon
   * @param name Icon name
   * @param url URL to SVG file
   */
  registerSvgIcon(name: string, url: string): void {
    this.iconRegistry.addSvgIcon(
      name,
      this.sanitizer.bypassSecurityTrustResourceUrl(url)
    );
  }

  /**
   * Register multiple SVG icons from a path
   * @param namespace Icon namespace
   * @param url URL to SVG file
   */
  registerSvgIconInNamespace(namespace: string, name: string, url: string): void {
    this.iconRegistry.addSvgIconInNamespace(
      namespace,
      name,
      this.sanitizer.bypassSecurityTrustResourceUrl(url)
    );
  }
}

