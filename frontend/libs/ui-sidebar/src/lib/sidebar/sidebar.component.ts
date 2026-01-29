import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    model
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, ButtonConfig } from '@stocks-researcher/styles';

export type SidebarPosition = 'start' | 'end' | 'left' | 'right';
export type SidebarMode = 'over' | 'side' | 'push';

@Component({
    selector: 'lib-sidebar',
    standalone: true,
    imports: [CommonModule, ButtonComponent],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        'class': 'app-sidebar',
        '[class.app-sidebar--open]': 'isOpen()',
        '[class.app-sidebar--collapsible]': 'collapsible()',
        '[class.app-sidebar--closed]': '!isOpen()',
        '[class.app-sidebar--start]': 'isStart()',
        '[class.app-sidebar--end]': '!isStart()',
        '[class.app-sidebar--over]': 'mode() === "over"',
        '[class.app-sidebar--side]': 'mode() === "side"',
        '[class.app-sidebar--push]': 'mode() === "push"',
        '[class.app-sidebar--backdrop]': 'hasBackdrop()',
        '[style.--sidebar-width]': 'width()',
        '[style.--sidebar-collapsed-width]': 'collapsedWidth()'
    }
})
export class SidebarComponent {
    isOpen = model(true);
    position = input<SidebarPosition>('start');
    mode = input<SidebarMode>('side');
    width = input('280px');
    hasBackdrop = input(false);

    /** Whether the sidebar can be collapsed into a rail/mini-bar instead of hiding completely */
    collapsible = input<boolean>(false);

    /** Width when collapsed (if collapsible is true) */
    collapsedWidth = input<string>('64px');

    collapseSideBarButtonConfig = computed(() => {
        return {
            label: '',
            variant: 'icon',
            icon: this.isOpen() ? 'chevron_left' : 'chevron_right',
            size: 'md',
            color: 'primary'
        } as ButtonConfig;
    })

    isStart = computed(() => this.position() === 'start' || this.position() === 'left');

    toggle() {
        this.isOpen.set(!this.isOpen());
    }

    close() {
        if (this.isOpen()) {
            this.isOpen.set(false);
        }
    }

    onBackdropClick() {
        if (this.mode() === 'over' || (this.mode() === 'push' && this.hasBackdrop())) {
            this.close();
        }
    }
}
