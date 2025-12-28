/**
 * Risk Engine for evaluating Solana event risk scores
 * Analyzes transaction events and provides risk assessment with recommendations
 */

/**
 * Enum representing risk severity levels
 */
export enum RiskLevel {
  MINIMAL = 'MINIMAL',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Interface representing a single risk factor
 */
export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

/**
 * Interface representing the complete risk score assessment
 */
export interface RiskScore {
  score: number; // 0.0-1.0
  level: RiskLevel;
  factors: RiskFactor[];
  timestamp: string;
}

/**
 * Interface for event data input to risk evaluation
 */
export interface EventData {
  signature: string;
  timestamp: number;
  amount?: number;
  programId?: string;
  eventType: string;
  sender?: string;
  receiver?: string;
  [key: string]: unknown;
}

/**
 * RiskEngine class for evaluating Solana event risk scores
 */
export class RiskEngine {
  private readonly MAX_SAFE_AMOUNT = 1000000000; // 1 billion lamports (10 SOL)
  private readonly SUSPICIOUS_PROGRAMS: Set<string> = new Set([
    // Known risky program IDs can be added here
  ]);

  constructor() {
    // Initialize risk engine
  }

  /**
   * Main method to evaluate event risk
   * @param eventData - The Solana event data to evaluate
   * @returns RiskScore with score, level, and contributing factors
   */
  public evaluateEvent(eventData: EventData): RiskScore {
    const factors: RiskFactor[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Evaluate amount risk
    const amountFactor = this.evaluateAmount(eventData.amount ?? 0);
    if (amountFactor) {
      factors.push(amountFactor);
      totalWeightedScore += amountFactor.value * amountFactor.weight;
      totalWeight += amountFactor.weight;
    }

    // Evaluate program risk
    const programFactor = this.evaluateProgram(eventData.programId ?? '');
    if (programFactor) {
      factors.push(programFactor);
      totalWeightedScore += programFactor.value * programFactor.weight;
      totalWeight += programFactor.weight;
    }

    // Evaluate event type risk
    const eventTypeFactor = this.evaluateEventType(eventData.eventType);
    if (eventTypeFactor) {
      factors.push(eventTypeFactor);
      totalWeightedScore += eventTypeFactor.value * eventTypeFactor.weight;
      totalWeight += eventTypeFactor.weight;
    }

    // Calculate final score
    const score = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const normalizedScore = Math.min(Math.max(score, 0), 1);

    // Determine risk level
    const level = this.scoreToLevel(normalizedScore);

    // Get timestamp
    const timestamp = new Date().toISOString();

    return {
      score: normalizedScore,
      level,
      factors,
      timestamp,
    };
  }

  /**
   * Private method to evaluate amount-based risk
   * @param amount - Transaction amount in lamports
   * @returns RiskFactor or null if amount is not provided
   */
  private evaluateAmount(amount: number): RiskFactor | null {
    if (amount === undefined || amount === null) {
      return null;
    }

    let value = 0;

    if (amount === 0) {
      value = 0.1; // Suspicious: zero amount
    } else if (amount > this.MAX_SAFE_AMOUNT) {
      value = 0.8; // High risk: large amount
    } else if (amount > this.MAX_SAFE_AMOUNT * 0.5) {
      value = 0.5; // Medium risk: moderate-large amount
    } else {
      value = 0.1; // Low risk: normal amount
    }

    return {
      name: 'Amount Risk',
      weight: 0.3,
      value,
      description: `Transaction amount of ${amount} lamports evaluated for risk`,
    };
  }

  /**
   * Private method to evaluate program-based risk
   * @param programId - The Solana program ID
   * @returns RiskFactor or null if programId is not provided
   */
  private evaluateProgram(programId: string): RiskFactor | null {
    if (!programId) {
      return null;
    }

    let value = 0;

    // Check against suspicious programs list
    if (this.SUSPICIOUS_PROGRAMS.has(programId)) {
      value = 0.9; // Critical risk: known suspicious program
    } else if (programId.toLowerCase() === 'unknown') {
      value = 0.7; // High risk: unknown program
    } else {
      value = 0.2; // Low risk: known program
    }

    return {
      name: 'Program Risk',
      weight: 0.35,
      value,
      description: `Program ${programId} evaluated for risk`,
    };
  }

  /**
   * Private method to evaluate event type-based risk
   * @param eventType - The type of Solana event
   * @returns RiskFactor
   */
  private evaluateEventType(eventType: string): RiskFactor {
    let value = 0;

    switch (eventType.toLowerCase()) {
      case 'transfer':
        value = 0.2; // Low risk
        break;
      case 'swap':
        value = 0.3; // Low-medium risk
        break;
      case 'liquidation':
        value = 0.6; // Medium-high risk
        break;
      case 'flash_loan':
        value = 0.8; // High risk
        break;
      case 'unknown':
        value = 0.5; // Medium risk
        break;
      default:
        value = 0.3; // Default to low-medium risk
    }

    return {
      name: 'Event Type Risk',
      weight: 0.35,
      value,
      description: `Event type '${eventType}' evaluated for risk`,
    };
  }

  /**
   * Private method to convert numerical score to risk level
   * @param score - Numerical risk score (0.0-1.0)
   * @returns RiskLevel
   */
  private scoreToLevel(score: number): RiskLevel {
    if (score < 0.2) {
      return RiskLevel.MINIMAL;
    } else if (score < 0.4) {
      return RiskLevel.LOW;
    } else if (score < 0.6) {
      return RiskLevel.MEDIUM;
    } else if (score < 0.8) {
      return RiskLevel.HIGH;
    } else {
      return RiskLevel.CRITICAL;
    }
  }

  /**
   * Private method to get recommendation based on risk level
   * @param level - Risk level
   * @returns Recommendation string
   */
  private getRecommendation(level: RiskLevel): string {
    switch (level) {
      case RiskLevel.MINIMAL:
        return 'Event appears safe to process';
      case RiskLevel.LOW:
        return 'Event is generally safe with minimal concerns';
      case RiskLevel.MEDIUM:
        return 'Event should be reviewed; consider additional verification';
      case RiskLevel.HIGH:
        return 'Event presents significant risk; recommend blocking or further investigation';
      case RiskLevel.CRITICAL:
        return 'Event poses critical risk; recommend immediate blocking';
      default:
        return 'Unable to determine recommendation';
    }
  }
}

export default RiskEngine;
