/**
 * WebSocket Manager - Direct browser-to-exchange connections
 * 
 * This client connects DIRECTLY from the browser to exchange WebSockets.
 * No proxying through the backend for real-time data.
 */

import type { Exchange, Trade, Orderbook, OrderbookLevel } from '../types';

// WebSocket URLs - Public endpoints
const WS_URLS: Partial<Record<Exchange, string>> = {
    binance: 'wss://fstream.binance.com/ws',
    bybit: 'wss://stream.bybit.com/v5/public/linear',
    okx: 'wss://ws.okx.com:8443/ws/v5/public',
    gateio: 'wss://api.gateio.ws/ws/v4/',
};

// Exchanges with WebSocket support
const WS_SUPPORTED_EXCHANGES: Exchange[] = ['binance', 'bybit', 'okx', 'gateio'];

// Connection state
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface WSSubscription {
    channel: string;
    callback: (data: unknown) => void;
}

interface ExchangeConnection {
    ws: WebSocket | null;
    state: ConnectionState;
    subscriptions: Map<string, WSSubscription>;
    reconnectAttempts: number;
    pingInterval: NodeJS.Timeout | null;
}

class WebSocketManager {
    private connections: Map<Exchange, ExchangeConnection> = new Map();
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000;
    private listeners: Map<string, Set<(state: ConnectionState) => void>> = new Map();

    constructor() {
        // Initialize connection state for each supported exchange
        WS_SUPPORTED_EXCHANGES.forEach((exchange) => {
            this.connections.set(exchange, {
                ws: null,
                state: 'disconnected',
                subscriptions: new Map(),
                reconnectAttempts: 0,
                pingInterval: null,
            });
        });
    }


