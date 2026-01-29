import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarComponent, SidebarMode, SidebarPosition } from './sidebar.component';
import { By } from '@angular/platform-browser';
import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarHeaderComponent } from './sidebar-modules/sidebar-header.component';
import { SidebarContentComponent } from './sidebar-modules/sidebar-content.component';
import { SidebarFooterComponent } from './sidebar-modules/sidebar-footer.component';

@Component({
    template: `
    <app-sidebar 
      [(isOpen)]="isOpen"
      [position]="position"
      [mode]="mode"
      [hasBackdrop]="hasBackdrop"
      [width]="width"
    >
      <app-sidebar-header>Header Content</app-sidebar-header>
      <app-sidebar-content>Main Content</app-sidebar-content>
      <app-sidebar-footer>Footer Content</app-sidebar-footer>
    </app-sidebar>
  `,
    imports: [
        SidebarComponent,
        SidebarHeaderComponent,
        SidebarContentComponent,
        SidebarFooterComponent,
        CommonModule
    ],
    standalone: true
})
class TestHostComponent {
    @ViewChild(SidebarComponent) sidebar!: SidebarComponent;
    isOpen = true;
    position: SidebarPosition = 'start';
    mode: SidebarMode = 'side';
    hasBackdrop = false;
    width = '280px';
}

describe('SidebarComponent', () => {
    let hostComponent: TestHostComponent;
    let fixture: ComponentFixture<TestHostComponent>;
    let sidebarComponent: SidebarComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, SidebarComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        hostComponent = fixture.componentInstance;
        fixture.detectChanges();
        sidebarComponent = hostComponent.sidebar;
    });

    it('should create', () => {
        expect(sidebarComponent).toBeTruthy();
        expect(hostComponent).toBeTruthy();
    });

    describe('Inputs & Bindings', () => {
        it('should apply open class when isOpen is true', () => {
            hostComponent.isOpen = true;
            fixture.detectChanges();
            const element = fixture.debugElement.query(By.directive(SidebarComponent)).nativeElement;
            expect(element.classList.contains('app-sidebar--open')).toBe(true);
            expect(element.classList.contains('app-sidebar--closed')).toBe(false);
        });

        it('should apply closed class when isOpen is false', () => {
            hostComponent.isOpen = false;
            fixture.detectChanges();
            const element = fixture.debugElement.query(By.directive(SidebarComponent)).nativeElement;
            expect(element.classList.contains('app-sidebar--open')).toBe(false);
            expect(element.classList.contains('app-sidebar--closed')).toBe(true);
        });

        it('should apply position classes', () => {
            hostComponent.position = 'end';
            fixture.detectChanges();
            const element = fixture.debugElement.query(By.directive(SidebarComponent)).nativeElement;
            expect(element.classList.contains('app-sidebar--end')).toBe(true);
            expect(element.classList.contains('app-sidebar--start')).toBe(false);

            hostComponent.position = 'left';
            fixture.detectChanges();
            expect(element.classList.contains('app-sidebar--start')).toBe(true);
        });

        it('should apply mode classes', () => {
            hostComponent.mode = 'over';
            fixture.detectChanges();
            const element = fixture.debugElement.query(By.directive(SidebarComponent)).nativeElement;
            expect(element.classList.contains('app-sidebar--over')).toBe(true);
        });

        it('should set width style', () => {
            hostComponent.width = '300px';
            fixture.detectChanges();
            const element = fixture.debugElement.query(By.directive(SidebarComponent)).nativeElement;
            expect(element.style.getPropertyValue('--sidebar-width')).toBe('300px');
        });
    });

    describe('Backdrop', () => {
        it('should show backdrop when hasBackdrop is true and open', () => {
            hostComponent.hasBackdrop = true;
            hostComponent.isOpen = true;
            fixture.detectChanges();

            const sidebarDebugEl = fixture.debugElement.query(By.directive(SidebarComponent));
            const backdrop = sidebarDebugEl.query(By.css('.sidebar-backdrop'));
            expect(backdrop).toBeTruthy();
        });

        it('should hide backdrop when not open', () => {
            hostComponent.hasBackdrop = true;
            hostComponent.isOpen = false;
            fixture.detectChanges();

            const sidebarDebugEl = fixture.debugElement.query(By.directive(SidebarComponent));
            const backdrop = sidebarDebugEl.query(By.css('.sidebar-backdrop'));
            expect(backdrop).toBeFalsy();
        });

        it('should emit isOpenChange(false) when backdrop is clicked', () => {
            hostComponent.hasBackdrop = true;
            hostComponent.isOpen = true;
            hostComponent.mode = 'over';
            fixture.detectChanges();

            const spy = jest.spyOn(sidebarComponent.isOpenChange, 'emit');

            const sidebarDebugEl = fixture.debugElement.query(By.directive(SidebarComponent));
            const backdrop = sidebarDebugEl.query(By.css('.sidebar-backdrop'));

            expect(backdrop).toBeTruthy();
            backdrop.triggerEventHandler('click', null);
            fixture.detectChanges();

            expect(spy).toHaveBeenCalledWith(false);
            expect(hostComponent.isOpen).toBe(false);
        });

        it('should NOT close on backdrop click if mode is side', () => {
            hostComponent.hasBackdrop = true;
            hostComponent.mode = 'side';
            hostComponent.isOpen = true;
            fixture.detectChanges();

            const spy = jest.spyOn(sidebarComponent.isOpenChange, 'emit');

            const sidebarDebugEl = fixture.debugElement.query(By.directive(SidebarComponent));
            const backdrop = sidebarDebugEl.query(By.css('.sidebar-backdrop'));

            // Backdrop might exist if hasBackdrop is true, but component logic prevents close
            if (backdrop) {
                backdrop.triggerEventHandler('click', null);
                fixture.detectChanges();
                expect(spy).not.toHaveBeenCalled();
                expect(hostComponent.isOpen).toBe(true);
            }
        });
    });

    describe('Toggle Actions', () => {
        it('should toggle isOpen state', () => {
            hostComponent.isOpen = true;
            fixture.detectChanges();

            const spy = jest.spyOn(sidebarComponent.isOpenChange, 'emit');

            sidebarComponent.toggle();
            fixture.detectChanges();

            expect(spy).toHaveBeenCalledWith(false);
            expect(hostComponent.isOpen).toBe(false);

            sidebarComponent.toggle();
            fixture.detectChanges();

            expect(spy).toHaveBeenCalledWith(true);
            expect(hostComponent.isOpen).toBe(true);
        });

        it('should close when calling close()', () => {
            hostComponent.isOpen = true;
            fixture.detectChanges();

            const spy = jest.spyOn(sidebarComponent.isOpenChange, 'emit');

            sidebarComponent.close();
            fixture.detectChanges();

            expect(spy).toHaveBeenCalledWith(false);
            expect(hostComponent.isOpen).toBe(false);
        });
    });

    describe('Content Projection', () => {
        it('should project content', () => {
            hostComponent.isOpen = true;
            fixture.detectChanges();

            const sidebarElement = fixture.debugElement.query(By.directive(SidebarComponent)).nativeElement;
            expect(sidebarElement.textContent).toContain('Header Content');
            expect(sidebarElement.textContent).toContain('Main Content');
            expect(sidebarElement.textContent).toContain('Footer Content');
        });
    });
});
