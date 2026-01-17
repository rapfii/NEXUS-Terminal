/**
 * NEXUS Cache Service
 * In-memory cache for historical data points (OI, prices)
 * Used to calculate deltas for regime/squeeze detection
 */

// ============================================
// TYPES
// ============================================

interface PriceSnapshot {
    price: number;
    timestamp: number;
}

interface OISnapshot {
    symbol: string;
    oi: number;
    oiValue: number;
    timestamp: number;
}

interface CacheStore {
    prices: Map<string, PriceSnapshot[]>;      // symbol -> snapshots
    oi: Map<string, OISnapshot[]>;              // symbol -> snapshots
    lastUpdate: Map<string, number>;            // key -> timestamp
}

// ============================================
// CACHE CONFIGURATION
// ============================================

const CONFIG = {
    // How long to keep snapshots
    PRICE_HISTORY_DURATION: 7 * 24 * 60 * 60 * 1000,  // 7 days
    OI_HISTORY_DURATION: 24 * 60 * 60 * 1000,          // 24 hours

    // Minimum interval between snapshots (avoid duplicates)
    MIN_SNAPSHOT_INTERVAL: 5 * 60 * 1000,              // 5 minutes

    // API base URLs
    BINANCE_FUTURES: 'https://fapi.binance.com/fapi/v1',
};

// ============================================
// CACHE STORE
// ============================================

const cache: CacheStore = {
    prices: new Map(),
    oi: new Map(),
    lastUpdate: new Map(),
};

// ============================================
// PRICE FUNCTIONS
// ============================================

/**
 * Record a price snapshot
 */
export function recordPrice(symbol: string, price: number): void {
    const now = Date.now();
    const key = symbol.toUpperCase();

    if (!cache.prices.has(key)) {
        cache.prices.set(key, []);
    }

    const snapshots = cache.prices.get(key)!;
    const lastSnapshot = snapshots[snapshots.length - 1];

    // Avoid recording too frequently
    if (lastSnapshot && now - lastSnapshot.timestamp < CONFIG.MIN_SNAPSHOT_INTERVAL) {
        return;
    }

    snapshots.push({ price, timestamp: now });

    // Prune old snapshots
    const cutoff = now - CONFIG.PRICE_HISTORY_DURATION;
    cache.prices.set(key, snapshots.filter(s => s.timestamp >= cutoff));
}

/**
 * Get price change over a period
 */
export function getPriceChange(symbol: string, periodMs: number): number {
    const key = symbol.toUpperCase();
    const snapshots = cache.prices.get(key);

    if (!snapshots || snapshots.length < 2) {
        return 0;
    }

    const now = Date.now();
    const targetTime = now - periodMs;
    const currentPrice = snapshots[snapshots.length - 1].price;

    // Find the closest snapshot to target time
    let historicalSnapshot: PriceSnapshot | null = null;
    for (let i = snapshots.length - 1; i >= 0; i--) {
        if (snapshots[i].timestamp <= targetTime) {
            historicalSnapshot = snapshots[i];
            break;
        }
    }

    if (!historicalSnapshot) {
        // Use oldest available if we don't have enough history
        historicalSnapshot = snapshots[0];
    }

    if (historicalSnapshot.price === 0) return 0;

    return ((currentPrice - historicalSnapshot.price) / historicalSnapshot.price) * 100;
}

/**
 * Get current cached price
 */
export function getCachedPrice(symbol: string): number | null {
    const key = symbol.toUpperCase();
    const snapshots = cache.prices.get(key);

    if (!snapshots || snapshots.length === 0) {
        return null;
    }

    return snapshots[snapshots.length - 1].price;
}

// ============================================
// OPEN INTEREST FUNCTIONS
// ============================================

/**
 * Record an OI snapshot
 */
export function recordOI(symbol: string, oi: number, oiValue: number): void {
    const now = Date.now();
    const key = symbol.toUpperCase();

    if (!cache.oi.has(key)) {
        cache.oi.set(key, []);
    }

    const snapshots = cache.oi.get(key)!;
    const lastSnapshot = snapshots[snapshots.length - 1];

    // Avoid recording too frequently
    if (lastSnapshot && now - lastSnapshot.timestamp < CONFIG.MIN_SNAPSHOT_INTERVAL) {
        return;
    }

    snapshots.push({ symbol: key, oi, oiValue, timestamp: now });

    // Prune old snapshots
    const cutoff = now - CONFIG.OI_HISTORY_DURATION;
    cache.oi.set(key, snapshots.filter(s => s.timestamp >= cutoff));
}

/**
 * Get OI change over a period (in percent)
 */