    /**
     * Connect to an exchange WebSocket
     */
    connect(exchange: Exchange): void {
        const conn = this.connections.get(exchange);
        if (!conn || conn.state === 'connected' || conn.state === 'connecting') return;

        this.updateState(exchange, 'connecting');

        try {
            const wsUrl = WS_URLS[exchange];
            if (!wsUrl) {
                console.error(`[WS] No WebSocket URL configured for ${exchange}`);
                this.updateState(exchange, 'disconnected');
                return;
            }
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log(`[WS] ${exchange} connected`);
                conn.reconnectAttempts = 0;
                this.updateState(exchange, 'connected');

                // Resubscribe to any existing subscriptions
                conn.subscriptions.forEach((sub, key) => {
                    this.sendSubscription(exchange, sub.channel, true);
                });

                // Start ping interval for Bybit
                if (exchange === 'bybit') {
                    conn.pingInterval = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ op: 'ping' }));
                        }
                    }, 20000);
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(exchange, data);
                } catch (e) {
                    console.error(`[WS] ${exchange} parse error:`, e);
                }
            };

            ws.onerror = (error) => {
                console.error(`[WS] ${exchange} error:`, error);
            };

            ws.onclose = () => {
                console.log(`[WS] ${exchange} disconnected`);
                this.updateState(exchange, 'disconnected');

                if (conn.pingInterval) {
                    clearInterval(conn.pingInterval);
                    conn.pingInterval = null;
                }

                // Auto-reconnect if we have subscriptions
                if (conn.subscriptions.size > 0 && conn.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnect(exchange);
                }
            };

            conn.ws = ws;
        } catch (error) {
            console.error(`[WS] ${exchange} connection error:`, error);
            this.updateState(exchange, 'disconnected');
        }
    }

    /**
     * Reconnect with exponential backoff
     */
    private reconnect(exchange: Exchange): void {
        const conn = this.connections.get(exchange);
        if (!conn) return;

        conn.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, conn.reconnectAttempts - 1), 30000);

        console.log(`[WS] ${exchange} reconnecting in ${delay}ms (attempt ${conn.reconnectAttempts})`);
        this.updateState(exchange, 'reconnecting');

        setTimeout(() => {
            this.connect(exchange);
        }, delay);
    }

    /**
     * Disconnect from an exchange
     */
    disconnect(exchange: Exchange): void {
        const conn = this.connections.get(exchange);
        if (!conn || !conn.ws) return;

        conn.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
        conn.ws.close();
        conn.ws = null;
        conn.subscriptions.clear();

        if (conn.pingInterval) {
            clearInterval(conn.pingInterval);
            conn.pingInterval = null;
        }
    }

    /**
     * Subscribe to a channel
     */
    subscribe(
        exchange: Exchange,
        channel: string,
        callback: (data: unknown) => void
    ): () => void {
        const conn = this.connections.get(exchange);
        if (!conn) return () => { };

        const key = `${exchange}:${channel}`;
        conn.subscriptions.set(key, { channel, callback });

        // Connect if not already connected
        if (conn.state === 'disconnected') {
            this.connect(exchange);
        } else if (conn.state === 'connected') {
            this.sendSubscription(exchange, channel, true);
        }

        // Return unsubscribe function
        return () => {
            conn.subscriptions.delete(key);
            if (conn.state === 'connected') {
                this.sendSubscription(exchange, channel, false);
            }
        };
    }

    /**
     * Send subscription message to exchange
     */
    private sendSubscription(exchange: Exchange, channel: string, subscribe: boolean): void {
        const conn = this.connections.get(exchange);
        if (!conn?.ws || conn.ws.readyState !== WebSocket.OPEN) return;

        let message: string;

        switch (exchange) {
            case 'binance':
                message = JSON.stringify({
                    method: subscribe ? 'SUBSCRIBE' : 'UNSUBSCRIBE',
                    params: [channel],
                    id: Date.now(),
                });
                break;

            case 'bybit':
                message = JSON.stringify({
                    op: subscribe ? 'subscribe' : 'unsubscribe',
                    args: [channel],
                });
                break;

            case 'gateio':
                message = JSON.stringify({
                    time: Math.floor(Date.now() / 1000),
                    channel,
                    event: subscribe ? 'subscribe' : 'unsubscribe',
                });
                break;
            case 'okx':
                message = JSON.stringify({
                    op: subscribe ? 'subscribe' : 'unsubscribe',
                    args: [{ channel: channel.split('.')[0], instId: channel.split('.')[1] || '' }],
                });
                break;

            default:
                message = JSON.stringify({
                    op: subscribe ? 'subscribe' : 'unsubscribe',
                    args: [channel],
                });
        }

        conn.ws.send(message);
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(exchange: Exchange, data: unknown): void {
        const conn = this.connections.get(exchange);
        if (!conn) return;

        // Route message to appropriate subscribers
        conn.subscriptions.forEach((sub) => {
            if (this.messageMatchesChannel(exchange, data, sub.channel)) {
                sub.callback(data);
            }
        });
    }

    /**
     * Check if message matches a subscription channel
     */
    private messageMatchesChannel(exchange: Exchange, data: unknown, channel: string): boolean {
        const msg = data as Record<string, unknown>;

        switch (exchange) {
            case 'binance':
                return msg.s === channel.split('@')[0]?.toUpperCase() ||
                    msg.stream === channel;

            case 'bybit':
                return (msg.topic as string)?.includes(channel.split('.')[1] || '');

            case 'gateio':
                return msg.channel === channel;

            default:
                return false;
        }
    }

    /**
     * Update connection state and notify listeners
     */
    private updateState(exchange: Exchange, state: ConnectionState): void {
        const conn = this.connections.get(exchange);
        if (!conn) return;

        conn.state = state;

        const listeners = this.listeners.get(exchange);
        listeners?.forEach((callback) => callback(state));
    }

    /**
     * Get current connection state
     */
    getState(exchange: Exchange): ConnectionState {
        return this.connections.get(exchange)?.state || 'disconnected';
    }

    /**
     * Subscribe to connection state changes
     */
    onStateChange(exchange: Exchange, callback: (state: ConnectionState) => void): () => void {
        if (!this.listeners.has(exchange)) {
            this.listeners.set(exchange, new Set());
        }
        this.listeners.get(exchange)!.add(callback);

        return () => {
            this.listeners.get(exchange)?.delete(callback);
        };
    }
}

// Singleton instance
export const wsManager = new WebSocketManager();

/**
 * Helper: Subscribe to Binance trade stream
 */
export function subscribeBinanceTrades(
    symbol: string,
    callback: (trade: Trade) => void
): () => void {
    const channel = `${symbol.toLowerCase().replace('-', '')}@aggTrade`;

    return wsManager.subscribe('binance', channel, (data) => {
        const msg = data as Record<string, unknown>;
        callback({
            exchange: 'binance',
            marketType: 'perpetual',
            symbol,
            id: String(msg.a),
            price: parseFloat(msg.p as string),
            size: parseFloat(msg.q as string),
            side: msg.m ? 'sell' : 'buy',
            timestamp: msg.T as number,
        });
    });
}

/**
 * Helper: Subscribe to Binance orderbook updates
 */
export function subscribeBinanceOrderbook(
    symbol: string,
    callback: (update: { bids: OrderbookLevel[]; asks: OrderbookLevel[] }) => void
): () => void {
    const channel = `${symbol.toLowerCase().replace('-', '')}@depth20@100ms`;

    return wsManager.subscribe('binance', channel, (data) => {
        const msg = data as { b: string[][]; a: string[][] };

        let bidTotal = 0;
        let askTotal = 0;

        const bids = (msg.b || []).map(([price, size]) => {
            bidTotal += parseFloat(size);
            return { price: parseFloat(price), size: parseFloat(size), total: bidTotal };
        });

        const asks = (msg.a || []).map(([price, size]) => {
            askTotal += parseFloat(size);
            return { price: parseFloat(price), size: parseFloat(size), total: askTotal };
        });

        callback({ bids, asks });
    });
}

