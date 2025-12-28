import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

/**
 * Interface for WebSocket client metadata
 */
interface ClientMetadata {
  id: string;
  joinedAt: Date;
  lastMessageAt?: Date;
  tags?: Set<string>;
}

/**
 * Interface for queued broadcast events
 */
interface QueuedBroadcast {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  targetClients?: Set<string>;
  retryCount: number;
  maxRetries: number;
}

/**
 * EventBroadcaster - Manages WebSocket client connections and event broadcasting
 * with message queue functionality for reliable event delivery
 */
export class EventBroadcaster extends EventEmitter {
  private clients: Map<string, { ws: WebSocket; metadata: ClientMetadata }> = new Map();
  private messageQueue: Map<string, QueuedBroadcast> = new Map();
  private maxQueueSize: number;
  private maxRetries: number;
  private queueProcessingInterval: NodeJS.Timer | null = null;

  constructor(options: {
    maxQueueSize?: number;
    maxRetries?: number;
  } = {}) {
    super();
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Register a new WebSocket client connection
   */
  registerClient(id: string, ws: WebSocket, tags?: string[]): void {
    const metadata: ClientMetadata = {
      id,
      joinedAt: new Date(),
      tags: tags ? new Set(tags) : new Set(),
    };

    this.clients.set(id, { ws, metadata });
    this.emit('client:connected', { clientId: id, metadata });
  }

  /**
   * Unregister a WebSocket client connection
   */
  unregisterClient(id: string): boolean {
    const client = this.clients.get(id);
    if (!client) return false;

    this.clients.delete(id);
    this.emit('client:disconnected', { clientId: id });
    return true;
  }

  /**
   * Get a specific client by ID
   */
  getClient(id: string): WebSocket | null {
    return this.clients.get(id)?.ws || null;
  }

  /**
   * Get all registered client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get the total number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Add a tag to a client for targeting purposes
   */
  addClientTag(clientId: string, tag: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.metadata.tags?.add(tag);
    return true;
  }

  /**
   * Remove a tag from a client
   */
  removeClientTag(clientId: string, tag: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    return client.metadata.tags?.delete(tag) || false;
  }

  /**
   * Get all clients with a specific tag
   */
  getClientsByTag(tag: string): string[] {
    const matchingClients: string[] = [];
    this.clients.forEach((client, clientId) => {
      if (client.metadata.tags?.has(tag)) {
        matchingClients.push(clientId);
      }
    });
    return matchingClients;
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(type: string, data: any): string {
    const broadcastId = this.generateId();
    const targetClients = new Set(this.getClientIds());

    const queued = this.addToQueue({
      id: broadcastId,
      type,
      data,
      targetClients,
      retryCount: 0,
      maxRetries: this.maxRetries,
    } as QueuedBroadcast);

    if (!queued) {
      this.emit('broadcast:queue-full', { broadcastId, type });
    }

    return broadcastId;
  }

  /**
   * Broadcast a message to specific clients by IDs
   */
  broadcastToClients(clientIds: string[], type: string, data: any): string {
    const broadcastId = this.generateId();
    const targetClients = new Set(clientIds.filter(id => this.clients.has(id)));

    if (targetClients.size === 0) {
      this.emit('broadcast:no-targets', { broadcastId, type });
      return broadcastId;
    }

    const queued = this.addToQueue({
      id: broadcastId,
      type,
      data,
      targetClients,
      retryCount: 0,
      maxRetries: this.maxRetries,
    } as QueuedBroadcast);

    if (!queued) {
      this.emit('broadcast:queue-full', { broadcastId, type });
    }

    return broadcastId;
  }

  /**
   * Broadcast a message to all clients with a specific tag
   */
  broadcastToTag(tag: string, type: string, data: any): string {
    const clientIds = this.getClientsByTag(tag);
    return this.broadcastToClients(clientIds, type, data);
  }

  /**
   * Send a message directly to a specific client (bypassing queue)
   */
  sendToClient(clientId: string, type: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        client.metadata.lastMessageAt = new Date();
        this.emit('message:sent', { clientId, type });
        return true;
      }
      return false;
    } catch (error) {
      this.emit('message:error', { clientId, type, error });
      return false;
    }
  }

