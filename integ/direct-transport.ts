import { v4 as uuidv4 } from 'uuid';

import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * A transport that directly connects client and server in the same process.
 * Messages sent from one end are immediately delivered to the other end.
 *
 * This is meant for simplify the unit test.
 */
export class DirectTransport implements Transport {
  private otherEnd: DirectTransport | null = null;
  private isStarted = false;
  private isClosed = false;
  readonly sessionId: string;

  // Callbacks
  onmessage?: (message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }) => void;
  onerror?: (error: Error) => void;

  constructor() {
    this.sessionId = uuidv4();
  }

  /**
   * Connect this transport to another transport instance.
   * Messages sent to this transport will be forwarded to the other transport and vice versa.
   */
  connect(otherEnd: DirectTransport): void {
    this.otherEnd = otherEnd;
    otherEnd.otherEnd = this;
  }

  /**
   * Start the transport.
   */
  async start(): Promise<void> {
    if (!this.otherEnd) {
      throw new Error('DirectTransport must be connected to another DirectTransport before starting');
    }
    this.isStarted = true;
  }

  /**
   * Send a message through the transport.
   * The message will be immediately delivered to the other end.
   */
  async send(message: JSONRPCMessage, _?: TransportSendOptions): Promise<void> {
    if (!this.isStarted) {
      throw new Error('DirectTransport not started');
    }
    if (this.isClosed) {
      throw new Error('DirectTransport closed');
    }
    if (!this.otherEnd) {
      throw new Error('DirectTransport not connected to another DirectTransport');
    }

    // Forward the message to the other end's onmessage handler
    if (this.otherEnd.onmessage) {
      this.otherEnd.onmessage(message);
    }
  }

  /**
   * Close the transport.
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return; // Do nothing if it's closed already.
    }

    // Notify the other end that we're closing
    if (this.otherEnd && !this.otherEnd.isClosed) {
      this.otherEnd.isClosed = true;
    }

    this.isClosed = true;
  }
}

/**
 * Create a pair of connected DirectTransport instances.
 * @returns A tuple of two connected DirectTransport instances
 */
export function createDirectTransportPair(): [Transport, Transport] {
  const clientTransport = new DirectTransport();
  const serverTransport = new DirectTransport();

  clientTransport.connect(serverTransport);

  return [clientTransport, serverTransport];
}
