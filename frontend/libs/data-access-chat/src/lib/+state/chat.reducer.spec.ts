import { chatReducer } from './chat.reducer';
import { initialChatState } from './chat.state';
import { ChatActions } from './chat.actions';
import { Conversation } from '@stocks-researcher/types';

describe('ChatReducer Conversations', () => {
    it('should set loading to true on loadConversations', () => {
        const action = ChatActions.loadConversations({ limit: 10 });
        const state = chatReducer(initialChatState, action);

        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
    });

    it('should update conversations on loadConversationsSuccess', () => {
        const mockConversations: Conversation[] = [
            { id: '1', userId: 'u1', config: {}, createdAt: 'date', updatedAt: 'date' },
        ];
        const action = ChatActions.loadConversationsSuccess({ conversations: mockConversations });
        const state = chatReducer(initialChatState, action);

        expect(state.conversations).toEqual(mockConversations);
        expect(state.loading).toBe(false);
    });

    it('should set error on loadConversationsFailure', () => {
        const error = 'Failed to load';
        const action = ChatActions.loadConversationsFailure({ error });
        const state = chatReducer(initialChatState, action);

        expect(state.error).toBe(error);
        expect(state.loading).toBe(false);
    });
});
