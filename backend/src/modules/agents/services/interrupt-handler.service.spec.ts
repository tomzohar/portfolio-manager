import { Test, TestingModule } from '@nestjs/testing';
import { InterruptHandlerService } from './interrupt-handler.service';
import {
  GraphStateWithInterrupt,
  CheckpointState,
} from './types/langgraph.types';
import { HumanMessage } from '@langchain/core/messages';

describe('InterruptHandlerService', () => {
  let service: InterruptHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InterruptHandlerService],
    }).compile();

    service = module.get<InterruptHandlerService>(InterruptHandlerService);
  });

  describe('checkForInterrupt', () => {
    it('should return null if no interrupt field present', () => {
      const state: GraphStateWithInterrupt = {
        userId: 'user-123',
        threadId: 'thread-123',
        messages: [new HumanMessage('test')],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = service.checkForInterrupt(state, 'thread-123');

      expect(result).toBeNull();
    });

    it('should return null if interrupt array is empty', () => {
      const state: GraphStateWithInterrupt = {
        userId: 'user-123',
        threadId: 'thread-123',
        messages: [new HumanMessage('test')],
        errors: [],
        iteration: 1,
        maxIterations: 10,
        __interrupt__: [],
      };

      const result = service.checkForInterrupt(state, 'thread-123');

      expect(result).toBeNull();
    });

    it('should return suspended result when interrupted', () => {
      const state: GraphStateWithInterrupt = {
        userId: 'user-123',
        threadId: 'thread-123',
        messages: [new HumanMessage('test')],
        errors: [],
        iteration: 1,
        maxIterations: 10,
        __interrupt__: [{ value: 'User approval required' }],
      };

      const result = service.checkForInterrupt(state, 'thread-123');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('SUSPENDED');
      expect(result?.success).toBe(false);
      expect(result?.threadId).toBe('thread-123');
      expect(result?.interruptReason).toBe('User approval required');
    });

    it('should use default reason if interrupt has no value', () => {
      const state: GraphStateWithInterrupt = {
        userId: 'user-123',
        threadId: 'thread-123',
        messages: [new HumanMessage('test')],
        errors: [],
        iteration: 1,
        maxIterations: 10,
        __interrupt__: [{ value: '' }],
      };

      const result = service.checkForInterrupt(state, 'thread-123');

      expect(result).not.toBeNull();
      expect(result?.interruptReason).toBe(
        'Graph execution paused for user input',
      );
    });
  });

  describe('isThreadSuspended', () => {
    it('should return true if thread has pending nodes', () => {
      const state: CheckpointState = {
        values: {
          userId: 'user-123',
          threadId: 'thread-123',
          messages: [],
          errors: [],
          iteration: 1,
          maxIterations: 10,
        },
        next: ['some_node'],
      };

      const result = service.isThreadSuspended(state);

      expect(result).toBe(true);
    });

    it('should return true if thread has interrupt', () => {
      const state: CheckpointState = {
        values: {
          userId: 'user-123',
          threadId: 'thread-123',
          messages: [],
          errors: [],
          iteration: 1,
          maxIterations: 10,
          __interrupt__: [{ value: 'Paused' }],
        },
      };

      const result = service.isThreadSuspended(state);

      expect(result).toBe(true);
    });

    it('should return false if thread is completed (no next, no interrupt)', () => {
      const state: CheckpointState = {
        values: {
          userId: 'user-123',
          threadId: 'thread-123',
          messages: [],
          errors: [],
          iteration: 1,
          maxIterations: 10,
        },
      };

      const result = service.isThreadSuspended(state);

      expect(result).toBe(false);
    });
  });

  describe('isInterruptError', () => {
    it('should return true for NodeInterrupt error', () => {
      const error = {
        name: 'NodeInterrupt',
        message: 'Graph interrupted',
      };

      const result = service.isInterruptError(error);

      expect(result).toBe(true);
    });

    it('should return true for GraphValueError', () => {
      const error = {
        name: 'GraphValueError',
        message: 'No checkpointer set',
      };

      const result = service.isInterruptError(error);

      expect(result).toBe(true);
    });

    it('should return true if message contains NodeInterrupt', () => {
      const error = {
        name: 'Error',
        message: 'NodeInterrupt: User approval required',
      };

      const result = service.isInterruptError(error);

      expect(result).toBe(true);
    });

    it('should return false for non-interrupt errors', () => {
      const error = {
        name: 'TypeError',
        message: 'Cannot read property',
      };

      const result = service.isInterruptError(error);

      expect(result).toBe(false);
    });
  });

  describe('getInterruptReason', () => {
    it('should return checkpoint message for checkpointer errors', () => {
      const error = {
        name: 'GraphValueError',
        message: 'No checkpointer set',
      };

      const result = service.getInterruptReason(error);

      expect(result).toBe(
        'This action requires human approval. Please review and confirm to continue.',
      );
    });

    it('should return error message if present', () => {
      const error = {
        name: 'NodeInterrupt',
        message: 'Custom interrupt reason',
      };

      const result = service.getInterruptReason(error);

      expect(result).toBe('Custom interrupt reason');
    });

    it('should return default reason if no message', () => {
      const error = {
        name: 'NodeInterrupt',
        message: '',
      };

      const result = service.getInterruptReason(error);

      expect(result).toBe('Graph execution paused for user input');
    });
  });

  describe('buildSuspendedResult', () => {
    it('should build suspended result with all required fields', () => {
      const state: GraphStateWithInterrupt = {
        userId: 'user-123',
        threadId: 'thread-123',
        messages: [],
        errors: [],
        iteration: 1,
        maxIterations: 10,
      };

      const result = service.buildSuspendedResult(
        state,
        'thread-123',
        'Test reason',
      );

      expect(result.threadId).toBe('thread-123');
      expect(result.finalState).toBe(state);
      expect(result.success).toBe(false);
      expect(result.status).toBe('SUSPENDED');
      expect(result.interruptReason).toBe('Test reason');
    });
  });
});
