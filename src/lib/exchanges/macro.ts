/**
 * Macro Data Adapter
 * CoinGecko, DefiLlama, Fear & Greed Index
 */

import { GlobalMarketData, FearGreedIndex, DefiTVL } from '../types';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_BASE = 'https://api.llama.fi';
const FNG_BASE = 'https://api.alternative.me/fng';

export const macroAdapter = {
    /**
     * Get global market data from CoinGecko
     */
    async getGlobalData(): Promise<GlobalMarketData | null> {
        try {
            const res = await fetch(`${COINGECKO_BASE}/global`);
            if (!res.ok) return null;

            const { data } = await res.json();

            return {
                totalMarketCap: data.total_market_cap.usd,
                totalVolume24h: data.total_volume.usd,
                btcDominance: data.market_cap_percentage.btc,
                ethDominance: data.market_cap_percentage.eth,
                marketCapChange24h: data.market_cap_change_percentage_24h_usd,
                activeCryptos: data.active_cryptocurrencies,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('CoinGecko getGlobalData error:', error);
            return null;
        }
    },

    /**
     * Get top gainers/losers from CoinGecko
     */
    async getTopMovers(): Promise<{ gainers: unknown[]; losers: unknown[] }> {
        try {
            const res = await fetch(
                `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`
            );
            if (!res.ok) return { gainers: [], losers: [] };

            const coins = await res.json();

            const sorted = [...coins].sort(
                (a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
            );

            return {
                gainers: sorted.slice(0, 5).map((c) => ({
                    symbol: c.symbol.toUpperCase(),
                    name: c.name,
                    price: c.current_price,
                    change24h: c.price_change_percentage_24h,
                    image: c.image,
                })),
                losers: sorted.slice(-5).reverse().map((c) => ({
                    symbol: c.symbol.toUpperCase(),
                    name: c.name,
                    price: c.current_price,
                    change24h: c.price_change_percentage_24h,
                    image: c.image,
                })),
            };
        } catch (error) {
            console.error('CoinGecko getTopMovers error:', error);
            return { gainers: [], losers: [] };
        }
    },

    /**
     * Get Fear & Greed Index
     */
    async getFearGreedIndex(): Promise<FearGreedIndex | null> {
        try {
            const res = await fetch(`${FNG_BASE}/?limit=1`);
            if (!res.ok) return null;

            const { data } = await res.json();
            if (!data?.length) return null;

            const fng = data[0];
            return {
                value: parseInt(fng.value),
                classification: fng.value_classification,
                timestamp: parseInt(fng.timestamp) * 1000,
            };
        } catch (error) {
            console.error('Fear & Greed Index error:', error);
            return null;
        }
    },

    /**
     * Get DeFi TVL from DefiLlama
     */
    async getDefiTVL(): Promise<DefiTVL | null> {
        try {
            const [tvlRes, chainsRes] = await Promise.all([
                fetch(`${DEFILLAMA_BASE}/tvl`),
                fetch(`${DEFILLAMA_BASE}/v2/chains`),
            ]);

            if (!tvlRes.ok) return null;

            const totalTvl = await tvlRes.json();
            const chains = chainsRes.ok ? await chainsRes.json() : [];

            const chainTvl: Record<string, number> = {};
            (chains as { name: string; tvl: number }[])
                .sort((a, b) => b.tvl - a.tvl)
                .slice(0, 10)
                .forEach((c) => {
                    chainTvl[c.name] = c.tvl;
                });

            return {
                totalTvl,
                change24h: 0, // Would need historical data to calculate
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('DefiLlama getTVL error:', error);
            return null;
        }
    },

    /**
     * Get historical Fear & Greed data
     */
    async getFearGreedHistory(limit = 30): Promise<{ timestamp: number; value: number }[]> {
        try {
            const res = await fetch(`${FNG_BASE}/?limit=${limit}`);
            if (!res.ok) return [];

            const { data } = await res.json();
            return (data || []).map((d: { timestamp: string; value: string }) => ({
                timestamp: parseInt(d.timestamp) * 1000,
                value: parseInt(d.value),
            }));
        } catch (error) {
            console.error('Fear & Greed history error:', error);
            return [];
        }
    },

    /**
     * Get stablecoin supply data from DefiLlama
     * Critical for regime detection and capital flow analysis
     */
    async getStablecoinSupply(): Promise<{
        total: number;
        usdt: number;
        usdc: number;
        dai: number;
        change24h: number;
        change7d: number;
        breakdown: { name: string; supply: number; change24h: number }[];
    } | null> {
        try {
            const res = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true');
            if (!res.ok) return null;

            const data = await res.json();
            const stablecoins = data.peggedAssets || [];

            // Find major stablecoins
            const usdt = stablecoins.find((s: { symbol: string }) => s.symbol === 'USDT');
            const usdc = stablecoins.find((s: { symbol: string }) => s.symbol === 'USDC');
            const dai = stablecoins.find((s: { symbol: string }) => s.symbol === 'DAI');

            // Calculate totals
            const total = stablecoins.reduce((sum: number, s: { circulating: { peggedUSD: number } }) =>
                sum + (s.circulating?.peggedUSD || 0), 0);

            // Get USDT supply (largest, most important)
            const usdtSupply = usdt?.circulating?.peggedUSD || 0;
            const usdcSupply = usdc?.circulating?.peggedUSD || 0;
            const daiSupply = dai?.circulating?.peggedUSD || 0;

            // Calculate changes (DefiLlama provides circulatingPrevDay/Week)
            const usdtChange = usdt?.circulatingPrevDay?.peggedUSD
                ? ((usdtSupply - usdt.circulatingPrevDay.peggedUSD) / usdt.circulatingPrevDay.peggedUSD) * 100
                : 0;
            const usdcChange = usdc?.circulatingPrevDay?.peggedUSD
                ? ((usdcSupply - usdc.circulatingPrevDay.peggedUSD) / usdc.circulatingPrevDay.peggedUSD) * 100
                : 0;

            // Total change estimate
            const prevDayTotal = stablecoins.reduce((sum: number, s: { circulatingPrevDay?: { peggedUSD: number } }) =>
                sum + (s.circulatingPrevDay?.peggedUSD || 0), 0);
            const prevWeekTotal = stablecoins.reduce((sum: number, s: { circulatingPrevWeek?: { peggedUSD: number } }) =>
                sum + (s.circulatingPrevWeek?.peggedUSD || 0), 0);

            const change24h = prevDayTotal > 0 ? ((total - prevDayTotal) / prevDayTotal) * 100 : 0;
            const change7d = prevWeekTotal > 0 ? ((total - prevWeekTotal) / prevWeekTotal) * 100 : 0;

            return {
                total,
                usdt: usdtSupply,
                usdc: usdcSupply,
                dai: daiSupply,
                change24h,
                change7d,
                breakdown: [
                    { name: 'USDT', supply: usdtSupply, change24h: usdtChange },
                    { name: 'USDC', supply: usdcSupply, change24h: usdcChange },
                    { name: 'DAI', supply: daiSupply, change24h: 0 },
                ],
            };
        } catch (error) {
            console.error('Stablecoin supply error:', error);
            return null;
        }
    },

    /**
     * Get chain TVL - focused on major chains only
     * Filters out noise (Harmony, Plasma, etc.) and focuses on real capital
     */
    async getChainTVL(): Promise<{
        chains: {
            name: string;
            tvl: number;
            change1d: number;
            change7d: number;
        }[];
        total: number;
    } | null> {
        // Only track chains where real capital moves
        const MAJOR_CHAINS = ['Ethereum', 'Solana', 'BSC', 'Arbitrum', 'Base', 'Tron', 'Polygon', 'Avalanche', 'Optimism'];

        try {
            const res = await fetch(`${DEFILLAMA_BASE}/v2/chains`);
            if (!res.ok) return null;

            const allChains = await res.json();

            const chains = (allChains as {
                name: string;
                tvl: number;
                change_1d?: number;
                change_7d?: number;
            }[])
                .filter(c => MAJOR_CHAINS.includes(c.name))
                .sort((a, b) => b.tvl - a.tvl)
                .map(c => ({
                    name: c.name,
                    tvl: c.tvl,
                    change1d: c.change_1d || 0,
                    change7d: c.change_7d || 0,
                }));

            const total = chains.reduce((sum, c) => sum + c.tvl, 0);

            return { chains, total };
        } catch (error) {
            console.error('Chain TVL error:', error);
            return null;
        }
    },

    /**
     * Get stablecoin flows by chain
     * Shows where stablecoin liquidity is moving
     */
    async getStablecoinFlowsByChain(): Promise<{
        chain: string;
        totalStables: number;
        change24h: number;
        usdtShare: number;
        usdcShare: number;
    }[] | null> {
        try {
            const res = await fetch('https://stablecoins.llama.fi/stablecoinchains');
            if (!res.ok) return null;

            const chains = await res.json();

            // Filter to major chains and sort by total
            const MAJOR_CHAINS = ['Ethereum', 'Tron', 'BSC', 'Arbitrum', 'Solana', 'Polygon', 'Avalanche', 'Base', 'Optimism'];

            return (chains as {
                name: string;
                totalCirculatingUSD: { peggedUSD: number };
                totalCirculatingPrevDay?: { peggedUSD: number };
            }[])
                .filter(c => MAJOR_CHAINS.includes(c.name))
                .sort((a, b) => (b.totalCirculatingUSD?.peggedUSD || 0) - (a.totalCirculatingUSD?.peggedUSD || 0))
                .map(c => {
                    const current = c.totalCirculatingUSD?.peggedUSD || 0;
                    const prev = c.totalCirculatingPrevDay?.peggedUSD || current;
                    const change24h = prev > 0 ? ((current - prev) / prev) * 100 : 0;

                    return {
                        chain: c.name,
                        totalStables: current,
                        change24h,
                        usdtShare: 0, // Would need additional API call
                        usdcShare: 0,
                    };
                });
        } catch (error) {
            console.error('Stablecoin flows error:', error);
            return null;
        }
    },
};

export default macroAdapter;
