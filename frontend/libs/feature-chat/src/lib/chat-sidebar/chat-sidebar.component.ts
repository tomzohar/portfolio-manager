import { Component, ViewEncapsulation, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SidebarComponent,
  SidebarContentComponent,
  SidebarFooterComponent,
  SidebarSectionComponent
} from '@frontend/ui-sidebar';
import { ButtonComponent, ButtonConfig, IconComponent } from '@stocks-researcher/styles';

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
    IconComponent
  ],
  templateUrl: './chat-sidebar.component.html',
  styleUrls: ['./chat-sidebar.component.scss'],
  encapsulation: ViewEncapsulation.Emulated
})
export class ChatSidebarComponent {
  isOpen = model(true);

  newConversation = output<void>();

  newChatButtonConfig: ButtonConfig = {
    label: 'New Chat',
    size: 'md',
    fullWidth: true,
  };

  collapseSideBarButtonConfig: ButtonConfig = {
    label: '',
    icon: 'chevron-left',
    size: 'md',
    variant: 'icon',
  };
}
