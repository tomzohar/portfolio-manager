import { ChangeDetectionStrategy, Component, input, output, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Conversation } from '@stocks-researcher/types';
import { ListComponent, ListConfig, ListItem } from '@stocks-researcher/styles';

function transformDate(): (date: string) => string {
    const datePipe = inject(DatePipe);
    return (date: string) => datePipe.transform(date, 'MMM d, h:mm a') || '';
}

/**
 * ChatHistoryListComponent
 * 
 * A dumb component that renders a list of previous conversations.
 * Uses Angular Signals for performance and clean API.
 * 
 * Responsibilities:
 * - Render list of conversations
 * - Emit event when a conversation is selected
 * - Highlight active conversation
 */
@Component({
    selector: 'app-chat-history-list',
    standalone: true,
    imports: [CommonModule, ListComponent],
    templateUrl: './chat-history-list.component.html',
    styleUrl: './chat-history-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [DatePipe]
})
export class ChatHistoryListComponent {
    /** List of conversations to display */
    conversations = input.required<Conversation[]>();

    /** Current active thread ID for highlighting */
    activeThreadId = input<string | null>(null);

    /** Emitted when user clicks a conversation */
    conversationSelected = output<string>();

    /** Configuration for the generic list component */
    listConfig = computed<ListConfig>(() => ({
        items: this.listItems(),
        size: 'sm',
        clickable: true,
    }));

    transformDate = transformDate();

    /** Map conversations to generic ListItem format */
    listItems = computed<ListItem[]>(() => {
        return this.conversations().map(conv => ({
            id: conv.id,
            label: conv.title || 'New Chat',
            icon: 'chat_bubble_outline',
            navigation: `/chat/${conv.id}`
        }));
    });
}