/**
 * Helper: Subscribe to Bybit trade stream
 */
export function subscribeBybitTrades(
    symbol: string,
    callback: (trade: Trade) => void
): () => void {
    const formatted = symbol.replace('-', '').toUpperCase();
    const channel = `publicTrade.${formatted}`;

    return wsManager.subscribe('bybit', channel, (data) => {
        const msg = data as { data: Array<Record<string, unknown>> };
        (msg.data || []).forEach((t) => {
            callback({
                exchange: 'bybit',
                marketType: 'perpetual',
                symbol,
                id: String(t.i),
                price: parseFloat(t.p as string),
                size: parseFloat(t.v as string),
                side: (t.S as string).toLowerCase() as 'buy' | 'sell',
                timestamp: t.T as number,
            });
        });
    });
}

/**
 * Helper: Subscribe to Bybit orderbook
 */
export function subscribeBybitOrderbook(
    symbol: string,
    callback: (update: { bids: OrderbookLevel[]; asks: OrderbookLevel[] }) => void
): () => void {
    const formatted = symbol.replace('-', '').toUpperCase();
    const channel = `orderbook.25.${formatted}`;

    return wsManager.subscribe('bybit', channel, (data) => {
        const msg = data as { data: { b: string[][]; a: string[][] } };

        let bidTotal = 0;
        let askTotal = 0;

        const bids = (msg.data?.b || []).map(([price, size]) => {
            bidTotal += parseFloat(size);
            return { price: parseFloat(price), size: parseFloat(size), total: bidTotal };
        });

        const asks = (msg.data?.a || []).map(([price, size]) => {
            askTotal += parseFloat(size);
            return { price: parseFloat(price), size: parseFloat(size), total: askTotal };
        });

        callback({ bids, asks });
    });
}

// ============================================
// NEW STREAMS FOR OPERATIONAL DATA
// ============================================

/**
 * Funding Rate Update from WebSocket
 */
export interface FundingUpdate {
    exchange: Exchange;
    symbol: string;
    fundingRate: number;
    nextFundingTime: number;
    markPrice: number;
    indexPrice: number;
    timestamp: number;
}

/**
 * Liquidation Event from WebSocket
 */
export interface LiquidationEvent {
    exchange: Exchange;
    symbol: string;
    side: 'long' | 'short';
    price: number;
    quantity: number;
    value: number;
    timestamp: number;
}

/**
 * Mark Price Update from WebSocket
 */
export interface MarkPriceUpdate {
    exchange: Exchange;
    symbol: string;
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    nextFundingTime: number;
    timestamp: number;
}

/**
 * Helper: Subscribe to Binance mark price stream (includes funding rate)
 * This is the most efficient way to get real-time funding updates
 */
export function subscribeBinanceMarkPrice(
    symbol: string,
    callback: (update: MarkPriceUpdate) => void
): () => void {
    const formatted = symbol.toLowerCase().replace('-', '');
    const channel = `${formatted}@markPrice@1s`;

    return wsManager.subscribe('binance', channel, (data) => {
        const msg = data as {
            s: string;
            p: string;      // Mark price
            i: string;      // Index price  
            r: string;      // Funding rate
            T: number;      // Next funding time
            E: number;      // Event time
        };

        callback({
            exchange: 'binance',
            symbol: msg.s,
            markPrice: parseFloat(msg.p),
            indexPrice: parseFloat(msg.i),
            fundingRate: parseFloat(msg.r),
            nextFundingTime: msg.T,
            timestamp: msg.E,
        });
    });
}

/**
 * Helper: Subscribe to ALL Binance mark prices (efficient for multiple symbols)
 */
export function subscribeBinanceAllMarkPrices(
    callback: (update: MarkPriceUpdate) => void
): () => void {
    const channel = '!markPrice@arr@1s';

    return wsManager.subscribe('binance', channel, (data) => {
        const updates = data as Array<{
            s: string;
            p: string;
            i: string;
            r: string;
            T: number;
            E: number;
        }>;

        updates.forEach(msg => {
            callback({
                exchange: 'binance',
                symbol: msg.s,
                markPrice: parseFloat(msg.p),
                indexPrice: parseFloat(msg.i),
                fundingRate: parseFloat(msg.r),
                nextFundingTime: msg.T,
                timestamp: msg.E,
            });
        });
    });
}

