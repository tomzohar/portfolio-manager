# data-access-chat

Chat data access layer with NgRx state management and SSE services.

## Features

- SSE connection management for real-time reasoning traces
- NgRx state for chat messages and reasoning traces
- Reconnection logic with exponential backoff
- Historical trace loading

## Usage

```typescript
import { provideChatDataAccess, ChatFacade } from '@stocks-researcher/data-access-chat';

// In app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideChatDataAccess(),
  ],
};

// In components
export class ChatComponent {
  private facade = inject(ChatFacade);
  
  traces = this.facade.traces;
  connectionStatus = this.facade.connectionStatus;
  
  ngOnInit() {
    this.facade.connectSSE('thread-id');
  }
}
```
