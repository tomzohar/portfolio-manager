import { interrupt } from '@langchain/langgraph';
import { CIOState, StateUpdate } from '../types';
import { AIMessage } from '@langchain/core/messages';

/**
 * Check if a message requires approval gate intervention
 *
 * This function determines if user input should be routed to the approval gate
 * based on action type detection (transactions, rebalancing, high-risk actions).
 *
 * @param messageContent - User message content (can be lowercase or original case)
 * @returns true if approval required, false otherwise
 *
 * @example
 * requiresApproval('buy 100 shares of aapl') // true - transaction
 * requiresApproval('rebalance my portfolio') // true - rebalancing
 * requiresApproval('what is my performance') // false - query only
 */
export function requiresApproval(messageContent: string): boolean {
  const content = messageContent.toLowerCase();

  // Transaction keywords
  const hasTransactionKeywords =
    content.includes('buy') ||
    content.includes('sell') ||
    content.includes('purchase') ||
    content.includes('acquire');

  // Rebalancing keywords
  const hasRebalancingKeywords =
    content.includes('rebalance') ||
    content.includes('reallocate') ||
    content.includes('redistribute');

  // High-risk keywords
  const hasHighRiskKeywords =
    content.includes('sell all') ||
    content.includes('sell everything') ||
    content.includes('liquidate');

  return (
    hasTransactionKeywords || hasRebalancingKeywords || hasHighRiskKeywords
  );
}

/**
 * Configuration for approval gate logic
 */
export interface ApprovalConfig {
  /**
   * Dollar threshold for transaction approval (default: $10,000)
   * Transactions >= this amount require human approval
   */
  transactionThreshold?: number;

  /**
   * Whether portfolio rebalancing requires approval (default: true)
   */
  requireApprovalForRebalancing?: boolean;
}

/**
 * Default approval configuration
 */
const DEFAULT_CONFIG: Required<ApprovalConfig> = {
  transactionThreshold: 10000,
  requireApprovalForRebalancing: true,
};

/**
 * Approval Gate Node
 *
 * Purpose: Human-in-the-Loop (HITL) decision point for high-stakes actions
 *
 * This node analyzes user intent and triggers interrupt() for actions requiring approval:
 * - Large transactions (buy/sell above threshold)
 * - Portfolio rebalancing/reallocation
 * - High-risk actions (liquidate all, sell all)
 *
 * Flow:
 * 1. Extract user intent from last message
 * 2. Detect high-stakes actions (transactions, rebalancing, etc.)
 * 3. If approval needed: call interrupt() with descriptive reason
 * 4. If no approval needed: pass through to next node
 *
 * Integration:
 * - Add to production graph via router conditional logic
 * - Configure thresholds via ApprovalConfig parameter
 * - Frontend handles SUSPENDED status and shows approval UI
 */
