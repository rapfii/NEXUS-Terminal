/**
 * NEXUS Terminal - Data Health Types
 * Provenance, SLA, and staleness tracking for operational rigor
 */

// ============================================
// SLA DEFINITIONS
// ============================================

/**
 * Data freshness SLA levels
 * - REAL_TIME: WebSocket streams (< 100ms latency expected)
 * - NEAR_REAL_TIME: Polled data (5-30s refresh)
 * - BATCHED: Slow-moving data (1h+ refresh acceptable)
 */
export type DataSLA = 'REAL_TIME' | 'NEAR_REAL_TIME' | 'BATCHED';

/**
 * SLA thresholds in milliseconds
 * Data older than these thresholds is considered STALE
 */
export const SLA_THRESHOLDS: Record<DataSLA, number> = {
    REAL_TIME: 5_000,       // 5 seconds - orderbook, trades, liquidations
    NEAR_REAL_TIME: 60_000, // 1 minute - funding, OI, tickers
    BATCHED: 3_600_000,     // 1 hour - TVL, macro, news
};

/**
 * Endpoint SLA mapping
 * Maps each data type to its expected SLA
 */
export const ENDPOINT_SLAS: Record<string, DataSLA> = {
    // Real-time (WebSocket required)
    'orderbook': 'REAL_TIME',
    'trades': 'REAL_TIME',
    'liquidations': 'REAL_TIME',
    'ticker': 'REAL_TIME',

    // Near real-time (polling OK)
    'funding': 'NEAR_REAL_TIME',
    'openInterest': 'NEAR_REAL_TIME',
    'positioning': 'NEAR_REAL_TIME',
    'derivatives': 'NEAR_REAL_TIME',
    'aggregator': 'NEAR_REAL_TIME',

    // Batched (slow-moving)
    'tvl': 'BATCHED',
    'macro': 'BATCHED',
    'news': 'BATCHED',
    'fearGreed': 'BATCHED',
    'defi': 'BATCHED',
};

// ============================================
// DATA PROVENANCE
// ============================================

/**
 * Source identification for all data
 */
export type DataSource =
    | 'binance'
    | 'bybit'
    | 'okx'
    | 'deribit'
    | 'kraken'
    | 'coinbase'
    | 'kucoin'
    | 'gateio'
    | 'bitget'
    | 'coingecko'
    | 'coinmarketcap'
    | 'defillama'
    | 'glassnode'
    | 'cryptoquant'
    | 'coinglass'
    | 'aggregated'
    | 'mock';

// ============================================
// DATA METADATA
// ============================================

/**
 * Metadata attached to every data response
 * This is the core of the data health layer
 */
export interface DataMeta {
    /** Primary source of data */
    source: DataSource;

    /** Contributing sources if aggregated */
    sources?: DataSource[];

    /** Unix timestamp (ms) when data was fetched from source */
    fetchedAt: number;

    /** Unix timestamp (ms) of the data itself (e.g., last trade time) */
    dataTimestamp: number;

    /** Round-trip latency in ms from request to response */
    latency: number;

    /** Expected freshness SLA for this data type */
    sla: DataSLA;

    /** True if data is older than SLA threshold */
    stale: boolean;

    /** True if this is fallback mock data */
    isMock: boolean;

    /** Confidence score (0-1) based on source reliability and freshness */
    confidence: number;

    /** Human-readable age (e.g., "2s ago", "5m ago") */
    ageDisplay?: string;

    /** Error message if partial failure */
    error?: string;
}

/**
 * Calculate if data is stale based on SLA
 */
export function isDataStale(dataTimestamp: number, sla: DataSLA): boolean {
    const age = Date.now() - dataTimestamp;
    return age > SLA_THRESHOLDS[sla];
}

/**
 * Calculate confidence score based on staleness and source
 */
export function calculateConfidence(
    dataTimestamp: number,
    sla: DataSLA,
    source: DataSource,
    isMock: boolean
): number {
    if (isMock) return 0.1;

    const age = Date.now() - dataTimestamp;
    const threshold = SLA_THRESHOLDS[sla];

    // Base confidence from freshness (1.0 = fresh, 0.0 = at threshold)
    let confidence = Math.max(0, 1 - (age / threshold));

    // Reduce confidence for less reliable sources
    const sourceReliability: Record<DataSource, number> = {
        binance: 1.0,
        bybit: 0.95,
        okx: 0.95,
        deribit: 0.95,
        kraken: 0.9,
        coinbase: 0.9,
        kucoin: 0.85,
        gateio: 0.85,
        bitget: 0.85,
        coingecko: 0.8,
        coinmarketcap: 0.8,
        defillama: 0.85,
        glassnode: 0.95,
        cryptoquant: 0.9,
        coinglass: 0.85,
        aggregated: 0.9,
        mock: 0.1,
    };

    confidence *= sourceReliability[source] ?? 0.7;

    return Math.round(confidence * 100) / 100;
}

/**
 * Format age for display (e.g., "2s ago", "5m ago")
 */
export function formatAge(timestamp: number): string {
    const age = Date.now() - timestamp;

    if (age < 1000) return 'now';
    if (age < 60_000) return `${Math.floor(age / 1000)}s ago`;
    if (age < 3_600_000) return `${Math.floor(age / 60_000)}m ago`;
    if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h ago`;
    return `${Math.floor(age / 86_400_000)}d ago`;
}

/**
 * Create DataMeta from a fetch operation
 */
export function createDataMeta(
    source: DataSource,
    dataTimestamp: number,
    latency: number,
    sla: DataSLA,
    isMock: boolean = false,
    sources?: DataSource[],
    error?: string
): DataMeta {
    const stale = isDataStale(dataTimestamp, sla);
    const confidence = calculateConfidence(dataTimestamp, sla, source, isMock);

    return {
        source,
        sources,
        fetchedAt: Date.now(),
        dataTimestamp,
        latency,
        sla,
        stale,
        isMock,
        confidence,
        ageDisplay: formatAge(dataTimestamp),
        error,
    };
}

// ============================================
// ENHANCED API RESPONSE
// ============================================

/**
 * API Response with full data provenance
 * Replaces the simple APIResponse for operational use
 */
export interface DataResponse<T> {
    success: boolean;
    data: T | null;
    meta: DataMeta;
    error?: string;
}

/**
 * Multi-source aggregated response
 */
export interface AggregatedDataResponse<T> {
    success: boolean;
    data: T | null;

    /** Per-source metadata */
    sourceMeta: Record<string, DataMeta>;

    /** Aggregated metadata */
    meta: DataMeta;

    /** Sources that failed */
    failedSources: { source: DataSource; error: string }[];

    error?: string;
}

// ============================================
// DATA HEALTH STATUS
// ============================================

/**
 * Health status for a single data source
 */
export interface SourceHealth {
    source: DataSource;
    status: 'healthy' | 'degraded' | 'unavailable';
    lastSuccess: number | null;
    lastError: number | null;
    latencyAvg: number;
    latencyP95: number;
    errorRate: number;  // 0-1
    staleRate: number;  // 0-1, how often data is stale
}

/**
 * Overall data platform health
 */
export interface DataPlatformHealth {
    overall: 'healthy' | 'degraded' | 'critical';
    sources: SourceHealth[];

    /** Aggregator stats */
    aggregator: {
        requestsPerMinute: number;
        avgLatency: number;
        errorRate: number;
        cacheHitRate: number;
    };

    /** WebSocket connection status */
    websockets: {
        source: DataSource;
        status: 'connected' | 'connecting' | 'disconnected';
        latency: number;
    }[];

    timestamp: number;
}
