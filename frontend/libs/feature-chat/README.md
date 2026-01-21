# @stocks-researcher/feature-chat

This library contains the feature components for the chat functionality in the Stocks Researcher application.

## Overview

The `feature-chat` library provides smart container components that orchestrate the chat interface, including:
- Real-time reasoning trace display
- SSE connection management
- Chat message input and display
- Portfolio context integration

## Components

### ReasoningTracePanelComponent ✅ IMPLEMENTED
Smart container component that orchestrates trace display with SSE streaming.

**Features:**
- Real-time SSE connection management
- Historical trace loading
- Auto-scroll to latest traces
- Connection status indicator
- Empty, loading, and error states
- Trace expansion/collapse
- Retry functionality

**Inputs:**
- `threadId: Signal<string>` (required) - The conversation thread ID

**Outputs:**
- `traceClick: EventEmitter<ReasoningTrace>` - Emitted when a trace is clicked

**Usage:**
```typescript
import { ReasoningTracePanelComponent } from '@stocks-researcher/feature-chat';

@Component({
  standalone: true,
  imports: [ReasoningTracePanelComponent],
  template: `
    <app-reasoning-trace-panel 
      [threadId]="threadId()"
      (traceClick)="handleTraceClick($event)">
    </app-reasoning-trace-panel>
  `
})
export class MyComponent {
  threadId = signal('thread-123');
  
  handleTraceClick(trace: ReasoningTrace): void {
    console.log('Trace clicked:', trace);
  }
}
```

**State Management:**
The component connects to `ChatFacade` and automatically:
- Establishes SSE connection on init
- Loads historical traces
- Subscribes to real-time updates
- Cleans up connections on destroy
- Handles reconnection on errors

### ChatPageComponent
Main chat page container that manages the entire chat interface.

**Usage:**
```typescript
import { ChatPageComponent } from '@stocks-researcher/feature-chat';

// In your routing module:
{
  path: 'chat/:threadId',
  component: ChatPageComponent
}
```

## Dependencies

This library depends on:
- `@stocks-researcher/data-access-chat` - State management and API services
- `@stocks-researcher/ui-chat` - Presentational components
- `@stocks-researcher/types` - Type definitions

## Development

### Running Tests
```bash
nx test feature-chat
```

### Linting
```bash
nx lint feature-chat
```

## Architecture

This library follows the container/presentational component pattern:
- **Container components** (smart): Handle state management and business logic
- **Presentational components** (dumb): Pure display components (in ui-chat library)

All container components connect to the state via the `ChatFacade` from `@stocks-researcher/data-access-chat`.