/**
 * Helper: Subscribe to Binance liquidation orders (forceOrder stream)
 * CRITICAL for squeeze detection
 */
export function subscribeBinanceLiquidations(
    callback: (liq: LiquidationEvent) => void,
    symbol?: string  // Optional: filter by symbol, or get all
): () => void {
    // Use specific symbol or all liquidations
    const channel = symbol
        ? `${symbol.toLowerCase().replace('-', '')}@forceOrder`
        : '!forceOrder@arr';

    return wsManager.subscribe('binance', channel, (data) => {
        // Handle both single and array formats
        const orders = Array.isArray(data)
            ? data
            : [(data as { o: unknown }).o];

        orders.forEach((order: unknown) => {
            const o = order as {
                s: string;      // Symbol
                S: string;      // Side (BUY = short liquidated, SELL = long liquidated)
                p: string;      // Price
                q: string;      // Quantity
                T: number;      // Trade time
            };

            if (!o?.s) return;

            const price = parseFloat(o.p);
            const quantity = parseFloat(o.q);

            callback({
                exchange: 'binance',
                symbol: o.s,
                // BUY order = short getting liquidated, SELL = long getting liquidated
                side: o.S === 'SELL' ? 'long' : 'short',
                price,
                quantity,
                value: price * quantity,
                timestamp: o.T,
            });
        });
    });
}

/**
 * Helper: Subscribe to Bybit mark price / funding stream
 */
export function subscribeBybitMarkPrice(
    symbol: string,
    callback: (update: MarkPriceUpdate) => void
): () => void {
    const formatted = symbol.replace('-', '').toUpperCase();
    const channel = `tickers.${formatted}`;

    return wsManager.subscribe('bybit', channel, (data) => {
        const msg = data as {
            data: {
                symbol: string;
                markPrice: string;
                indexPrice: string;
                fundingRate: string;
                nextFundingTime: string;
            };
            ts: number;
        };

        if (!msg.data) return;

        callback({
            exchange: 'bybit',
            symbol: msg.data.symbol,
            markPrice: parseFloat(msg.data.markPrice),
            indexPrice: parseFloat(msg.data.indexPrice),
            fundingRate: parseFloat(msg.data.fundingRate),
            nextFundingTime: parseInt(msg.data.nextFundingTime),
            timestamp: msg.ts,
        });
    });
}

/**
 * Helper: Subscribe to Bybit liquidations
 */
export function subscribeBybitLiquidations(
    callback: (liq: LiquidationEvent) => void,
    symbol?: string
): () => void {
    const formatted = symbol?.replace('-', '').toUpperCase() || '';
    const channel = symbol ? `liquidation.${formatted}` : 'liquidation';

    return wsManager.subscribe('bybit', channel, (data) => {
        const msg = data as {
            data: {
                symbol: string;
                side: string;
                price: string;
                size: string;
                updatedTime: number;
            }
        };

        if (!msg.data) return;

        const price = parseFloat(msg.data.price);
        const size = parseFloat(msg.data.size);

        callback({
            exchange: 'bybit',
            symbol: msg.data.symbol,
            side: msg.data.side.toLowerCase() === 'sell' ? 'long' : 'short',
            price,
            quantity: size,
            value: price * size,
            timestamp: msg.data.updatedTime,
        });
    });
}

// ============================================
// REACT HOOKS FOR STREAMING DATA
// ============================================

/**
 * Combined stream subscription for all critical data
 * Useful for War Room / Dashboard that needs multiple streams
 */
export interface CriticalStreams {
    markPrices: Map<string, MarkPriceUpdate>;
    liquidations: LiquidationEvent[];
    trades: Trade[];
}

/**
 * Subscribe to all critical streams for a symbol
 * Returns unsubscribe function
 */
export function subscribeCriticalStreams(
    symbol: string,
    onMarkPrice: (update: MarkPriceUpdate) => void,
    onLiquidation: (liq: LiquidationEvent) => void,
    onTrade: (trade: Trade) => void
): () => void {
    const unsubs: (() => void)[] = [];

    // Binance streams
    unsubs.push(subscribeBinanceMarkPrice(symbol, onMarkPrice));
    unsubs.push(subscribeBinanceLiquidations(onLiquidation, symbol));
    unsubs.push(subscribeBinanceTrades(symbol, onTrade));

    // Bybit streams
    unsubs.push(subscribeBybitMarkPrice(symbol, onMarkPrice));
    unsubs.push(subscribeBybitLiquidations(onLiquidation, symbol));
    unsubs.push(subscribeBybitTrades(symbol, onTrade));

    return () => unsubs.forEach(unsub => unsub());
}

export default wsManager;

