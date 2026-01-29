import { ButtonConfig } from './button-config';

/**
 * Interface for an item in the list
 */
export interface ListItem {
    /**
     * Unique identifier for the item
     */
    id: string | number;

    /**
     * Primary label text
     */
    label: string;

    /**
     * Secondary label text (displayed below primary label)
     */
    subLabel?: string;

    /**
     * Material icon name to display at the start of the item
     */
    icon?: string;

    /**
     * Optional image URL to display at the start of the item
     */
    imageUrl?: string;

    /**
     * Actions available for this item
     */
    actions?: ListItemAction[];

    /**
     * Whether the item is disabled
     */
    disabled?: boolean;

    /**
     * Whether the item is currently selected
     */
    selected?: boolean;
}

/**
 * Configuration for an action on a list item
 */
export interface ListItemAction extends Omit<ButtonConfig, 'label'> {
    /**
     * Unique identifier for the action
     */
    id: string;

    /**
     * Label for the action (used for aria-label or tooltip)
     */
    label: string;
}
