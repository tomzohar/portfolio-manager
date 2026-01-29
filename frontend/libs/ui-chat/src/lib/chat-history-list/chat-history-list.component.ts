import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Conversation } from '@stocks-researcher/types';
import { IconComponent } from '@stocks-researcher/styles';

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
    imports: [CommonModule, DatePipe, IconComponent],
    templateUrl: './chat-history-list.component.html',
    styleUrl: './chat-history-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatHistoryListComponent {
    /** List of conversations to display */
    conversations = input.required<Conversation[]>();

    /** Current active thread ID for highlighting */
    activeThreadId = input<string | null>(null);

    /** Emitted when user clicks a conversation */
    conversationSelected = output<string>();

    onSelect(id: string): void {
        this.conversationSelected.emit(id);
    }
}
