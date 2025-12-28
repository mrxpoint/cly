/**
 * EventNormalizer - Solana Transaction Event Normalizer
 * Converts raw Solana transactions to unified events format
 * Created: 2025-12-28 01:58:06 UTC
 */

import {
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
  TransactionResponse,
  PublicKey,
  PartiallyDecodedInstruction,
  ParsedInstruction,
} from '@solana/web3.js';

/**
 * Unified event structure for normalized Solana transactions
 */
export interface NormalizedEvent {
  id: string;
  signature: string;
  timestamp: number;
  blockTime: number;
  blockHeight: number | null;
  slot: number;
  status: 'success' | 'failed' | 'pending';
  from: string;
  to?: string;
  type: EventType;
  subType?: string;
  amount?: string;
  mint?: string;
  programId: string;
  instructions: InstructionEvent[];
  fee: number;
  feePayerAddress: string;
  raw: ParsedTransactionWithMeta | null;
  metadata?: Record<string, unknown>;
}

/**
 * Instruction-level event details
 */
export interface InstructionEvent {
  index: number;
  programId: string;
  type: string;
  parsed?: Record<string, unknown>;
  raw?: string;
  accounts: string[];
}

/**
 * Enum for event types
 */
export enum EventType {
  TRANSFER = 'transfer',
  TOKEN_TRANSFER = 'tokenTransfer',
  TOKEN_MINT = 'tokenMint',
  TOKEN_BURN = 'tokenBurn',
  TOKEN_SWAP = 'tokenSwap',
  NFT_TRANSFER = 'nftTransfer',
  NFT_MINT = 'nftMint',
  NFT_BURN = 'nftBurn',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  VOTE = 'vote',
  PROGRAM_INTERACTION = 'programInteraction',
  UNKNOWN = 'unknown',
}

/**
 * EventNormalizer class for converting raw Solana transactions to unified events
 */
export class EventNormalizer {
  /**
   * Normalize a single transaction response to unified event format
   */
  static normalizeTransaction(
    transaction: ParsedTransactionWithMeta,
    signature: string
  ): NormalizedEvent {
    const { transaction: txData, meta, blockTime, slot } = transaction;
    const message = txData.message;
    const accountKeys = message.accountKeys;

    // Extract basic transaction info
    const feePayerIndex = 0;
    const feePayerAddress = accountKeys[feePayerIndex]?.pubkey.toString() || 'unknown';
    const fee = meta?.fee || 0;
    const status = meta?.err ? 'failed' : 'success';

    // Process instructions
    const instructions = this.processInstructions(
      message.instructions,
      accountKeys.map((ak) => ak.pubkey.toString())
    );

    // Determine event type and primary details
    const { type, subType, from, to, amount, mint, programId } =
      this.determineEventType(instructions, accountKeys, feePayerAddress);

    // Create normalized event
    const event: NormalizedEvent = {
      id: `${signature}-${slot}`,
      signature,
      timestamp: blockTime ? blockTime * 1000 : Date.now(),
      blockTime: blockTime || 0,
      blockHeight: null, // Will be set separately if available
      slot: slot || 0,
      status: status as 'success' | 'failed',
      from,
      to,
      type,
      subType,
      amount,
      mint,
      programId,
      instructions,
      fee,
      feePayerAddress,
      raw: transaction,
      metadata: {
        accountCount: accountKeys.length,
        instructionCount: instructions.length,
        recentBlockhash: txData.message.recentBlockhash,
      },
    };

    return event;
  }

  /**
   * Normalize multiple transactions
   */
  static normalizeTransactions(
    transactions: ParsedTransactionWithMeta[],
    signatures: string[]
  ): NormalizedEvent[] {
    return transactions.map((tx, index) =>
      this.normalizeTransaction(tx, signatures[index])
    );
  }

  /**
   * Process transaction instructions
   */
  private static processInstructions(
    instructions: (ParsedInstruction | PartiallyDecodedInstruction)[],
    accountKeys: string[]
  ): InstructionEvent[] {
    return instructions.map((instruction, index) => {
      const instructionEvent: InstructionEvent = {
        index,
        programId: instruction.programId.toString(),
        type: 'parsed' in instruction ? instruction.program : 'unknown',
        accounts: (instruction as any).accounts?.map((acc: any) =>
          typeof acc === 'string' ? acc : acc.toString()
        ) || [],
      };

      if ('parsed' in instruction && instruction.parsed) {
        instructionEvent.parsed = instruction.parsed;
        instructionEvent.type = instruction.program || 'unknown';
      }

      if ('data' in instruction && instruction.data) {
        instructionEvent.raw = instruction.data;
      }

      return instructionEvent;
    });
  }

