/**
 * NEXUS Terminal - Core Types
 * Pair-based architecture: exchange + marketType + symbol
 */

// ============================================
// EXCHANGES & MARKET TYPES
// ============================================

export type Exchange = 'binance' | 'bybit' | 'gateio' | 'okx' | 'kraken' | 'coinbase' | 'bitget' | 'kucoin' | 'deribit';
export type MarketType = 'spot' | 'perpetual';
export type UIMode = 'simple' | 'pro';

// ============================================
// INSTRUMENT - Core data model
// ============================================

export interface Instrument {
    // Identity
    exchange: Exchange;
    marketType: MarketType;
    symbol: string;           // e.g., "BTCUSDT"
    contractId: string | null; // For perpetuals (e.g., "BTCUSDT" on Binance futures)

    // Price data
    price: number;            // Last traded price
    bestBid: number;          // Highest bid
    bestAsk: number;          // Lowest ask
    spread: number;           // bestAsk - bestBid
    spreadBps: number;        // Spread in basis points

    // Futures-specific
    markPrice: number;
    indexPrice: number;
    basis: number;            // markPrice - indexPrice
    premiumIndex: number;     // (mark - index) / index

    // Funding & OI
    fundingRate: number;
    nextFundingTime: number;
    openInterest: number;
    openInterestValue: number;

    // Volume & liquidity
    volume24h: number;
    quoteVolume24h: number;
    liquidationVolume24h: number;

    // Metadata
    timestamp: number;
}

// ============================================
// INSTRUMENT SELECTOR
// ============================================

export interface InstrumentId {
    exchange: Exchange;
    marketType: MarketType;
    symbol: string;
}

// ============================================
// ORDERBOOK
// ============================================

export interface OrderbookLevel {
    price: number;
    size: number;
    total: number;  // Cumulative size
}

export interface Orderbook {
    exchange: Exchange;
    marketType: MarketType;
    symbol: string;
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    spread: number;
    spreadBps: number;
    imbalance: number;  // -1 to 1, positive = more bids
    timestamp: number;
}

// ============================================
// TRADES
// ============================================

export interface Trade {
    id: string;
    exchange: Exchange;
    marketType: MarketType;
    symbol: string;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: number;
}

// ============================================
// KLINES / CANDLES
// ============================================

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Kline {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// ============================================
// FUNDING RATE
// ============================================

export interface FundingRate {
    exchange: Exchange;
    symbol: string;
    rate: number;
    nextFundingTime: number;
    timestamp: number;
}

// ============================================
// OPEN INTEREST
// ============================================

export interface OpenInterest {
    exchange: Exchange;
    symbol: string;
    openInterest: number;
    openInterestValue: number;
    timestamp: number;
}

// ============================================
// MACRO DATA (Dashboard only)
// ============================================

export interface GlobalMarketData {
    totalMarketCap: number;
    marketCapChange24h: number;
    totalVolume24h: number;
    btcDominance: number;
    ethDominance: number;
    activeCryptos: number;
    timestamp: number;
}

export interface FearGreedIndex {
    value: number;
    classification: string;
    timestamp: number;
}

export interface DefiTVL {
    totalTvl: number;
    change24h: number;
    timestamp: number;
}

export interface NewsItem {
    id: string;
    title: string;
    source: string;
    url: string;
    publishedAt: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
}

// ============================================
// EXECUTION MATRIX (Multi-exchange comparison)
// ============================================

export interface ExecutionMatrixData {
    marketType: MarketType;
    symbol: string;
    instruments: Record<Exchange, Instrument | null>;
    arbitrage: {
        maxBid: { exchange: Exchange; price: number } | null;
        minAsk: { exchange: Exchange; price: number } | null;
        gap: number;  // maxBid - minAsk (positive = arb opportunity)
        gapPercent: number;
    };
    timestamp: number;
}

// ============================================
// WATCHLIST
// ============================================

export interface WatchlistItem extends InstrumentId {
    addedAt: number;
}

// ============================================
// WEBSOCKET
// ============================================

export type WSConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WSMessage {
    type: 'trade' | 'orderbook' | 'ticker' | 'depth';
    exchange: Exchange;
    data: unknown;
}

// ============================================
// API RESPONSES
// ============================================

export interface APIResponse<T> {
    success: boolean;
    data: T | null;
    error?: string;
    cached?: boolean;
    timestamp: number;
}
