import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSidebarComponent } from './chat-sidebar.component';
import { By } from '@angular/platform-browser';

describe('ChatSidebarComponent', () => {
    let component: ChatSidebarComponent;
    let fixture: ComponentFixture<ChatSidebarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChatSidebarComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ChatSidebarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have default isOpen state as true', () => {
        expect(component.isOpen()).toBe(true);
    });

    it('should render history icon when closed', async () => {
        component.isOpen.set(false);
        fixture.detectChanges();
        await fixture.whenStable();

        const icon = fixture.debugElement.query(By.css('.sidebar-rail-icon'));
        expect(icon).toBeTruthy();
        expect(icon.attributes['name']).toBe('history');
    });

    it('should hide history label when closed', () => {
        component.isOpen.set(false);
        fixture.detectChanges();
        const label = fixture.debugElement.query(By.css('.no-chats-placeholder'));
        expect(label).toBeFalsy();
    });

    it('should emit newConversation when button is clicked (expanded)', () => {
        component.isOpen.set(true);
        fixture.detectChanges();
        let emitted = false;
        component.newConversation.subscribe(() => {
            emitted = true;
        });

        const button = fixture.debugElement.query(By.css('.new-chat-btn'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(emitted).toBe(true);
    });

    it('should render history section header when expanded', () => {
        const historyHeader = fixture.debugElement.query(By.css('h3'));
        expect(historyHeader.nativeElement.textContent).toContain('History');
    });

    it('should allow toggling isOpen via model', () => {
        component.isOpen.set(false);
        fixture.detectChanges();
        expect(component.isOpen()).toBe(false);
    });
});
