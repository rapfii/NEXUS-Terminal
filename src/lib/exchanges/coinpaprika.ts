/**
 * CoinPaprika API Adapter
 * Comprehensive crypto data with OHLC, events, and more
 * https://api.coinpaprika.com/
 */

const BASE_URL = 'https://api.coinpaprika.com/v1';

export const coinpaprikaAdapter = {
    name: 'coinpaprika' as const,

    /**
     * Get global market data
     */
    async getGlobal(): Promise<{
        marketCapUsd: number;
        volume24hUsd: number;
        btcDominance: number;
        ethDominance: number;
        marketCapChange24h: number;
        volume24hChange24h: number;
        activeCryptocurrencies: number;
        activeMarkets: number;
    } | null> {
        try {
            const res = await fetch(`${BASE_URL}/global`, {
                next: { revalidate: 60 }
            });

            if (!res.ok) return null;

            const data = await res.json();

            return {
                marketCapUsd: data.market_cap_usd || 0,
                volume24hUsd: data.volume_24h_usd || 0,
                btcDominance: data.bitcoin_dominance_percentage || 0,
                ethDominance: data.ethereum_dominance_percentage || 0,
                marketCapChange24h: data.market_cap_change_24h || 0,
                volume24hChange24h: data.volume_24h_change_24h || 0,
                activeCryptocurrencies: data.cryptocurrencies_number || 0,
                activeMarkets: data.market_pairs_number || 0,
            };
        } catch (error) {
            console.error('CoinPaprika getGlobal error:', error);
            return null;
        }
    },

    /**
     * Get all tickers
     */
    async getTickers(limit: number = 100): Promise<{
        id: string;
        symbol: string;
        name: string;
        rank: number;
        price: number;
        volume24h: number;
        marketCap: number;
        percentChange1h: number;
        percentChange24h: number;
        percentChange7d: number;
        percentChange30d: number;
        ath: number;
        athDate: string;
        percentFromAth: number;
    }[]> {
        try {
            const res = await fetch(`${BASE_URL}/tickers`, {
                next: { revalidate: 60 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return data.slice(0, limit).map((t: any) => ({
                id: t.id,
                symbol: t.symbol,
                name: t.name,
                rank: t.rank,
                price: t.quotes?.USD?.price || 0,
                volume24h: t.quotes?.USD?.volume_24h || 0,
                marketCap: t.quotes?.USD?.market_cap || 0,
                percentChange1h: t.quotes?.USD?.percent_change_1h || 0,
                percentChange24h: t.quotes?.USD?.percent_change_24h || 0,
                percentChange7d: t.quotes?.USD?.percent_change_7d || 0,
                percentChange30d: t.quotes?.USD?.percent_change_30d || 0,
                ath: t.quotes?.USD?.ath_price || 0,
                athDate: t.quotes?.USD?.ath_date || '',
                percentFromAth: t.quotes?.USD?.percent_from_price_ath || 0,
            }));
        } catch (error) {
            console.error('CoinPaprika getTickers error:', error);
            return [];
        }
    },

    /**
     * Get OHLC for a coin (daily candles)
     */
    async getOHLC(coinId: string): Promise<{
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        marketCap: number;
    }[]> {
        try {
            const res = await fetch(`${BASE_URL}/coins/${coinId}/ohlcv/latest`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return data.map((c: any) => ({
                time: c.time_open,
                open: c.open || 0,
                high: c.high || 0,
                low: c.low || 0,
                close: c.close || 0,
                volume: c.volume || 0,
                marketCap: c.market_cap || 0,
            }));
        } catch (error) {
            console.error('CoinPaprika getOHLC error:', error);
            return [];
        }
    },

    /**
     * Get upcoming events for a coin
     */
    async getEvents(coinId: string): Promise<{
        id: string;
        name: string;
        date: string;
        description: string;
        isConference: boolean;
    }[]> {
        try {
            const res = await fetch(`${BASE_URL}/coins/${coinId}/events`, {
                next: { revalidate: 3600 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return data.map((e: any) => ({
                id: e.id,
                name: e.name,
                date: e.date,
                description: e.description || '',
                isConference: e.is_conference || false,
            }));
        } catch (error) {
            console.error('CoinPaprika getEvents error:', error);
            return [];
        }
    },

    /**
     * Get exchanges by volume
     */
    async getExchanges(): Promise<{
        id: string;
        name: string;
        volume24h: number;
        markets: number;
        fiats: string[];
        website: string;
    }[]> {
        try {
            const res = await fetch(`${BASE_URL}/exchanges`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return data.slice(0, 30).map((e: any) => ({
                id: e.id,
                name: e.name,
                volume24h: e.quotes?.USD?.adjusted_volume_24h || 0,
                markets: e.markets || 0,
                fiats: e.fiats || [],
                website: e.links?.website?.[0] || '',
            }));
        } catch (error) {
            console.error('CoinPaprika getExchanges error:', error);
            return [];
        }
    },
};

export default coinpaprikaAdapter;
