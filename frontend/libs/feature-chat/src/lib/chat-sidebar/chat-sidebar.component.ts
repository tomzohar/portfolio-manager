import { Component, ViewEncapsulation, model, output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  SidebarComponent,
  SidebarContentComponent,
  SidebarFooterComponent,
  SidebarSectionComponent
} from '@frontend/ui-sidebar';
import { ButtonComponent, ButtonConfig, IconComponent, ListComponent, ListConfig, ListItem } from '@stocks-researcher/styles';
import { ChatFacade } from '@stocks-researcher/data-access-chat';
import { ChatHistoryListComponent } from '@stocks-researcher/ui-chat';

enum SidebarLinks {
  portfolios = 'portfolios'
}

/**
 * ChatSidebarComponent
 *
 * Encapsulates the specific sidebar layout and logic for the chat feature.
 * Uses the generic UI Sidebar library.
 */
@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    SidebarContentComponent,
    SidebarFooterComponent,
    SidebarSectionComponent,
    ButtonComponent,
    IconComponent,
    ChatHistoryListComponent,
    ListComponent
  ],
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.scss'],
  encapsulation: ViewEncapsulation.Emulated
})
export class ChatSidebarComponent implements OnInit {
  private readonly facade = inject(ChatFacade);
  private readonly router = inject(Router);

  isOpen = model(true);
  currentThreadId = this.facade.currentThreadId;
  conversations = this.facade.conversations;

  newConversation = output<void>();

  newChatButtonConfig: ButtonConfig = {
    label: 'New Chat',
    icon: 'add_comment',
    iconPosition: 'left',
    size: 'md',
    color: 'accent',
    fullWidth: true,
    cssClass: 'new-chat-btn'
  };

  collapseSideBarButtonConfig: ButtonConfig = {
    label: '',
    icon: 'chevron-left',
    size: 'md',
    variant: 'icon',
  };

  readonly sidebarLinksConfig: ListConfig = {
    clickable: true,
    size: 'sm',
    items: [
      {
        id: SidebarLinks.portfolios,
        label: 'Portfolios',
        icon: 'folder',
      }
    ]
  };

  ngOnInit(): void {
    // Initial load of conversation history
    this.facade.loadConversations(30);
  }

  /**
   * Navigate to a selected conversation thread
  */
  onConversationSelected(threadId: string): void {
    this.router.navigate(['/chat', threadId]);
  }

  onLinkClicked({ id }: ListItem) {
    switch (id) {
      case SidebarLinks.portfolios:
        this.router.navigate(['/portfolios']);
        break;
    }
  }
}
