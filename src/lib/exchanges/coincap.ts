/**
 * CoinCap API Adapter
 * Real-time crypto prices with WebSocket support
 * https://docs.coincap.io/
 */

const BASE_URL = 'https://api.coincap.io/v2';

interface CoinCapResponse<T> {
    data: T;
    timestamp: number;
}

interface Asset {
    id: string;
    rank: string;
    symbol: string;
    name: string;
    supply: string;
    maxSupply: string | null;
    marketCapUsd: string;
    volumeUsd24Hr: string;
    priceUsd: string;
    changePercent24Hr: string;
    vwap24Hr: string;
}

export const coincapAdapter = {
    name: 'coincap' as const,

    /**
     * Get all assets (top 100 by default)
     */
    async getAssets(limit: number = 100): Promise<{
        id: string;
        symbol: string;
        name: string;
        price: number;
        marketCap: number;
        volume24h: number;
        change24h: number;
        supply: number;
        maxSupply: number | null;
        rank: number;
    }[]> {
        try {
            const res = await fetch(`${BASE_URL}/assets?limit=${limit}`, {
                next: { revalidate: 30 }
            });

            if (!res.ok) return [];

            const data: CoinCapResponse<Asset[]> = await res.json();

            return data.data.map(a => ({
                id: a.id,
                symbol: a.symbol,
                name: a.name,
                price: parseFloat(a.priceUsd) || 0,
                marketCap: parseFloat(a.marketCapUsd) || 0,
                volume24h: parseFloat(a.volumeUsd24Hr) || 0,
                change24h: parseFloat(a.changePercent24Hr) || 0,
                supply: parseFloat(a.supply) || 0,
                maxSupply: a.maxSupply ? parseFloat(a.maxSupply) : null,
                rank: parseInt(a.rank) || 0,
            }));
        } catch (error) {
            console.error('CoinCap getAssets error:', error);
            return [];
        }
    },

    /**
     * Get single asset by ID
     */
    async getAsset(id: string): Promise<{
        id: string;
        symbol: string;
        name: string;
        price: number;
        marketCap: number;
        volume24h: number;
        change24h: number;
        supply: number;
        vwap24h: number;
    } | null> {
        try {
            const res = await fetch(`${BASE_URL}/assets/${id}`, {
                next: { revalidate: 30 }
            });

            if (!res.ok) return null;

            const data: CoinCapResponse<Asset> = await res.json();
            const a = data.data;

            return {
                id: a.id,
                symbol: a.symbol,
                name: a.name,
                price: parseFloat(a.priceUsd) || 0,
                marketCap: parseFloat(a.marketCapUsd) || 0,
                volume24h: parseFloat(a.volumeUsd24Hr) || 0,
                change24h: parseFloat(a.changePercent24Hr) || 0,
                supply: parseFloat(a.supply) || 0,
                vwap24h: parseFloat(a.vwap24Hr) || 0,
            };
        } catch (error) {
            console.error('CoinCap getAsset error:', error);
            return null;
        }
    },

    /**
     * Get price history for an asset
     */
    async getHistory(id: string, interval: 'm1' | 'm5' | 'm15' | 'm30' | 'h1' | 'h2' | 'h6' | 'h12' | 'd1' = 'h1'): Promise<{
        time: number;
        price: number;
    }[]> {
        try {
            const res = await fetch(`${BASE_URL}/assets/${id}/history?interval=${interval}`, {
                next: { revalidate: 60 }
            });

            if (!res.ok) return [];

            const data: CoinCapResponse<{ priceUsd: string; time: number }[]> = await res.json();

            return data.data.map(h => ({
                time: h.time,
                price: parseFloat(h.priceUsd) || 0,
            }));
        } catch (error) {
            console.error('CoinCap getHistory error:', error);
            return [];
        }
    },

    /**
     * Get exchanges list
     */
    async getExchanges(): Promise<{
        id: string;
        name: string;
        rank: number;
        volume24h: number;
        tradingPairs: number;
    }[]> {
        try {
            const res = await fetch(`${BASE_URL}/exchanges`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data: CoinCapResponse<{
                exchangeId: string;
                name: string;
                rank: string;
                volumeUsd: string;
                tradingPairs: string;
            }[]> = await res.json();

            return data.data.map(e => ({
                id: e.exchangeId,
                name: e.name,
                rank: parseInt(e.rank) || 0,
                volume24h: parseFloat(e.volumeUsd) || 0,
                tradingPairs: parseInt(e.tradingPairs) || 0,
            }));
        } catch (error) {
            console.error('CoinCap getExchanges error:', error);
            return [];
        }
    },

    /**
     * Get global market data
     */
    async getGlobalData(): Promise<{
        totalMarketCap: number;
        totalVolume24h: number;
        btcDominance: number;
    } | null> {
        try {
            // CoinCap doesn't have a direct global endpoint, calculate from assets
            const assets = await this.getAssets(100);

            if (assets.length === 0) return null;

            const totalMarketCap = assets.reduce((sum, a) => sum + a.marketCap, 0);
            const totalVolume24h = assets.reduce((sum, a) => sum + a.volume24h, 0);
            const btc = assets.find(a => a.symbol === 'BTC');
            const btcDominance = btc ? (btc.marketCap / totalMarketCap) * 100 : 0;

            return {
                totalMarketCap,
                totalVolume24h,
                btcDominance,
            };
        } catch (error) {
            console.error('CoinCap getGlobalData error:', error);
            return null;
        }
    },

    /**
     * WebSocket URL for real-time prices
     */
    getWebSocketUrl(assets: string[] = ['bitcoin', 'ethereum', 'solana']): string {
        return `wss://ws.coincap.io/prices?assets=${assets.join(',')}`;
    },
};

export default coincapAdapter;
