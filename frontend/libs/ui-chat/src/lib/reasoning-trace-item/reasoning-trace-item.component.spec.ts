import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReasoningTraceItemComponent } from './reasoning-trace-item.component';
import { ReasoningTrace, ReasoningTraceStatus } from '@stocks-researcher/types';
import { ComponentRef } from '@angular/core';

describe('ReasoningTraceItemComponent', () => {
  let component: ReasoningTraceItemComponent;
  let fixture: ComponentFixture<ReasoningTraceItemComponent>;
  let componentRef: ComponentRef<ReasoningTraceItemComponent>;

  const mockTrace: ReasoningTrace = {
    id: 'trace-1',
    threadId: 'thread-123',
    userId: 'user-1',
    nodeName: 'supervisor',
    input: { message: 'test' },
    output: { result: 'success' },
    reasoning: 'This is the reasoning',
    status: ReasoningTraceStatus.COMPLETED,
    durationMs: 1500,
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReasoningTraceItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReasoningTraceItemComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    
    // Set required input
    componentRef.setInput('trace', mockTrace);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display trace node name', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('supervisor');
  });

  it('should display reasoning text', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('This is the reasoning');
  });

  it('should show duration when available', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('1.5s');
  });
});
