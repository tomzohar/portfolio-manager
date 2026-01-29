import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListComponent } from './list.component';
import { ListItem } from '../types/list-item';
import { By } from '@angular/platform-browser';

describe('ListComponent', () => {
    let component: ListComponent;
    let fixture: ComponentFixture<ListComponent>;

    const mockItems: ListItem[] = [
        {
            id: 1,
            label: 'Item 1',
            subLabel: 'Sublabel 1',
            icon: 'star',
        },
        {
            id: 2,
            label: 'Item 2',
            actions: [
                { id: 'edit', label: 'Edit', icon: 'edit' }
            ]
        },
        {
            id: 3,
            label: 'Disabled Item',
            disabled: true
        }
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ListComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ListComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('config', { items: mockItems });
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render items correctly', () => {
        const listItems = fixture.debugElement.queryAll(By.css('mat-list-item'));
        expect(listItems.length).toBe(mockItems.length);

        expect(listItems[0].nativeElement.textContent).toContain('Item 1');
        expect(listItems[0].nativeElement.textContent).toContain('Sublabel 1');

        const icon = listItems[0].query(By.css('lib-icon'));
        expect(icon).toBeTruthy();
        expect(icon.nativeElement.textContent).toContain('star');
    });

    it('should apply size classes', () => {
        fixture.componentRef.setInput('config', { items: mockItems, size: 'lg' });
        fixture.detectChanges();

        const list = fixture.debugElement.query(By.css('mat-list'));
        expect(list.nativeElement.classList).toContain('size-lg');
    });

    it('should emit itemClicked when item is clicked and list is clickable', () => {
        const spy = jest.spyOn(component.itemClicked, 'emit');
        fixture.componentRef.setInput('config', { items: mockItems, clickable: true });
        fixture.detectChanges();

        const firstItem = fixture.debugElement.query(By.css('mat-list-item'));
        firstItem.nativeElement.click();

        expect(spy).toHaveBeenCalledWith(mockItems[0]);
    });

    it('should NOT emit itemClicked when item is clicked and list is NOT clickable', () => {
        const spy = jest.spyOn(component.itemClicked, 'emit');
        fixture.componentRef.setInput('config', { items: mockItems, clickable: false });
        fixture.detectChanges();

        const firstItem = fixture.debugElement.query(By.css('mat-list-item'));
        firstItem.nativeElement.click();

        expect(spy).not.toHaveBeenCalled();
    });

    it('should NOT emit itemClicked when disabled item is clicked', () => {
        const spy = jest.spyOn(component.itemClicked, 'emit');
        fixture.componentRef.setInput('config', { items: mockItems, clickable: true });
        fixture.detectChanges();

        const disabledItem = fixture.debugElement.queryAll(By.css('mat-list-item'))[2];
        disabledItem.nativeElement.click();

        expect(spy).not.toHaveBeenCalled();
    });

    it('should emit actionClicked when an action button is clicked', () => {
        const spy = jest.spyOn(component.actionClicked, 'emit');
        fixture.componentRef.setInput('config', { items: mockItems });
        fixture.detectChanges();

        const editButton = fixture.debugElement.query(By.css('lib-button'));
        editButton.triggerEventHandler('clicked', new MouseEvent('click'));

        expect(spy).toHaveBeenCalledWith({ item: mockItems[1], actionId: 'edit' });
    });

    it('should render dividers when showDividers is true', () => {
        fixture.componentRef.setInput('config', { items: mockItems, showDividers: true });
        fixture.detectChanges();

        const dividers = fixture.debugElement.queryAll(By.css('mat-divider'));
        // 3 items should have 2 dividers
        expect(dividers.length).toBe(2);
    });
});
