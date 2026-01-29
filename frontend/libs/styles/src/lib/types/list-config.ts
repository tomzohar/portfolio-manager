import { ListItem } from './list-item';

/**
 * Configuration for the list component
 */
export interface ListConfig {
    /**
     * List items to display
     */
    items: ListItem[];

    /**
     * List item size
     * @default 'md'
     */
    size?: 'xs' | 'sm' | 'md' | 'lg';

    /**
     * Whether to show dividers between items
     * @default false
     */
    showDividers?: boolean;

    /**
     * Whether items are clickable/interactive
     * @default false
     */
    clickable?: boolean;

    /**
     * Whether the list is dense
     * @default false
     */
    dense?: boolean;

    /**
     * Additional CSS classes for the list container
     */
    cssClass?: string;
}