export function approvalGateNode(
  state: CIOState,
  config?: ApprovalConfig,
): StateUpdate {
  // Merge provided config with defaults
  const finalConfig: Required<ApprovalConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Safety check: ensure messages array exists and has content
  if (!state.messages || state.messages.length === 0) {
    return passThrough(state);
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || !lastMessage.content) {
    return passThrough(state);
  }

  const messageContent = lastMessage.content;
  const contentOriginal =
    typeof messageContent === 'string'
      ? messageContent
      : JSON.stringify(messageContent);
  const content = contentOriginal.toLowerCase();

  // Check for high-risk actions first (highest priority)
  const highRiskAction = detectHighRiskAction(content);
  if (highRiskAction) {
    triggerApprovalInterrupt(highRiskAction.reason, highRiskAction.details);
    // In tests, interrupt() is mocked and returns, so we need explicit return
    // In production, interrupt() throws and this code never executes
    return passThrough(state);
  }

  // Check for portfolio rebalancing
  if (finalConfig.requireApprovalForRebalancing && detectRebalancing(content)) {
    triggerApprovalInterrupt(
      'Portfolio rebalancing requires approval',
      'You have requested portfolio rebalancing or reallocation. This action may involve multiple transactions and significant changes to your asset allocation.',
    );
    return passThrough(state);
  }

  // Check for large transactions (use original content to preserve ticker case)
  const transaction = detectTransaction(content, contentOriginal);
  if (
    transaction &&
    transaction.totalValue >= finalConfig.transactionThreshold
  ) {
    const formattedValue = formatCurrency(transaction.totalValue);
    triggerApprovalInterrupt(
      `Large ${transaction.type} transaction requires approval`,
      `You are about to ${transaction.type} ${transaction.quantity} shares of ${transaction.ticker} at $${transaction.price} per share for a total of ${formattedValue}. This exceeds your approval threshold of ${formatCurrency(finalConfig.transactionThreshold)}.`,
    );
    return passThrough(state);
  }

  // No approval needed - pass through
  return passThrough(state);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Pass through to next node without approval
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function passThrough(state: CIOState): StateUpdate {
  return {
    messages: [
      new AIMessage('Approval gate: No approval required, proceeding...'),
    ],
    nextAction: 'end',
  };
}

/**
 * Trigger approval interrupt with reason and details
 * Note: interrupt() throws NodeInterrupt exception, so code after this call won't execute
 */
function triggerApprovalInterrupt(reason: string, details: string): void {
  const interruptMessage = `${reason}\n\n${details}\n\nPlease review and approve to continue, or reject to cancel this action.`;
  interrupt(interruptMessage);
  // Code after interrupt() will never execute in production
  // In tests, interrupt() is mocked and doesn't throw
}

/**
 * Detect high-risk actions that always require approval
 */
function detectHighRiskAction(
  content: string,
): { reason: string; details: string } | null {
  // Sell all positions
  if (content.includes('sell all') || content.includes('sell everything')) {
    return {
      reason: 'high-risk action: Selling all positions requires approval',
      details:
        'You are about to sell all positions in your portfolio. This is a significant action that will liquidate your entire portfolio.',
    };
  }

  // Liquidate portfolio
  if (content.includes('liquidate')) {
    return {
      reason: 'high-risk action: Portfolio liquidation requires approval',
      details:
        'You have requested to liquidate your portfolio. This will convert all holdings to cash and may have tax implications.',
    };
  }

  return null;
}

/**
 * Detect portfolio rebalancing keywords
 */
function detectRebalancing(content: string): boolean {
  const rebalancingKeywords = [
    'rebalance',
    'rebalancing',
    'reallocate',
    'reallocation',
    'redistribute',
  ];

  return rebalancingKeywords.some((keyword) => content.includes(keyword));
}

/**
 * Transaction detection result
 */
interface TransactionIntent {
  type: 'BUY' | 'SELL';
  ticker: string;
  quantity: number;
  price: number;
  totalValue: number;
}

/**
 * Detect transaction intent from natural language
 * Extracts: type (BUY/SELL), ticker, quantity, price
 *
 * @param content - Lowercase message content
 * @param contentOriginal - Original case message content (for ticker extraction)
 */
function detectTransaction(
  content: string,
  contentOriginal?: string,
): TransactionIntent | null {
  // Detect transaction type
  const isBuy =
    content.includes('buy') ||
    content.includes('purchase') ||
    content.includes('acquire');
  const isSell = content.includes('sell') && !content.includes('sell all');

  if (!isBuy && !isSell) {
    return null; // Not a transaction
  }

  const type = isBuy ? 'BUY' : 'SELL';

  // Extract ticker symbol (1-5 uppercase letters) from original content
  const tickerMatch = (contentOriginal || content).match(/\b([A-Z]{1,5})\b/);
  const ticker = tickerMatch ? tickerMatch[1] : 'UNKNOWN';

  // Extract quantity (number before "shares" or "share")
  const quantityMatch = content.match(/(\d+(?:,\d{3})*)\s*shares?/i);
  let quantity = 0;
  if (quantityMatch) {
    // Remove commas from number
    quantity = parseInt(quantityMatch[1].replace(/,/g, ''), 10);
  }

  // Extract price (dollar amount after "at" keyword)
  // Pattern: "at $150", "at 150", "at $2,500.50"
  const atPriceMatch = content.match(/at\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)/i);
  let price = 0;
  if (atPriceMatch) {
    // Remove commas from number
    price = parseFloat(atPriceMatch[1].replace(/,/g, ''));
  }

  // Calculate total value
  const totalValue = quantity * price;

  // Only return if we have valid quantity and price
  if (quantity > 0 && price > 0) {
    return {
      type,
      ticker,
      quantity,
      price,
      totalValue,
    };
  }

  return null;
}

/**
 * Format number as currency with commas
 */
function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
