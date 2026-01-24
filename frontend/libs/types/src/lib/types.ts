export function types(): string {
  return 'types';
}

// Enums
export enum PortfolioRiskProfile {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
}

// Portfolio Dashboard Types (matching backend entities)
export interface DashboardPortfolio {
  id: string;
  name: string;
  description?: string;
  riskProfile?: PortfolioRiskProfile;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DashboardAsset {
  id?: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  // Enriched market data fields (from backend EnrichedAssetDto)
  currentPrice?: number;
  todaysChange?: number; // Today's price change in dollars
  todaysChangePerc?: number; // Today's price change in percentage
  lastUpdated?: number; // Last updated timestamp (Unix milliseconds)
  // Computed fields (may be calculated on frontend)
  marketValue?: number;
  pl?: number;
  plPercent?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// DTOs for API operations

export interface CreatePortfolioDto {
  name: string;
  description?: string;
  initialInvestment?: number;
  riskProfile?: PortfolioRiskProfile;
}

export interface AddAssetDto {
  ticker: string;
  quantity: number;
  avgPrice: number;
}

// Transaction Types
export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export interface DashboardTransaction {
  id: string;
  portfolioId: string;
  type: TransactionType;
  ticker: string;
  quantity: number;
  price: number;
  totalValue: number;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Display version of transaction with formatted fields for UI presentation
 */
export interface DisplayTransaction extends Omit<DashboardTransaction, 'transactionDate'> {
  transactionDate: string | Date; // Can be formatted string or Date
}

export interface CreateTransactionDto {
  type: TransactionType;
  ticker: string;
  quantity: number;
  price: number;
  transactionDate?: Date; // Optional, defaults to now
}

export interface TransactionFilters {
  ticker?: string;
  type?: TransactionType;
  startDate?: string; // ISO 8601 date string
  endDate?: string;   // ISO 8601 date string
}

// Backend Portfolio response with assets
export interface PortfolioWithAssets extends DashboardPortfolio {
  assets: DashboardAsset[];
}

// Auth Types
export interface User {
  id: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Ticker Search Types (from backend DTO)
export interface TickerResult {
  ticker: string;
  name: string;
  market: string;
  type: string;
}

export interface AssetSearchConfig {
  mode: 'single' | 'multi';
  title?: string;
  placeholder?: string;
  maxSelections?: number; // Optional limit for multi-select
}

export type AssetSearchResult = TickerResult[];

// Performance Attribution Types

/**
 * Timeframe enum for performance calculations
 * Matches backend Timeframe enum
 */
export enum Timeframe {
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  YEAR_TO_DATE = 'YTD',
  ALL_TIME = 'ALL_TIME',
}

/**
 * Performance analysis data (portfolio vs benchmark)
 * Matches backend BenchmarkComparisonDto
 */
export interface PerformanceAnalysis {
  portfolioReturn: number;      // Decimal (0.085 = 8.5%)
  benchmarkReturn: number;       // Decimal
  alpha: number;                 // Excess return (portfolio - benchmark)
  benchmarkTicker: string;       // e.g., "SPY"
  timeframe: Timeframe;
  portfolioPeriodReturn?: number;  // Period return (non-annualized)
  benchmarkPeriodReturn?: number;  // Benchmark period return
  periodDays?: number;             // Number of days in period
  warning?: string;                // Warning message for short timeframes
  cashAllocationAvg?: number;      // Average cash allocation percentage over the period (as decimal)
}

/**
 * Historical data point for chart visualization
 * Matches backend HistoricalDataPointDto
 */
export interface HistoricalDataPoint {
  date: string;                 // ISO date (YYYY-MM-DD)
  portfolioValue: number;       // Normalized (starts at 100)
  benchmarkValue: number;       // Normalized (starts at 100)
}

/**
 * Historical data response from API
 * Matches backend HistoricalDataResponseDto
 */
export interface HistoricalDataResponse {
  portfolioId: string;
  timeframe: Timeframe;
  data: HistoricalDataPoint[];
  startDate: Date | string;
  endDate: Date | string;
  warning?: string;  // Warning message about data adjustments
  cashAllocationAvg?: number;      // Average cash allocation percentage over the period (as decimal)
}

// =========================================
// Chat & Reasoning Trace Types (US-001)
// =========================================

/**
 * Status of reasoning trace execution
 */
export enum ReasoningTraceStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  INTERRUPTED = 'interrupted',
}

/**
 * Tool result attached to a reasoning trace
 */
export interface ToolResult {
  toolName: string;
  input: unknown;
  output: unknown;
  error?: string;
  durationMs?: number;
}

/**
 * Reasoning trace entity from backend
 * Represents a single step in the AI's reasoning process
 */
export interface ReasoningTrace {
  id: string;
  threadId: string;
  userId: string;
  messageId?: string; // Link to specific conversation message
  nodeName: string;
  input: unknown;
  output: unknown;
  reasoning: string;
  status?: ReasoningTraceStatus;
  toolResults?: ToolResult[];
  durationMs?: number;
  error?: string;
  stepIndex?: number;
  createdAt: Date | string;
}

/**
 * SSE connection status
 */
export enum SSEConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * SSE event types from backend
 */
export enum SSEEventType {
  LLM_START = 'llm.start',
  LLM_TOKEN = 'llm.token',
  LLM_COMPLETE = 'llm.complete',
  NODE_START = 'node.start',
  NODE_COMPLETE = 'node.complete',
  GRAPH_COMPLETE = 'graph.complete',
  ERROR = 'error',
}

/**
 * Base SSE event structure
 */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  threadId?: string;
}

/**
 * LLM token event data
 */
export interface LLMTokenEventData {
  token: string;
  nodeName: string;
}

/**
 * Node completion event data
 */
export interface NodeCompleteEventData {
  trace: ReasoningTrace;
}

/**
 * Graph completion event data
 */
export interface GraphCompleteEventData {
  threadId: string;
  finalOutput: unknown;
}

/**
 * Error event data
 */
export interface ErrorEventData {
  message: string;
  code?: string;
}

/**
 * Graph execution result from backend
 */
export interface GraphResult {
  threadId: string;
  output: unknown;
}

/**
 * Run graph DTO
 */
export interface RunGraphDto {
  message: string;
  portfolio?: string; // Portfolio ID
  threadId?: string;
}

/**
 * Resume graph DTO (for HITL)
 */
export interface ResumeGraphDto {
  threadId: string;
  userInput: string;
}

// =========================================
// Conversation Message Types (CROSS-T1)
// =========================================

/**
 * Message type enum for discriminated union
 */
export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

/**
 * Base message interface with common properties
 */
export interface BaseMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date | string;
  sequence?: number; // For guaranteed ordering in conversation
}

/**
 * User message in conversation
 */
export interface UserMessage extends BaseMessage {
  type: MessageType.USER;
  isOptimistic?: boolean; // Flag for pending messages not yet confirmed by backend
}

/**
 * AI assistant message in conversation
 * Links to reasoning traces that generated this response
 */
export interface AssistantMessage extends BaseMessage {
  type: MessageType.ASSISTANT;
  traceIds?: string[]; // Links to reasoning traces
  isOptimistic?: boolean; // Flag for streaming messages not yet complete
}

/**
 * System message (status, errors, notifications)
 */
export interface SystemMessage extends BaseMessage {
  type: MessageType.SYSTEM;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Discriminated union of all message types
 */
export type ConversationMessage = UserMessage | AssistantMessage | SystemMessage;

/**
 * Type guard for UserMessage
 */
export function isUserMessage(msg: ConversationMessage): msg is UserMessage {
  return msg.type === MessageType.USER;
}

/**
 * Type guard for AssistantMessage
 */
export function isAssistantMessage(msg: ConversationMessage): msg is AssistantMessage {
  return msg.type === MessageType.ASSISTANT;
}

/**
 * Type guard for SystemMessage
 */
export function isSystemMessage(msg: ConversationMessage): msg is SystemMessage {
  return msg.type === MessageType.SYSTEM;
}

/**
 * Pending sent message (optimistic UI)
 * Stores metadata about messages that have been sent but not yet confirmed by backend
 */
export interface PendingSentMessage {
  content: string;
  timestamp: string;  // ISO timestamp captured when message was sent
  sequence: number;   // Sequence number for guaranteed ordering
}

// =========================================
// Backend Conversation Message Types
// =========================================

/**
 * Metadata attached to conversation messages from backend
 * Used primarily for assistant messages to link to reasoning traces
 */
export interface ConversationMessageMetadata {
  /** IDs of reasoning traces linked to this message (for assistant messages) */
  traceIds?: string[];
  /** Which LLM model generated this response */
  modelUsed?: string;
  /** Number of tool calls made for this response */
  toolCallCount?: number;
  /** Error message if the message represents a failed operation */
  errorMessage?: string;
}

/**
 * Conversation message as returned from the backend API
 * GET /api/agents/conversations/:threadId/messages
 */
export interface BackendConversationMessage {
  id: string;
  threadId: string;
  userId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  sequence: number;
  metadata?: ConversationMessageMetadata | null;
  createdAt: string; // ISO timestamp
}
