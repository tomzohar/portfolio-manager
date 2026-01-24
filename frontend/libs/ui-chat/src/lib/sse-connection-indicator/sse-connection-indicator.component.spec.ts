import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SSEConnectionIndicatorComponent } from './sse-connection-indicator.component';
import { SSEConnectionStatus } from '@stocks-researcher/types';
import { ComponentRef } from '@angular/core';

describe('SSEConnectionIndicatorComponent', () => {
  let component: SSEConnectionIndicatorComponent;
  let fixture: ComponentFixture<SSEConnectionIndicatorComponent>;
  let componentRef: ComponentRef<SSEConnectionIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SSEConnectionIndicatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SSEConnectionIndicatorComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    
    // Set required input
    componentRef.setInput('status', SSEConnectionStatus.CONNECTED);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display connected status', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Connected');
  });

  it('should show reconnect button on error', () => {
    componentRef.setInput('status', SSEConnectionStatus.ERROR);
    fixture.detectChanges();
    
    const button = fixture.nativeElement.querySelector('lib-button');
    expect(button).toBeTruthy();
  });

  it('should show thinking indicator when graph active', () => {
    componentRef.setInput('isGraphActive', true);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Thinking...');
  });
});
