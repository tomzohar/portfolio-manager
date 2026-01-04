import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistryService } from './tool-registry.service';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolRegistryService],
    }).compile();

    service = module.get<ToolRegistryService>(ToolRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerTool', () => {
    it('should register a new tool', () => {
      const mockTool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'A test tool',
        schema: z.object({
          input: z.string(),
        }),
        func: ({ input }) => Promise.resolve(`Processed: ${input}`),
      });

      service.registerTool(mockTool);

      const tools = service.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should register multiple tools', () => {
      const tool1 = new DynamicStructuredTool({
        name: 'tool_1',
        description: 'First tool',
        schema: z.object({}),
        func: () => Promise.resolve('result1'),
      });

      const tool2 = new DynamicStructuredTool({
        name: 'tool_2',
        description: 'Second tool',
        schema: z.object({}),
        func: () => Promise.resolve('result2'),
      });

      service.registerTool(tool1);
      service.registerTool(tool2);

      const tools = service.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain('tool_1');
      expect(tools.map((t) => t.name)).toContain('tool_2');
    });

    it('should overwrite tool with same name', () => {
      const tool1 = new DynamicStructuredTool({
        name: 'duplicate_tool',
        description: 'First version',
        schema: z.object({}),
        func: () => Promise.resolve('v1'),
      });

      const tool2 = new DynamicStructuredTool({
        name: 'duplicate_tool',
        description: 'Second version',
        schema: z.object({}),
        func: () => Promise.resolve('v2'),
      });

      service.registerTool(tool1);
      service.registerTool(tool2);

      const tools = service.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('Second version');
    });
  });

  describe('getTools', () => {
    it('should return empty array initially', () => {
      const tools = service.getTools();
      expect(tools).toEqual([]);
    });

    it('should return all registered tools', () => {
      const tool1 = new DynamicStructuredTool({
        name: 'tool_1',
        description: 'Tool 1',
        schema: z.object({}),
        func: () => Promise.resolve('result'),
      });

      service.registerTool(tool1);

      const tools = service.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBe(tool1);
    });
  });

  describe('getTool', () => {
    it('should get tool by name', () => {
      const mockTool = new DynamicStructuredTool({
        name: 'specific_tool',
        description: 'A specific tool',
        schema: z.object({}),
        func: () => Promise.resolve('result'),
      });

      service.registerTool(mockTool);

      const tool = service.getTool('specific_tool');
      expect(tool).toBe(mockTool);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = service.getTool('non_existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('clearTools', () => {
    it('should clear all registered tools', () => {
      const tool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'Test',
        schema: z.object({}),
        func: () => Promise.resolve('result'),
      });

      service.registerTool(tool);
      expect(service.getTools()).toHaveLength(1);

      service.clearTools();
      expect(service.getTools()).toHaveLength(0);
    });
  });

  describe('hasTool', () => {
    it('should return true for registered tool', () => {
      const tool = new DynamicStructuredTool({
        name: 'existing_tool',
        description: 'Test',
        schema: z.object({}),
        func: () => Promise.resolve('result'),
      });

      service.registerTool(tool);
      expect(service.hasTool('existing_tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(service.hasTool('non_existent')).toBe(false);
    });
  });

  describe('getToolCount', () => {
    it('should return correct tool count', () => {
      expect(service.getToolCount()).toBe(0);

      const tool1 = new DynamicStructuredTool({
        name: 'tool_1',
        description: 'Test 1',
        schema: z.object({}),
        func: () => Promise.resolve('result'),
      });

      const tool2 = new DynamicStructuredTool({
        name: 'tool_2',
        description: 'Test 2',
        schema: z.object({}),
        func: () => Promise.resolve('result'),
      });

      service.registerTool(tool1);
      expect(service.getToolCount()).toBe(1);

      service.registerTool(tool2);
      expect(service.getToolCount()).toBe(2);
    });
  });

  describe('Persona Tools Registration', () => {
    it('should register all three persona tools: technical_analyst, macro_analyst, risk_manager', () => {
      // Simulate the three persona tools
      const technicalAnalystTool = new DynamicStructuredTool({
        name: 'technical_analyst',
        description:
          'Calculates technical indicators (RSI, MACD, etc.) for a ticker',
        schema: z.object({
          ticker: z.string(),
        }),
        func: () => Promise.resolve('{}'),
      });

      const macroAnalystTool = new DynamicStructuredTool({
        name: 'macro_analyst',
        description: 'Analyzes macroeconomic indicators and market regime',
        schema: z.object({
          query: z.string().optional(),
        }),
        func: () => Promise.resolve('{}'),
      });

      const riskManagerTool = new DynamicStructuredTool({
        name: 'risk_manager',
        description: 'Calculates portfolio-level risk metrics (VaR, Beta)',
        schema: z.object({
          userId: z.string(),
        }),
        func: () => Promise.resolve('{}'),
      });

      // Register all three
      service.registerTool(technicalAnalystTool);
      service.registerTool(macroAnalystTool);
      service.registerTool(riskManagerTool);

      // Verify all three are available
      const tools = service.getTools();
      expect(tools).toHaveLength(3);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('technical_analyst');
      expect(toolNames).toContain('macro_analyst');
      expect(toolNames).toContain('risk_manager');

      // Verify each can be retrieved by name
      expect(service.hasTool('technical_analyst')).toBe(true);
      expect(service.hasTool('macro_analyst')).toBe(true);
      expect(service.hasTool('risk_manager')).toBe(true);

      expect(service.getTool('technical_analyst')).toBe(technicalAnalystTool);
      expect(service.getTool('macro_analyst')).toBe(macroAnalystTool);
      expect(service.getTool('risk_manager')).toBe(riskManagerTool);
    });
  });
});
