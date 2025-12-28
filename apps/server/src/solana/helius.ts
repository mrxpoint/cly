import { EventEmitter } from 'events';

/**
 * Helius API Configuration
 */
export interface HeliusConfig {
  apiKey: string;
  rpcUrl?: string;
  wsUrl?: string;
  network: 'mainnet-beta' | 'testnet' | 'devnet';
}

/**
 * Solana RPC Methods
 */
export enum SolanaRpcMethod {
  GET_LATEST_BLOCKHASH = 'getLatestBlockhash',
  GET_BLOCK = 'getBlock',
  GET_TRANSACTION = 'getTransaction',
  GET_ACCOUNT_INFO = 'getAccountInfo',
  GET_PROGRAM_ACCOUNTS = 'getProgramAccounts',
  GET_TOKEN_ACCOUNTS_BY_OWNER = 'getTokenAccountsByOwner',
  GET_TOKEN_SUPPLY = 'getTokenSupply',
  GET_TOKEN_LARGEST_ACCOUNTS = 'getTokenLargestAccounts',
  SIMULATE_TRANSACTION = 'simulateTransaction',
  SEND_TRANSACTION = 'sendTransaction',
  GET_SIGNATURE_STATUS = 'getSignatureStatuses',
  GET_SIGNATURES_FOR_ADDRESS = 'getSignaturesForAddress',
}

/**
 * Helius Client for Solana RPC interactions
 * Provides methods for querying on-chain data and managing subscriptions
 */
export class HeliusClient extends EventEmitter {
  private apiKey: string;
  private rpcUrl: string;
  private wsUrl: string;
  private network: string;
  private requestId: number = 0;

  constructor(config: HeliusConfig) {
    super();
    this.apiKey = config.apiKey;
    this.network = config.network;

    // Default URLs based on network
    const baseUrl = this.getBaseUrl(config.network);
    this.rpcUrl = config.rpcUrl || `${baseUrl}?api-key=${this.apiKey}`;
    this.wsUrl = config.wsUrl || `wss://${this.getWsHost(config.network)}?api-key=${this.apiKey}`;
  }

  /**
   * Get base RPC URL for the specified network
   */
  private getBaseUrl(network: string): string {
    const baseUrls: Record<string, string> = {
      'mainnet-beta': 'https://mainnet.helius-rpc.com/',
      testnet: 'https://testnet.helius-rpc.com/',
      devnet: 'https://devnet.helius-rpc.com/',
    };
    return baseUrls[network] || baseUrls['mainnet-beta'];
  }

  /**
   * Get WebSocket host for the specified network
   */
  private getWsHost(network: string): string {
    const hosts: Record<string, string> = {
      'mainnet-beta': 'mainnet.helius-rpc.com',
      testnet: 'testnet.helius-rpc.com',
      devnet: 'devnet.helius-rpc.com',
    };
    return hosts[network] || hosts['mainnet-beta'];
  }

  /**
   * Get the RPC URL
   */
  getRpcUrl(): string {
    return this.rpcUrl;
  }

  /**
   * Get the WebSocket URL
   */
  getWsUrl(): string {
    return this.wsUrl;
  }

  /**
   * Get the network
   */
  getNetwork(): string {
    return this.network;
  }

  /**
   * Make a generic RPC call
   */
  async call<T = any>(method: string, params?: any[]): Promise<T> {
    const id = ++this.requestId;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || [],
    };

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }

      return data.result as T;
    } catch (error) {
      this.emit('rpc:error', { method, error });
      throw error;
    }
  }

  /**
   * Get the latest blockhash
   */
  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    return this.call(SolanaRpcMethod.GET_LATEST_BLOCKHASH);
  }

  /**
   * Get block information
   */
  async getBlock(slot: number): Promise<any> {
    return this.call(SolanaRpcMethod.GET_BLOCK, [slot]);
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature: string): Promise<any> {
    return this.call(SolanaRpcMethod.GET_TRANSACTION, [signature]);
  }

  /**
   * Get account information
   */
  async getAccountInfo(address: string): Promise<any> {
    return this.call(SolanaRpcMethod.GET_ACCOUNT_INFO, [address]);
  }

  /**
   * Get program accounts
   */
  async getProgramAccounts(programId: string, filters?: any[]): Promise<any[]> {
    return this.call(SolanaRpcMethod.GET_PROGRAM_ACCOUNTS, [
      programId,
      filters ? { filters } : {},
    ]);
  }

  /**
   * Get token accounts by owner
   */
  async getTokenAccountsByOwner(owner: string, mint?: string): Promise<any> {
    const params: any[] = [owner];
    if (mint) {
      params.push({ mint });
    } else {
      params.push({ programId: 'TokenkegQfeZyiNwAJsyFbPVwwQQftas5LArVVzG45kn' });
    }
    return this.call(SolanaRpcMethod.GET_TOKEN_ACCOUNTS_BY_OWNER, params);
  }

  /**
   * Get token supply
   */
  async getTokenSupply(mint: string): Promise<any> {
    return this.call(SolanaRpcMethod.GET_TOKEN_SUPPLY, [mint]);
  }

  /**
   * Get token largest accounts
   */
  async getTokenLargestAccounts(mint: string): Promise<any> {
    return this.call(SolanaRpcMethod.GET_TOKEN_LARGEST_ACCOUNTS, [mint]);
  }

  /**
   * Get signature statuses
   */
  async getSignatureStatuses(signatures: string[]): Promise<any> {
    return this.call(SolanaRpcMethod.GET_SIGNATURE_STATUS, [signatures]);
  }

  /**
   * Get signatures for address
   */
  async getSignaturesForAddress(address: string, limit?: number): Promise<any[]> {
    const params: any[] = [address];
    if (limit) {
      params.push({ limit });
    }
    return this.call(SolanaRpcMethod.GET_SIGNATURES_FOR_ADDRESS, params);
  }

  /**
   * Check if the RPC connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getLatestBlockhash();
      this.emit('health:ok');
      return true;
    } catch (error) {
      this.emit('health:error', error);
      return false;
    }
  }
}

export default HeliusClient;
