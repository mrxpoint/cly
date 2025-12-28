/**
 * Unified Event Schema and Type Definitions
 * For Solana Event Streaming
 */

/**
 * Enum for different event types in the Solana ecosystem
 */
export enum EventType {
  // Account-related events
  ACCOUNT_UPDATE = 'accountUpdate',
  ACCOUNT_CREATED = 'accountCreated',
  ACCOUNT_CLOSED = 'accountClosed',

  // Program-related events
  PROGRAM_INVOKED = 'programInvoked',
  INSTRUCTION_EXECUTED = 'instructionExecuted',

  // Token-related events
  TOKEN_TRANSFER = 'tokenTransfer',
  TOKEN_MINT = 'tokenMint',
  TOKEN_BURN = 'tokenBurn',

  // Block and slot events
  BLOCK_CONFIRMED = 'blockConfirmed',
  SLOT_UPDATE = 'slotUpdate',

  // Transaction events
  TRANSACTION_CONFIRMED = 'transactionConfirmed',
  TRANSACTION_FAILED = 'transactionFailed',

  // Custom events
  CUSTOM_EVENT = 'customEvent',

  // System events
  PING = 'ping',
  PONG = 'pong',
}

/**
 * Unified Event Schema for normalized event representation
 */
export interface UnifiedEventSchema {
  /**
   * Unique identifier for the event
   */
  id: string;

  /**
   * Type of the event
   */
  type: EventType;

  /**
   * Timestamp when the event occurred (milliseconds since epoch)
   */
  timestamp: number;

  /**
   * Slot at which the event was processed
   */
  slot: number;

  /**
   * Block hash where the event occurred
   */
  blockHash?: string;

  /**
   * Transaction signature (for transaction-related events)
   */
  transactionSignature?: string;

  /**
   * Program ID involved in the event (if applicable)
   */
  programId?: string;

  /**
   * Account addresses involved in the event
   */
  accounts?: string[];

  /**
   * Generic data payload for the event
   */
  data: Record<string, any>;

  /**
   * Source of the event (e.g., 'accountSubscribe', 'logsSubscribe', 'custom')
   */
  source: string;

  /**
   * Priority level for event processing
   */
  priority: 'low' | 'medium' | 'high';

  /**
   * Metadata about the event
   */
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Normalized Event representation for internal processing
 */
export interface NormalizedEvent {
  /**
   * Event ID
   */
  id: string;

  /**
   * Event type
   */
  type: EventType;

  /**
   * Timestamp in ISO 8601 format
   */
  timestamp: string;

  /**
   * Slot number
   */
  slot: number;

  /**
   * Block hash
   */
  blockHash?: string;

  /**
   * Transaction signature
   */
  transactionSignature?: string;

  /**
   * Program ID
   */
  programId?: string;

  /**
   * List of involved accounts
   */
  accounts: string[];

  /**
   * Event-specific data
   */
  eventData: Record<string, any>;

  /**
   * Event source identifier
   */
  source: string;

  /**
   * Processing priority
   */
  priority: 'low' | 'medium' | 'high';

  /**
   * Whether the event was successfully processed
   */
  processed: boolean;

  /**
   * Processing status message
   */
  processingStatus?: string;

  /**
   * Additional metadata
   */
  metadata: Record<string, any>;
}

/**
 * WebSocket Message wrapper for client-server communication
 */
export interface WSMessage<T = any> {
  /**
   * Message ID for tracking request-response pairs
   */
  id: string;

  /**
   * Message type
   */
  type:
    | 'event'
    | 'subscribe'
    | 'unsubscribe'
    | 'ack'
    | 'error'
    | 'ping'
    | 'pong';

  /**
   * Event type (for event messages)
   */
  eventType?: EventType;

  /**
   * Message payload
   */
  payload: T;

  /**
   * Timestamp of message creation
   */
  timestamp: number;

