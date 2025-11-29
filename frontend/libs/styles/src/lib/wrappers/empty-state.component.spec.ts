import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ButtonConfig } from '../types/button-config';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: [provideZonelessChangeDetection(), provideAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display default icon', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const icon = compiled.querySelector('mat-icon');
    expect(icon?.textContent?.trim()).toBe('inbox');
  });

  it('should display custom icon when provided', () => {
    fixture.componentRef.setInput('icon', 'folder_open');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const icon = compiled.querySelector('mat-icon');
    expect(icon?.textContent?.trim()).toBe('folder_open');
  });

  it('should display default title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.empty-state__title');
    expect(title?.textContent?.trim()).toBe('No Data Available');
  });

  it('should display custom title when provided', () => {
    fixture.componentRef.setInput('title', 'No Portfolios');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.empty-state__title');
    expect(title?.textContent?.trim()).toBe('No Portfolios');
  });

  it('should not display message by default', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const message = compiled.querySelector('.empty-state__message');
    expect(message).toBeNull();
  });

  it('should display message when provided', () => {
    const messageText = 'Get started by creating your first item';
    fixture.componentRef.setInput('message', messageText);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const message = compiled.querySelector('.empty-state__message');
    expect(message?.textContent?.trim()).toBe(messageText);
  });

  it('should not display action button by default', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttonComponent = compiled.querySelector('lib-button');
    expect(buttonComponent).toBeNull();
  });

  it('should display button component when buttonConfig is provided', () => {
    const buttonConfig: ButtonConfig = { label: 'Create New' };
    fixture.componentRef.setInput('buttonConfig', buttonConfig);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttonComponent = compiled.querySelector('lib-button');
    expect(buttonComponent).toBeTruthy();
  });

  it('should emit actionClick when button is clicked', () => {
    const buttonConfig: ButtonConfig = { label: 'Create New' };
    fixture.componentRef.setInput('buttonConfig', buttonConfig);
    fixture.detectChanges();

    const emitSpy = jest.fn();
    component.actionClick.subscribe(emitSpy);

    component.onActionClick();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('should render raised button by default', () => {
    const buttonConfig: ButtonConfig = { label: 'Create New' };
    fixture.componentRef.setInput('buttonConfig', buttonConfig);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button[mat-raised-button]');
    expect(button).toBeTruthy();
  });

  it('should render flat button when variant is flat', () => {
    const buttonConfig: ButtonConfig = { label: 'Create New', variant: 'flat' };
    fixture.componentRef.setInput('buttonConfig', buttonConfig);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button[mat-button]');
    expect(button).toBeTruthy();
  });

  it('should render stroked button when variant is stroked', () => {
    const buttonConfig: ButtonConfig = { label: 'Create New', variant: 'stroked' };
    fixture.componentRef.setInput('buttonConfig', buttonConfig);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button[mat-stroked-button]');
    expect(button).toBeTruthy();
  });

  it('should have empty-state class on root element', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const root = compiled.querySelector('.empty-state');
    expect(root).toBeTruthy();
  });

  it('should contain all structural elements', () => {
    const buttonConfig: ButtonConfig = { label: 'Test Action' };
    fixture.componentRef.setInput('message', 'Test message');
    fixture.componentRef.setInput('buttonConfig', buttonConfig);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state__icon')).toBeTruthy();
    expect(compiled.querySelector('.empty-state__title')).toBeTruthy();
    expect(compiled.querySelector('.empty-state__message')).toBeTruthy();
    expect(compiled.querySelector('.empty-state__action')).toBeTruthy();
  });
});
