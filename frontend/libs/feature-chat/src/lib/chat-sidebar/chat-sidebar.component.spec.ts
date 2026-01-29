import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSidebarComponent } from './chat-sidebar.component';
import { By } from '@angular/platform-browser';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import { signal } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';

describe('ChatSidebarComponent', () => {
    let component: ChatSidebarComponent;
    let fixture: ComponentFixture<ChatSidebarComponent>;
    let mockChatFacade: any;
    let mockRouter: any;

    beforeEach(async () => {
        mockChatFacade = {
            currentThreadId: signal(null),
            conversations: signal([]),
            loadConversations: jest.fn(),
        };

        mockRouter = {
            navigate: jest.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [ChatSidebarComponent],
            providers: [
                { provide: ChatFacade, useValue: mockChatFacade },
                { provide: Router, useValue: mockRouter },
            ],
            schemas: [NO_ERRORS_SCHEMA],
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

    it('should render history section with correct label', () => {
        const historySection = fixture.debugElement.query(By.css('.sidebar-recent-section'));
        expect(historySection).toBeTruthy();
        const labelElement = historySection.query(By.css('.label'));
        expect(labelElement.nativeElement.textContent).toContain('Chats');
    });

    it('should allow toggling isOpen via model', () => {
        component.isOpen.set(false);
        fixture.detectChanges();
        expect(component.isOpen()).toBe(false);
    });
});