export function getOIChange(symbol: string, periodMs: number): number {
    const key = symbol.toUpperCase();
    const snapshots = cache.oi.get(key);

    if (!snapshots || snapshots.length < 2) {
        return 0;
    }

    const now = Date.now();
    const targetTime = now - periodMs;
    const currentOI = snapshots[snapshots.length - 1].oiValue;

    // Find the closest snapshot to target time
    let historicalSnapshot: OISnapshot | null = null;
    for (let i = snapshots.length - 1; i >= 0; i--) {
        if (snapshots[i].timestamp <= targetTime) {
            historicalSnapshot = snapshots[i];
            break;
        }
    }

    if (!historicalSnapshot) {
        historicalSnapshot = snapshots[0];
    }

    if (historicalSnapshot.oiValue === 0) return 0;

    return ((currentOI - historicalSnapshot.oiValue) / historicalSnapshot.oiValue) * 100;
}

// ============================================
// INITIALIZATION & SEED FUNCTIONS
// ============================================

/**
 * Seed cache with historical data from APIs
 * Call this on server startup
 */
export async function seedCache(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

    console.log('[CacheService] Seeding cache with historical data...');

    for (const symbol of symbols) {
        try {
            // Fetch current price and OI
            const [priceRes, oiRes] = await Promise.allSettled([
                fetch(`${CONFIG.BINANCE_FUTURES}/ticker/price?symbol=${symbol}`),
                fetch(`${CONFIG.BINANCE_FUTURES}/openInterest?symbol=${symbol}`),
            ]);

            if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
                const data = await priceRes.value.json();
                const price = parseFloat(data.price);
                if (price > 0) {
                    recordPrice(symbol, price);
                    console.log(`[CacheService] Seeded ${symbol} price: $${price.toFixed(2)}`);
                }
            }

            if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
                const data = await oiRes.value.json();
                const oi = parseFloat(data.openInterest);
                // Estimate OI value (need price)
                const price = getCachedPrice(symbol) || 0;
                const oiValue = oi * price;
                if (oi > 0) {
                    recordOI(symbol, oi, oiValue);
                    console.log(`[CacheService] Seeded ${symbol} OI: ${oi.toFixed(2)}`);
                }
            }

            // Also fetch OI history from Binance
            const oiHistRes = await fetch(
                `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=24`
            );

            if (oiHistRes.ok) {
                const histData = await oiHistRes.json();
                for (const point of histData) {
                    const oi = parseFloat(point.sumOpenInterest);
                    const oiValue = parseFloat(point.sumOpenInterestValue);
                    const timestamp = point.timestamp;

                    // Manually add to cache with historical timestamp
                    const key = symbol.toUpperCase();
                    if (!cache.oi.has(key)) {
                        cache.oi.set(key, []);
                    }
                    cache.oi.get(key)!.push({ symbol: key, oi, oiValue, timestamp });
                }
                console.log(`[CacheService] Seeded ${symbol} with ${histData.length} OI history points`);
            }

        } catch (error) {
            console.error(`[CacheService] Error seeding ${symbol}:`, error);
        }
    }

    // Sort OI snapshots by timestamp
    for (const [key, snapshots] of cache.oi) {
        cache.oi.set(key, snapshots.sort((a, b) => a.timestamp - b.timestamp));
    }

    console.log('[CacheService] Cache seeding complete');
}

/**
 * Update cache with fresh data
 * Should be called periodically (e.g., every 5 minutes)
 */
export async function updateCache(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

    for (const symbol of symbols) {
        try {
            const [priceRes, oiRes] = await Promise.allSettled([
                fetch(`${CONFIG.BINANCE_FUTURES}/ticker/price?symbol=${symbol}`),
                fetch(`${CONFIG.BINANCE_FUTURES}/openInterest?symbol=${symbol}`),
            ]);

            if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
                const data = await priceRes.value.json();
                recordPrice(symbol, parseFloat(data.price));
            }

            if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
                const data = await oiRes.value.json();
                const oi = parseFloat(data.openInterest);
                const price = getCachedPrice(symbol) || 0;
                recordOI(symbol, oi, oi * price);
            }
        } catch (error) {
            console.error(`[CacheService] Error updating ${symbol}:`, error);
        }
    }
}

// ============================================
// CACHE STATS (for debugging)
// ============================================

export function getCacheStats(): {
    priceSymbols: string[];
    oiSymbols: string[];
    priceSnapshots: Record<string, number>;
    oiSnapshots: Record<string, number>;
} {
    const priceSnapshots: Record<string, number> = {};
    const oiSnapshots: Record<string, number> = {};

    for (const [key, snapshots] of cache.prices) {
        priceSnapshots[key] = snapshots.length;
    }

    for (const [key, snapshots] of cache.oi) {
        oiSnapshots[key] = snapshots.length;
    }

    return {
        priceSymbols: Array.from(cache.prices.keys()),
        oiSymbols: Array.from(cache.oi.keys()),
        priceSnapshots,
        oiSnapshots,
    };
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

// Time periods in milliseconds
export const PERIODS = {
    ONE_HOUR: 60 * 60 * 1000,
    FOUR_HOURS: 4 * 60 * 60 * 1000,
    ONE_DAY: 24 * 60 * 60 * 1000,
    SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000,
};

const cacheService = {
    recordPrice,
    getPriceChange,
    getCachedPrice,
    recordOI,
    getOIChange,
    seedCache,
    updateCache,
    getCacheStats,
    PERIODS,
};

export default cacheService;
