import {
    Component,
    Input,
    Output,
    EventEmitter,
    ChangeDetectionStrategy
} from '@angular/core';
import { SidebarHeaderComponent } from './sidebar-modules/sidebar-header.component';
import { SidebarContentComponent } from './sidebar-modules/sidebar-content.component';
import { SidebarFooterComponent } from './sidebar-modules/sidebar-footer.component';
import { SidebarSectionComponent } from './sidebar-modules/sidebar-section.component';

export type SidebarPosition = 'start' | 'end' | 'left' | 'right';
export type SidebarMode = 'over' | 'side' | 'push';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [
        SidebarHeaderComponent,
        SidebarContentComponent,
        SidebarFooterComponent,
        SidebarSectionComponent
    ],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        'class': 'app-sidebar',
        '[class.app-sidebar--open]': 'isOpen',
        '[class.app-sidebar--closed]': '!isOpen',
        '[class.app-sidebar--start]': 'isStart',
        '[class.app-sidebar--end]': '!isStart',
        '[class.app-sidebar--over]': 'mode === "over"',
        '[class.app-sidebar--side]': 'mode === "side"',
        '[class.app-sidebar--push]': 'mode === "push"',
        '[class.app-sidebar--backdrop]': 'hasBackdrop',
        '[style.--sidebar-width]': 'width'
    }
})
export class SidebarComponent {
    @Input() isOpen = true;
    @Input() position: SidebarPosition = 'start';
    @Input() mode: SidebarMode = 'side';
    @Input() width = '280px';
    @Input() hasBackdrop = false;

    @Output() isOpenChange = new EventEmitter<boolean>();

    get isStart(): boolean {
        return this.position === 'start' || this.position === 'left';
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.isOpenChange.emit(this.isOpen);
    }

    close() {
        if (this.isOpen) {
            this.isOpen = false;
            this.isOpenChange.emit(this.isOpen);
        }
    }

    onBackdropClick() {
        if (this.mode === 'over' || (this.mode === 'push' && this.hasBackdrop)) {
            this.close();
        }
    }
}
