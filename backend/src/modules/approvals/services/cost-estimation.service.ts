import { Injectable, Logger } from '@nestjs/common';
import type {
  CostEstimate,
  CostBreakdownItem,
  AnalysisPlan,
} from '../types/cost-estimate.interface';
import {
  TOOL_COSTS,
  LLM_COSTS,
  NODE_TOKEN_AVERAGES,
  EXECUTION_TIME_ESTIMATES,
} from '../config/cost-config';

/**
 * CostEstimationService
 *
 * Estimates cost and time for analysis plans.
 * Used in HITL approval gates to inform users before expensive operations.
 *
 * Features:
 * - Calculates total cost (tool costs + LLM costs)
 * - Estimates execution time
 * - Provides breakdown by node
 * - Uses externalized configuration
 *
 * This service supports US-003: HITL Approval System
 * from the Digital CIO Chat Interface feature.
 */
@Injectable()
export class CostEstimationService {
  private readonly logger = new Logger(CostEstimationService.name);

  /**
   * Estimate cost and time for an analysis plan
   *
   * @param analysisPlan - Plan containing nodes and tools to execute
   * @returns Cost estimate with breakdown
   */
  estimateCost(analysisPlan: AnalysisPlan): CostEstimate {
    const nodes = analysisPlan.nodes || [];
    const tools = analysisPlan.tools || [];

    // Handle empty plan
    if (nodes.length === 0 && tools.length === 0) {
      return {
        totalCostUSD: 0,
        estimatedTimeSeconds: 0,
        breakdown: [],
      };
    }

    // Calculate breakdown per node (includes LLM costs + distributed tool costs)
    const breakdown = this.calculateNodeBreakdown(nodes, tools);

    // Sum total cost and time from breakdown
    const totalCostUSD = breakdown.reduce((sum, item) => sum + item.costUSD, 0);
    const estimatedTimeSeconds = breakdown.reduce(
      (sum, item) => sum + item.timeSeconds,
      0,
    );

    return {
      totalCostUSD: Math.round(totalCostUSD * 100) / 100, // Round to 2 decimal places
      estimatedTimeSeconds,
      breakdown,
    };
  }

  /**
   * Calculate total cost for tool executions
   * @private
   */
  private calculateToolCosts(tools: string[]): number {
    return tools.reduce((total, toolName) => {
      const cost = this.getToolCost(toolName);
      return total + cost;
    }, 0);
  }

  /**
   * Get cost for a specific tool
   * @private
   */
  private getToolCost(toolName: string): number {
    // Normalize tool name (case-insensitive lookup)
    const normalizedName = toolName.trim();

    // Check known tools
    if (normalizedName in TOOL_COSTS) {
      return TOOL_COSTS[normalizedName as keyof typeof TOOL_COSTS];
    }

    // Use default cost for unknown tools
    return TOOL_COSTS.DEFAULT;
  }

  /**
   * Calculate breakdown per node (LLM costs + distributed tool costs)
   * @private
   */
  private calculateNodeBreakdown(
    nodes: string[],
    tools: string[],
  ): CostBreakdownItem[] {
    // Calculate total tool cost
    const totalToolCost = this.calculateToolCosts(tools);
    const toolCostPerNode = nodes.length > 0 ? totalToolCost / nodes.length : 0;

    return nodes.map((nodeName) => {
      const tokenCount = this.getNodeTokenCount(nodeName);
      const llmCost = (tokenCount / 1000) * LLM_COSTS.PER_1K_TOKENS;

      // Total cost for this node: LLM + distributed tool costs
      const nodeCost = llmCost + toolCostPerNode;

      // Calculate time: LLM time + overhead + distributed tool time
      const llmTime = EXECUTION_TIME_ESTIMATES.LLM_PER_NODE;
      const overhead = EXECUTION_TIME_ESTIMATES.NODE_OVERHEAD;
      const toolTime =
        tools.length > 0 ? EXECUTION_TIME_ESTIMATES.API_CALL * tools.length : 0;
      const avgToolTimePerNode = nodes.length > 0 ? toolTime / nodes.length : 0;

      return {
        nodeName,
        costUSD: Math.round(nodeCost * 1000) / 1000, // Round to 3 decimal places
        timeSeconds: Math.round(llmTime + overhead + avgToolTimePerNode),
      };
    });
  }

  /**
   * Get token count for a node
   * @private
   */
  private getNodeTokenCount(nodeName: string): number {
    const normalizedName = nodeName.trim();

    // Check known nodes
    if (normalizedName in NODE_TOKEN_AVERAGES) {
      return NODE_TOKEN_AVERAGES[
        normalizedName as keyof typeof NODE_TOKEN_AVERAGES
      ];
    }

    // Use default token count for unknown nodes
    return NODE_TOKEN_AVERAGES.default;
  }
}
