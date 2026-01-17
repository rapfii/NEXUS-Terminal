/**
 * NEXUS Terminal - Configuration
 * API keys and environment configuration
 */

// Exchange API configuration
export const EXCHANGE_CONFIG = {
    binance: {
        spot: {
            rest: 'https://api.binance.com/api/v3',
            ws: 'wss://stream.binance.com:9443/ws',
        },
        futures: {
            rest: 'https://fapi.binance.com/fapi/v1',
            data: 'https://fapi.binance.com/futures/data',
            ws: 'wss://fstream.binance.com/ws',
        },
    },
    bybit: {
        rest: 'https://api.bybit.com',
        ws: 'wss://stream.bybit.com/v5/public',
    },
    okx: {
        rest: 'https://www.okx.com',
        ws: 'wss://ws.okx.com:8443/ws/v5/public',
    },
    kraken: {
        rest: 'https://api.kraken.com',
        ws: 'wss://ws.kraken.com',
    },
    coinbase: {
        rest: 'https://api.exchange.coinbase.com',
        ws: 'wss://ws-feed.exchange.coinbase.com',
    },
    kucoin: {
        rest: 'https://api.kucoin.com',
    },
    bitget: {
        rest: 'https://api.bitget.com',
        ws: 'wss://ws.bitget.com/spot/v1/stream',
    },
    gateio: {
        rest: 'https://api.gateio.ws',
        ws: 'wss://api.gateio.ws/ws/v4/',
    },
    deribit: {
        rest: 'https://www.deribit.com/api/v2',
        ws: 'wss://www.deribit.com/ws/api/v2',
    },
} as const;

// Data provider configuration
export const DATA_PROVIDERS = {
    defillama: {
        rest: 'https://api.llama.fi',
        stablecoins: 'https://stablecoins.llama.fi',
        coins: 'https://coins.llama.fi',
    },
    coingecko: {
        rest: 'https://api.coingecko.com/api/v3',
    },
    feargreed: {
        rest: 'https://api.alternative.me/fng',
    },
    // Paid APIs - require keys
    coinglass: {
        rest: 'https://open-api.coinglass.com/public/v2',
        // Set via COINGLASS_API_KEY env var
    },
    coinalyze: {
        rest: 'https://api.coinalyze.net/v1',
        // Set via COINALYZE_API_KEY env var
    },
    glassnode: {
        rest: 'https://api.glassnode.com/v1',
        // Set via GLASSNODE_API_KEY env var
    },
    cryptoquant: {
        rest: 'https://api.cryptoquant.com/v1',
        // Set via CRYPTOQUANT_API_KEY env var
    },
    messari: {
        rest: 'https://data.messari.io/api/v1',
        // Free tier available
    },
} as const;

// News sources
export const NEWS_SOURCES = {
    coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    theblock: 'https://www.theblock.co/rss.xml',
    decrypt: 'https://decrypt.co/feed',
    cryptoslate: 'https://cryptoslate.com/feed/',
} as const;

// Get API key from environment
export function getApiKey(provider: 'coinglass' | 'coinalyze' | 'glassnode' | 'cryptoquant'): string | null {
    if (typeof process === 'undefined') return null;

    const keyMap: Record<string, string> = {
        coinglass: 'COINGLASS_API_KEY',
        coinalyze: 'COINALYZE_API_KEY',
        glassnode: 'GLASSNODE_API_KEY',
        cryptoquant: 'CRYPTOQUANT_API_KEY',
    };

    return process.env[keyMap[provider]] || null;
}

// Check if premium data is available
export function hasPremiumAccess(provider: 'coinglass' | 'coinalyze' | 'glassnode' | 'cryptoquant'): boolean {
    return !!getApiKey(provider);
}

// Symbol formatting per exchange
export const SYMBOL_FORMATTERS: Record<string, (symbol: string) => string> = {
    binance: (s) => s.replace('-', '').replace('/', '').toUpperCase(),
    bybit: (s) => s.replace('-', '').replace('/', '').toUpperCase(),
    okx: (s) => {
        // OKX uses format like "BTC-USDT-SWAP" for perpetuals
        const base = s.replace('USDT', '').replace('-', '');
        return `${base}-USDT-SWAP`;
    },
    deribit: (s) => {
        // Deribit uses BTC-PERPETUAL format
        const base = s.replace('USDT', '').replace('-', '');
        return `${base}-PERPETUAL`;
    },
    kraken: (s) => {
        // Kraken uses XBT instead of BTC
        return s.replace('BTC', 'XBT').replace('/', '');
    },
    default: (s) => s.replace('-', '').toUpperCase(),
};

// Format symbol for exchange
export function formatSymbolForExchange(symbol: string, exchange: string): string {
    const formatter = SYMBOL_FORMATTERS[exchange] || SYMBOL_FORMATTERS.default;
    return formatter(symbol);
}

// Standard coin symbols we track
export const TRACKED_SYMBOLS = [
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
    'DOGEUSDT',
    'ADAUSDT',
    'AVAXUSDT',
    'DOTUSDT',
    'MATICUSDT',
    'LINKUSDT',
    'LTCUSDT',
    'UNIUSDT',
    'ATOMUSDT',
    'NEARUSDT',
    'ARBUSDT',
    'OPUSDT',
    'APTUSDT',
    'SUIUSDT',
    'INJUSDT',
] as const;

// Major chains for on-chain tracking
export const MAJOR_CHAINS = [
    'ethereum',
    'arbitrum',
    'optimism',
    'polygon',
    'base',
    'bsc',
    'avalanche',
    'solana',
    'tron',
    'sui',
    'aptos',
] as const;

// Cache TTLs in milliseconds
export const CACHE_TTL = {
    ticker: 2000,           // 2 seconds - price data
    orderbook: 1000,        // 1 second - orderbook
    funding: 30000,         // 30 seconds - funding rate
    oi: 60000,              // 1 minute - open interest
    liquidations: 5000,     // 5 seconds - liquidations
    positioning: 60000,     // 1 minute - long/short ratio
    tvl: 300000,            // 5 minutes - TVL data
    news: 60000,            // 1 minute - news
    macro: 60000,           // 1 minute - macro indicators
    options: 30000,         // 30 seconds - options data
} as const;

const config = {
    EXCHANGE_CONFIG,
    DATA_PROVIDERS,
    NEWS_SOURCES,
    TRACKED_SYMBOLS,
    MAJOR_CHAINS,
    CACHE_TTL,
};

export default config;