  /**
   * Error information (if applicable)
   */
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Server Configuration
 */
export interface ServerConfig {
  /**
   * WebSocket server configuration
   */
  websocket: {
    /**
     * Host to bind the WebSocket server to
     */
    host: string;

    /**
     * Port for the WebSocket server
     */
    port: number;

    /**
     * Maximum number of concurrent connections
     */
    maxConnections: number;

    /**
     * Message size limit in bytes
     */
    messageSizeLimit: number;

    /**
     * Keep-alive ping interval in milliseconds
     */
    keepAliveInterval: number;

    /**
     * Connection timeout in milliseconds
     */
    connectionTimeout: number;
  };

  /**
   * Solana RPC configuration
   */
  solana: {
    /**
     * RPC endpoint URL
     */
    rpcUrl: string;

    /**
     * WS endpoint URL for subscriptions
     */
    wsUrl: string;

    /**
     * Commitment level (finalized, confirmed, processed)
     */
    commitment: 'finalized' | 'confirmed' | 'processed';

    /**
     * Network (mainnet-beta, testnet, devnet)
     */
    network: 'mainnet-beta' | 'testnet' | 'devnet' | 'localnet';

    /**
     * Reconnection settings
     */
    reconnect: {
      /**
       * Enable automatic reconnection
       */
      enabled: boolean;

      /**
       * Initial retry delay in milliseconds
       */
      initialDelay: number;

      /**
       * Maximum retry delay in milliseconds
       */
      maxDelay: number;

      /**
       * Maximum number of retry attempts
       */
      maxRetries: number;
    };
  };

  /**
   * Event streaming configuration
   */
  streaming: {
    /**
     * Enable account subscription
     */
    accountSubscription: boolean;

    /**
     * Account filters for subscription
     */
    accountFilters?: string[];

    /**
     * Enable logs subscription
     */
    logsSubscription: boolean;

    /**
     * Log mention filters
     */
    logMentions?: string[];

    /**
     * Event buffer size
     */
    bufferSize: number;

    /**
     * Flush interval in milliseconds
     */
    flushInterval: number;

    /**
     * Enable event deduplication
     */
    deduplication: boolean;
  };

  /**
   * Logging configuration
   */
  logging: {
    /**
     * Log level (debug, info, warn, error)
     */
    level: 'debug' | 'info' | 'warn' | 'error';

    /**
     * Enable console logging
     */
    console: boolean;

    /**
     * Enable file logging
     */
    file: boolean;

    /**
     * Log file path
     */
    filePath?: string;

    /**
     * Maximum log file size in bytes
     */
    maxFileSize?: number;
  };

  /**
   * Performance monitoring
   */
  monitoring: {
    /**
     * Enable metrics collection
     */
    enabled: boolean;

    /**
     * Metrics collection interval in milliseconds
     */
    interval: number;

    /**
     * Store metrics history
     */
    storeHistory: boolean;

    /**
     * Maximum history records to keep
     */
    maxHistoryRecords: number;
  };

  /**
   * Database configuration (if applicable)
   */
  database?: {
    /**
     * Database URL or connection string
     */
    url: string;

    /**
     * Connection pool size
     */
    poolSize: number;

    /**
     * Connection timeout in milliseconds
     */
    timeout: number;
  };
}

/**
 * Subscription request for events
 */
export interface SubscriptionRequest {
  /**
   * Event types to subscribe to
   */
  eventTypes: EventType[];

  /**
   * Optional filters for the subscription
   */
  filters?: {
    accounts?: string[];
    programIds?: string[];
    minPriority?: 'low' | 'medium' | 'high';
    startSlot?: number;
  };

  /**
   * Optional callback ID for tracking
   */
  callbackId?: string;
}

/**
 * Event processing context
 */
export interface ProcessingContext {
  /**
   * Processing start time
   */
  startTime: number;

  /**
   * Processing end time
   */
  endTime?: number;

  /**
   * Processing duration in milliseconds
   */
  duration?: number;

  /**
   * List of applied transformations
   */
  transformations: string[];

  /**
   * Processing errors if any
   */
  errors: Array<{
    stage: string;
    error: Error;
  }>;

  /**
   * Additional context data
   */
  context: Record<string, any>;
}