  /**
   * Start processing the message queue
   */
  startQueueProcessing(intervalMs: number = 100): void {
    if (this.queueProcessingInterval) return;

    this.queueProcessingInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);

    this.emit('queue:processing-started');
  }

  /**
   * Stop processing the message queue
   */
  stopQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
      this.emit('queue:processing-stopped');
    }
  }

  /**
   * Process queued broadcasts
   */
  private processQueue(): void {
    const failedBroadcasts: string[] = [];

    this.messageQueue.forEach((broadcast, broadcastId) => {
      let sentCount = 0;
      let failedCount = 0;

      broadcast.targetClients?.forEach(clientId => {
        const success = this.sendToClient(clientId, broadcast.type, broadcast.data);
        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }
      });

      if (failedCount > 0) {
        broadcast.retryCount++;
        if (broadcast.retryCount >= broadcast.maxRetries) {
          failedBroadcasts.push(broadcastId);
          this.emit('broadcast:max-retries-exceeded', {
            broadcastId,
            type: broadcast.type,
            failedCount,
          });
        }
      } else {
        // All messages sent successfully
        this.messageQueue.delete(broadcastId);
        this.emit('broadcast:completed', {
          broadcastId,
          type: broadcast.type,
          sentCount,
        });
      }
    });

    // Remove failed broadcasts after max retries
    failedBroadcasts.forEach(broadcastId => {
      this.messageQueue.delete(broadcastId);
    });
  }

  /**
   * Add a broadcast to the message queue
   */
  private addToQueue(broadcast: QueuedBroadcast): boolean {
    if (this.messageQueue.size >= this.maxQueueSize) {
      return false;
    }

    this.messageQueue.set(broadcast.id, broadcast);
    this.emit('broadcast:queued', {
      broadcastId: broadcast.id,
      type: broadcast.type,
      targetCount: broadcast.targetClients?.size || 0,
    });

    return true;
  }

  /**
   * Get the current queue size
   */
  getQueueSize(): number {
    return this.messageQueue.size;
  }

  /**
   * Get detailed queue statistics
   */
  getQueueStats(): {
    size: number;
    maxSize: number;
    broadcasts: Array<{ id: string; type: string; retryCount: number; targetCount: number }>;
  } {
    const broadcasts = Array.from(this.messageQueue.values()).map(b => ({
      id: b.id,
      type: b.type,
      retryCount: b.retryCount,
      targetCount: b.targetClients?.size || 0,
    }));

    return {
      size: this.messageQueue.size,
      maxSize: this.maxQueueSize,
      broadcasts,
    };
  }

  /**
   * Clear all queued broadcasts
   */
  clearQueue(): void {
    const clearedCount = this.messageQueue.size;
    this.messageQueue.clear();
    this.emit('queue:cleared', { clearedCount });
  }

  /**
   * Get statistics about all connected clients
   */
  getClientStats(): {
    total: number;
    byTag: Record<string, number>;
    details: Array<{
      id: string;
      joinedAt: Date;
      lastMessageAt?: Date;
      tags: string[];
      connectionState: string;
    }>;
  } {
    const byTag: Record<string, number> = {};
    const details: any[] = [];

    this.clients.forEach((client, clientId) => {
      const tags = Array.from(client.metadata.tags || []);
      tags.forEach(tag => {
        byTag[tag] = (byTag[tag] || 0) + 1;
      });

      details.push({
        id: clientId,
        joinedAt: client.metadata.joinedAt,
        lastMessageAt: client.metadata.lastMessageAt,
        tags,
        connectionState: client.ws.readyState === WebSocket.OPEN ? 'open' : 'closed',
      });
    });

    return {
      total: this.clients.size,
      byTag,
      details,
    };
  }

  /**
   * Close all client connections gracefully
   */
  closeAll(code: number = 1000, reason: string = 'Server shutdown'): void {
    this.clients.forEach((client, clientId) => {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(code, reason);
        }
      } catch (error) {
        this.emit('client:close-error', { clientId, error });
      }
    });

    this.stopQueueProcessing();
    this.clients.clear();
    this.emit('broadcaster:closed');
  }

  /**
   * Generate a unique ID for broadcasts
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default EventBroadcaster;
