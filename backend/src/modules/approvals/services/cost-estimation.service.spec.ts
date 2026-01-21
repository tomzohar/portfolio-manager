import { Test, TestingModule } from '@nestjs/testing';
import { CostEstimationService } from './cost-estimation.service';
import type {
  AnalysisPlan,
  CostEstimate,
} from '../types/cost-estimate.interface';

describe('CostEstimationService', () => {
  let service: CostEstimationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CostEstimationService],
    }).compile();

    service = module.get<CostEstimationService>(CostEstimationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('estimateCost', () => {
    it('should estimate cost for simple plan (1 node, 1 tool)', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['observer'],
        tools: ['FRED'],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      expect(estimate).toBeDefined();
      expect(estimate.totalCostUSD).toBeGreaterThan(0);
      expect(estimate.estimatedTimeSeconds).toBeGreaterThan(0);
      expect(estimate.breakdown).toHaveLength(1);
      expect(estimate.breakdown[0].nodeName).toBe('observer');
    });

    it('should estimate cost for complex plan (5 nodes, 10 tools)', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: [
          'observer',
          'macro_analysis',
          'technical_analysis',
          'fundamental_analysis',
          'reasoning',
        ],
        tools: [
          'FRED',
          'FRED',
          'Polygon',
          'Polygon',
          'Polygon',
          'FMP',
          'FMP',
          'NewsAPI',
          'NewsAPI',
          'FRED',
        ],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      expect(estimate.totalCostUSD).toBeGreaterThan(0);
      expect(estimate.estimatedTimeSeconds).toBeGreaterThan(0);
      expect(estimate.breakdown).toHaveLength(5);

      // Cost should include tool costs + LLM costs
      const hasToolCost = estimate.totalCostUSD > 0.05; // 10 tools * ~$0.01 avg
      expect(hasToolCost).toBe(true);
    });

    it('should estimate cost for plan with only LLM (no tools)', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['reasoning', 'observer'],
        tools: [],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      expect(estimate.totalCostUSD).toBeGreaterThan(0);
      expect(estimate.breakdown).toHaveLength(2);

      // Should only have LLM costs (no tool costs)
      const totalLlmCost = estimate.breakdown.reduce(
        (sum, item) => sum + item.costUSD,
        0,
      );
      expect(totalLlmCost).toBeCloseTo(estimate.totalCostUSD, 2);
    });

    it('should calculate accurate cost based on configuration', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['macro_analysis'], // 5K tokens @ $0.002/1K = $0.01
        tools: ['FRED'], // $0.01
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      // Total should be approximately $0.02 ($0.01 FRED + $0.01 LLM)
      expect(estimate.totalCostUSD).toBeGreaterThan(0.015);
      expect(estimate.totalCostUSD).toBeLessThanOrEqual(0.025);
    });

    it('should calculate accurate time estimate', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['observer'], // ~10s LLM + 1s overhead
        tools: ['FRED'], // ~2s API call
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      // Total should be approximately 13s (2s API + 10s LLM + 1s overhead)
      expect(estimate.estimatedTimeSeconds).toBeGreaterThanOrEqual(10);
      expect(estimate.estimatedTimeSeconds).toBeLessThanOrEqual(20);
    });

    it('should handle empty analysis plan', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: [],
        tools: [],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      expect(estimate.totalCostUSD).toBe(0);
      expect(estimate.estimatedTimeSeconds).toBe(0);
      expect(estimate.breakdown).toHaveLength(0);
    });

    it('should handle plan with unknown tools (use default cost)', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['observer'],
        tools: ['UnknownTool', 'AnotherUnknownTool'],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      expect(estimate.totalCostUSD).toBeGreaterThan(0);
      expect(estimate.breakdown).toHaveLength(1);
      // Should include observer LLM cost + distributed tool costs
      expect(estimate.breakdown[0].costUSD).toBeGreaterThan(0);
    });

    it('should handle plan with unknown nodes (use default token count)', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['custom_node', 'another_custom_node'],
        tools: [],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      expect(estimate.totalCostUSD).toBeGreaterThan(0);
      expect(estimate.breakdown).toHaveLength(2);
    });

    it('should include breakdown for each node', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['observer', 'reasoning'],
        tools: ['FRED'],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      expect(estimate.breakdown).toHaveLength(2);
      expect(estimate.breakdown[0]).toHaveProperty('nodeName');
      expect(estimate.breakdown[0]).toHaveProperty('costUSD');
      expect(estimate.breakdown[0]).toHaveProperty('timeSeconds');
      expect(estimate.breakdown[0].nodeName).toBe('observer');
      expect(estimate.breakdown[1].nodeName).toBe('reasoning');
    });

    it('should sum breakdown costs to total cost', () => {
      // Arrange
      const plan: AnalysisPlan = {
        nodes: ['macro_analysis', 'technical_analysis'],
        tools: ['FRED', 'Polygon'],
      };

      // Act
      const estimate: CostEstimate = service.estimateCost(plan);

      // Assert
      const breakdownTotal = estimate.breakdown.reduce(
        (sum, item) => sum + item.costUSD,
        0,
      );
      expect(estimate.totalCostUSD).toBeCloseTo(breakdownTotal, 2);
    });
  });
});