  /**
   * Determine event type based on instructions and accounts
   */
  private static determineEventType(
    instructions: InstructionEvent[],
    accountKeys: any[],
    feePayerAddress: string
  ): {
    type: EventType;
    subType?: string;
    from: string;
    to?: string;
    amount?: string;
    mint?: string;
    programId: string;
  } {
    const primaryInstruction = instructions[0];
    const programId = primaryInstruction?.programId || 'unknown';

    let type = EventType.UNKNOWN;
    let subType: string | undefined;
    let from = feePayerAddress;
    let to: string | undefined;
    let amount: string | undefined;
    let mint: string | undefined;

    if (!primaryInstruction || !primaryInstruction.parsed) {
      return { type, from, programId };
    }

    const parsed = primaryInstruction.parsed;
    const program = primaryInstruction.type;

    // System Program - SOL transfers
    if (program === 'system') {
      if (parsed.type === 'transfer') {
        type = EventType.TRANSFER;
        from = (parsed.source as any)?.toString() || from;
        to = (parsed.destination as any)?.toString();
        amount = (parsed.lamports as any)?.toString();
      }
    }

    // Token Program - Token transfers
    else if (program === 'spl-token' || programId.includes('TokenzQdBNbLqP')) {
      if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
        type = EventType.TOKEN_TRANSFER;
        from = (parsed.source as any)?.toString() || from;
        to = (parsed.destination as any)?.toString();
        amount = (parsed.tokenAmount?.amount as any)?.toString() ||
          (parsed.amount as any)?.toString();
        mint = (parsed.mint as any)?.toString();
      } else if (parsed.type === 'mintTo') {
        type = EventType.TOKEN_MINT;
        mint = (parsed.mint as any)?.toString();
        amount = (parsed.tokenAmount?.amount as any)?.toString() ||
          (parsed.amount as any)?.toString();
      } else if (parsed.type === 'burn') {
        type = EventType.TOKEN_BURN;
        mint = (parsed.mint as any)?.toString();
        amount = (parsed.tokenAmount?.amount as any)?.toString() ||
          (parsed.amount as any)?.toString();
      }
    }

    // Metadata Program - NFT operations
    else if (programId.includes('metaqbxxU8xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')) {
      if (parsed.type === 'createMetadata' || parsed.type === 'updateMetadata') {
        type = EventType.NFT_MINT;
      } else if (parsed.type === 'burnNFT') {
        type = EventType.NFT_BURN;
      }
    }

    // Stake Program
    else if (program === 'stake') {
      if (parsed.type === 'delegate') {
        type = EventType.STAKE;
      } else if (parsed.type === 'deactivate') {
        type = EventType.UNSTAKE;
      }
    }

    // Vote Program
    else if (program === 'vote') {
      type = EventType.VOTE;
    }

    // Default to program interaction
    else if (program && program !== 'unknown') {
      type = EventType.PROGRAM_INTERACTION;
      subType = program;
    }

    return {
      type,
      subType,
      from,
      to,
      amount,
      mint,
      programId,
    };
  }

  /**
   * Enrich normalized event with additional metadata
   */
  static enrichEvent(
    event: NormalizedEvent,
    enrichmentData?: Record<string, unknown>
  ): NormalizedEvent {
    return {
      ...event,
      metadata: {
        ...event.metadata,
        ...enrichmentData,
      },
    };
  }

  /**
   * Filter events by type
   */
  static filterByType(events: NormalizedEvent[], type: EventType): NormalizedEvent[] {
    return events.filter((event) => event.type === type);
  }

  /**
   * Filter events by address (as sender or receiver)
   */
  static filterByAddress(events: NormalizedEvent[], address: string): NormalizedEvent[] {
    return events.filter(
      (event) => event.from === address || event.to === address || event.feePayerAddress === address
    );
  }

  /**
   * Sort events by timestamp
   */
  static sortByTimestamp(
    events: NormalizedEvent[],
    ascending: boolean = true
  ): NormalizedEvent[] {
    return [...events].sort((a, b) =>
      ascending ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    );
  }

  /**
   * Get event summary
   */
  static getSummary(event: NormalizedEvent): {
    summary: string;
    details: Record<string, unknown>;
  } {
    const summary = `${event.type}${event.subType ? ` (${event.subType})` : ''}: ${event.from} ${event.to ? `→ ${event.to}` : ''}${event.amount ? ` (${event.amount})` : ''}`;

    const details = {
      signature: event.signature,
      type: event.type,
      status: event.status,
      timestamp: new Date(event.timestamp).toISOString(),
      fee: `${event.fee} lamports`,
      programId: event.programId,
    };

    return { summary, details };
  }
}

export default EventNormalizer;
