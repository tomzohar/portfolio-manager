import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { ListConfig } from '../types/list-config';
import { ListItem } from '../types/list-item';
import { ButtonComponent } from './button.component';
import { IconComponent } from './icon.component';

/**
 * List Component
 *
 * A generic list component that supports different sizes, icons, and actions.
 * Wraps Angular Material List for consistent styling.
 *
 * @example
 * ```html
 * <lib-list
 *   [config]="{ items: myItems, size: 'md', clickable: true }"
 *   (itemClicked)="onItemClick($event)"
 *   (actionClicked)="onActionClick($event)"
 * />
 * ```
 */
@Component({
    selector: 'lib-list',
    standalone: true,
    imports: [
        CommonModule,
        MatListModule,
        MatDividerModule,
        ButtonComponent,
        IconComponent,
    ],
    templateUrl: './list.component.html',
    styleUrl: './list.component.scss',
})
export class ListComponent {
    /**
     * List configuration
     */
    config = input.required<ListConfig>();

    /**
     * Emitted when an item is clicked
     */
    itemClicked = output<ListItem>();

    /**
     * Emitted when an item action is clicked
     */
    actionClicked = output<{ item: ListItem; actionId: string }>();

    /**
     * Computed classes for the list container
     */
    listClasses = computed(() => {
        const conf = this.config();
        const classes = ['lib-list'];

        if (conf.size) {
            classes.push(`size-${conf.size}`);
        } else {
            classes.push('size-md');
        }

        if (conf.dense) {
            classes.push('dense');
        }

        if (conf.cssClass) {
            classes.push(conf.cssClass);
        }

        return classes.join(' ');
    });

    /**
     * Handle item click
     */
    onItemClick(item: ListItem): void {
        if (this.config().clickable && !item.disabled) {
            this.itemClicked.emit(item);
        }
    }

    /**
     * Handle action click
     */
    onActionClick(event: MouseEvent, item: ListItem, actionId: string): void {
        event.stopPropagation();
        if (!item.disabled) {
            this.actionClicked.emit({ item, actionId });
        }
    }

    /**
     * Track by function for items
     */
    trackByFn(_index: number, item: ListItem): string | number {
        return item.id;
    }
}
