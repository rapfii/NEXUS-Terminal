/**
 * NEXUS Terminal - API Client
 * Rate-limited, cached API client for exchange data
 */

interface RateLimitConfig {
    requests: number;
    windowMs: number;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

// Rate limits per exchange (requests per minute)
const RATE_LIMITS: Record<string, RateLimitConfig> = {
    binance: { requests: 1200, windowMs: 60000 },
    bybit: { requests: 120, windowMs: 60000 },
    okx: { requests: 60, windowMs: 60000 },
    kraken: { requests: 15, windowMs: 60000 },
    coinbase: { requests: 10, windowMs: 60000 },
    kucoin: { requests: 100, windowMs: 60000 },
    bitget: { requests: 60, windowMs: 60000 },
    gateio: { requests: 200, windowMs: 60000 },
    deribit: { requests: 100, windowMs: 60000 },
    defillama: { requests: 30, windowMs: 60000 },
    coinglass: { requests: 10, windowMs: 60000 },
    coinalyze: { requests: 30, windowMs: 60000 },
    default: { requests: 30, windowMs: 60000 },
};

// Request queue for rate limiting
class RequestQueue {
    private queue: { resolve: () => void; timestamp: number }[] = [];
    private requestTimes: number[] = [];
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
    }

    async acquire(): Promise<void> {
        const now = Date.now();

        // Clean old request times
        this.requestTimes = this.requestTimes.filter(
            t => now - t < this.config.windowMs
        );

        // If under limit, proceed immediately
        if (this.requestTimes.length < this.config.requests) {
            this.requestTimes.push(now);
            return;
        }

        // Calculate wait time
        const oldestRequest = this.requestTimes[0];
        const waitTime = this.config.windowMs - (now - oldestRequest) + 10;

        await this.wait(waitTime);
        this.requestTimes.shift();
        this.requestTimes.push(Date.now());
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// In-memory cache
class APICache {
    private cache = new Map<string, CacheEntry<unknown>>();
    private maxSize = 1000;

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs: number = 5000): void {
        // Evict oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldest = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            if (oldest) this.cache.delete(oldest[0]);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        });
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

// API Client with rate limiting and caching
class APIClient {
    private queues = new Map<string, RequestQueue>();
    private cache = new APICache();
    private retryDelays = [1000, 2000, 5000]; // Exponential backoff

    private getQueue(source: string): RequestQueue {
        if (!this.queues.has(source)) {
            const config = RATE_LIMITS[source] || RATE_LIMITS.default;
            this.queues.set(source, new RequestQueue(config));
        }
        return this.queues.get(source)!;
    }

    /**
     * Fetch with rate limiting and caching
     */
    async fetch<T>(
        url: string,
        source: string,
        options: {
            cacheTtl?: number;
            cacheKey?: string;
            retry?: boolean;
            headers?: Record<string, string>;
        } = {}
    ): Promise<T> {
        const {
            cacheTtl = 5000,
            cacheKey = `${source}:${url}`,
            retry = true,
            headers = {},
        } = options;

        // Check cache first
        const cached = this.cache.get<T>(cacheKey);
        if (cached) return cached;

        // Acquire rate limit slot
        const queue = this.getQueue(source);
        await queue.acquire();

        // Fetch with retry
        let lastError: Error | null = null;
        const maxRetries = retry ? this.retryDelays.length : 0;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'NEXUS-Terminal/1.0',
                        ...headers,
                    },
                });

                if (!response.ok) {
                    // Rate limited - wait and retry
                    if (response.status === 429) {
                        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
                        await this.wait(retryAfter * 1000);
                        continue;
                    }

                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json() as T;

                // Cache successful response
                this.cache.set(cacheKey, data, cacheTtl);

                return data;
            } catch (error) {
                lastError = error as Error;
                console.warn(`[APIClient] Attempt ${attempt + 1} failed for ${source}:`, error);

                if (attempt < maxRetries) {
                    await this.wait(this.retryDelays[attempt]);
                }
            }
        }

        throw lastError || new Error(`Failed to fetch from ${source}`);
    }

    /**
     * Fetch multiple URLs in parallel with rate limiting
     */
    async fetchAll<T>(
        requests: { url: string; source: string; cacheTtl?: number }[]
    ): Promise<(T | null)[]> {
        const results = await Promise.allSettled(
            requests.map(req =>
                this.fetch<T>(req.url, req.source, { cacheTtl: req.cacheTtl })
            )
        );

        return results.map(result =>
            result.status === 'fulfilled' ? result.value : null
        );
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    getCacheStats(): { size: number } {
        return { size: this.cache.size() };
    }
}

// Singleton instance
export const apiClient = new APIClient();

// Helper for building query strings
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
    const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

    return entries.length > 0 ? `?${entries.join('&')}` : '';
}

// Helper for safe number parsing
export function safeParseFloat(value: unknown, fallback = 0): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
}

export function safeParseInt(value: unknown, fallback = 0): number {
    if (typeof value === 'number') return Math.floor(value);
    if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
}

export default apiClient;
