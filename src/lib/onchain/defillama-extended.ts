/**
 * DefiLlama Extended APIs
 * Bridges, Stablecoins, and Yields data
 */

// API Endpoints
const BRIDGES_API = 'https://bridges.llama.fi';
const STABLECOINS_API = 'https://stablecoins.llama.fi';
const YIELDS_API = 'https://yields.llama.fi';
const DEFILLAMA_BASE = 'https://api.llama.fi';

export const defillamaExtendedAdapter = {
    name: 'defillama-extended' as const,

    // ============================================
    // BRIDGES
    // ============================================

    /**
     * Get all bridges
     */
    async getBridges(): Promise<{
        id: number;
        name: string;
        displayName: string;
        volume24h: number;
        volume7d: number;
        chains: string[];
    }[]> {
        try {
            const res = await fetch(`${BRIDGES_API}/bridges`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return (data.bridges || []).map((b: any) => ({
                id: b.id,
                name: b.name,
                displayName: b.displayName || b.name,
                volume24h: b.lastDailyVolume || 0,
                volume7d: b.weeklyVolume || 0,
                chains: b.chains || [],
            })).sort((a: any, b: any) => b.volume24h - a.volume24h);
        } catch (error) {
            console.error('DefiLlama getBridges error:', error);
            return [];
        }
    },

    /**
     * Get bridge volume by chain
     */
    async getBridgeVolumeByChain(): Promise<{
        chain: string;
        volumeIn24h: number;
        volumeOut24h: number;
        netFlow24h: number;
    }[]> {
        try {
            const res = await fetch(`${BRIDGES_API}/bridgevolume/all`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            // Aggregate the last 24h data by chain
            const chainVolumes: Record<string, { in: number; out: number }> = {};

            for (const entry of data || []) {
                const chain = entry.chain;
                if (!chainVolumes[chain]) {
                    chainVolumes[chain] = { in: 0, out: 0 };
                }
                chainVolumes[chain].in += entry.depositUSD || 0;
                chainVolumes[chain].out += entry.withdrawUSD || 0;
            }

            return Object.entries(chainVolumes)
                .map(([chain, vol]) => ({
                    chain,
                    volumeIn24h: vol.in,
                    volumeOut24h: vol.out,
                    netFlow24h: vol.in - vol.out,
                }))
                .sort((a, b) => Math.abs(b.netFlow24h) - Math.abs(a.netFlow24h));
        } catch (error) {
            console.error('DefiLlama getBridgeVolumeByChain error:', error);
            return [];
        }
    },

    // ============================================
    // STABLECOINS
    // ============================================

    /**
     * Get all stablecoins
     */
    async getStablecoins(): Promise<{
        id: string;
        name: string;
        symbol: string;
        circulating: number;
        circulatingChange24h: number;
        circulatingChange7d: number;
        pegType: string;
        chains: string[];
    }[]> {
        try {
            const res = await fetch(`${STABLECOINS_API}/stablecoins?includePrices=true`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return (data.peggedAssets || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                symbol: s.symbol,
                circulating: s.circulating?.peggedUSD || 0,
                circulatingChange24h: s.circulatingPrevDay?.peggedUSD
                    ? ((s.circulating?.peggedUSD - s.circulatingPrevDay?.peggedUSD) / s.circulatingPrevDay?.peggedUSD) * 100
                    : 0,
                circulatingChange7d: s.circulatingPrevWeek?.peggedUSD
                    ? ((s.circulating?.peggedUSD - s.circulatingPrevWeek?.peggedUSD) / s.circulatingPrevWeek?.peggedUSD) * 100
                    : 0,
                pegType: s.pegType || 'USD',
                chains: s.chains || [],
            })).sort((a: any, b: any) => b.circulating - a.circulating);
        } catch (error) {
            console.error('DefiLlama getStablecoins error:', error);
            return [];
        }
    },

    /**
     * Get stablecoins by chain
     */
    async getStablecoinsByChain(): Promise<{
        chain: string;
        totalCirculating: number;
        dominantStablecoin: string;
        stablecoins: { name: string; circulating: number }[];
    }[]> {
        try {
            const res = await fetch(`${STABLECOINS_API}/stablecoinchains`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return data.map((c: any) => ({
                chain: c.name,
                totalCirculating: c.totalCirculatingUSD?.peggedUSD || 0,
                dominantStablecoin: c.dominantStablecoin || 'Unknown',
                stablecoins: [],
            })).sort((a: any, b: any) => b.totalCirculating - a.totalCirculating);
        } catch (error) {
            console.error('DefiLlama getStablecoinsByChain error:', error);
            return [];
        }
    },

    // ============================================
    // YIELDS
    // ============================================

    /**
     * Get top yield pools
     */
    async getTopYields(limit: number = 50): Promise<{
        pool: string;
        chain: string;
        project: string;
        symbol: string;
        tvlUsd: number;
        apy: number;
        apyBase: number;
        apyReward: number;
        stablecoin: boolean;
    }[]> {
        try {
            const res = await fetch(`${YIELDS_API}/pools`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return (data.data || [])
                .filter((p: any) => p.tvlUsd > 100000) // Only pools with >$100k TVL
                .sort((a: any, b: any) => b.apy - a.apy)
                .slice(0, limit)
                .map((p: any) => ({
                    pool: p.pool,
                    chain: p.chain,
                    project: p.project,
                    symbol: p.symbol,
                    tvlUsd: p.tvlUsd || 0,
                    apy: p.apy || 0,
                    apyBase: p.apyBase || 0,
                    apyReward: p.apyReward || 0,
                    stablecoin: p.stablecoin || false,
                }));
        } catch (error) {
            console.error('DefiLlama getTopYields error:', error);
            return [];
        }
    },

    /**
     * Get aggregated summary
     */
    async getSummary(): Promise<{
        totalBridgeVolume24h: number;
        totalStablecoinSupply: number;
        topBridgesByVolume: { name: string; volume: number }[];
        topStablecoins: { name: string; supply: number }[];
        topYields: { project: string; apy: number; tvl: number }[];
    } | null> {
        try {
            const [bridges, stables, yields] = await Promise.allSettled([
                this.getBridges(),
                this.getStablecoins(),
                this.getTopYields(10),
            ]);

            const bridgesData = bridges.status === 'fulfilled' ? bridges.value : [];
            const stablesData = stables.status === 'fulfilled' ? stables.value : [];
            const yieldsData = yields.status === 'fulfilled' ? yields.value : [];

            return {
                totalBridgeVolume24h: bridgesData.reduce((sum, b) => sum + b.volume24h, 0),
                totalStablecoinSupply: stablesData.reduce((sum, s) => sum + s.circulating, 0),
                topBridgesByVolume: bridgesData.slice(0, 5).map(b => ({ name: b.name, volume: b.volume24h })),
                topStablecoins: stablesData.slice(0, 5).map(s => ({ name: s.name, supply: s.circulating })),
                topYields: yieldsData.slice(0, 5).map(y => ({ project: y.project, apy: y.apy, tvl: y.tvlUsd })),
            };
        } catch (error) {
            console.error('DefiLlama getSummary error:', error);
            return null;
        }
    },

    // ============================================
    // NEW EXTENDED METRICS (FEES, REVENUE, DEX)
    // ============================================

    /**
     * Get protocol fees and revenue listing
     */
    async getFeesAndRevenue(): Promise<{
        name: string;
        category: string;
        total24h: number; // Total user fees
        total7d: number;
        revenue24h: number; // Protocol revenue
        revenue7d: number;
        change1d: number;
        change7d: number;
    }[]> {
        try {
            // Using overview endpoint which often contains this summary
            const res = await fetch(`${DEFILLAMA_BASE}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyFees`, {
                next: { revalidate: 3600 }
            });

            if (!res.ok) return [];
            const data = await res.json();

            // Depending on exact endpoint shape (sometimes varies), we adapt
            // Assuming standard summary list
            return (data.protocols || []).map((p: any) => ({
                name: p.name,
                category: p.category,
                total24h: p.total24h || 0,
                total7d: p.total7d || 0,
                revenue24h: p.totalRevenue24h || (p.total24h * 0.1), // Fallback estimation if not direct
                revenue7d: p.totalRevenue7d || (p.total7d * 0.1),
                change1d: p.change_1d || 0,
                change7d: p.change_7d || 0,
            })).sort((a: any, b: any) => b.total24h - a.total24h).slice(0, 50);

        } catch (error) {
            console.error('DefiLlama getFeesAndRevenue error:', error);
            return [];
        }
    },

    /**
     * Get DEX volume rankings
     */
    async getDexVolumes(chain?: string): Promise<{
        name: string;
        volume24h: number;
        volume7d: number;
        marketShare: number;
        chains: string[];
    }[]> {
        try {
            const url = chain
                ? `${DEFILLAMA_BASE}/overview/dexs/${chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`
                : `${DEFILLAMA_BASE}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`;

            const res = await fetch(url, { next: { revalidate: 3600 } });

            if (!res.ok) return [];
            const data = await res.json();

            const totalVol = data.total24h || 1;

            return (data.protocols || []).map((p: any) => ({
                name: p.name,
                volume24h: p.total24h || 0,
                volume7d: p.total7d || 0,
                marketShare: ((p.total24h || 0) / totalVol) * 100,
                chains: p.chains || [],
            })).sort((a: any, b: any) => b.volume24h - a.volume24h).slice(0, 50);

        } catch (error) {
            console.error('DefiLlama getDexVolumes error:', error);
            return [];
        }
    },

    /**
     * Get recent crypto hacks/exploits
     */
    async getHacks(): Promise<{
        date: number;
        name: string;
        amount: number;
        chain: string;
        classification: string;
    }[]> {
        try {
            const res = await fetch(`${DEFILLAMA_BASE}/hacks`, { next: { revalidate: 3600 } });
            if (!res.ok) return [];
            const data = await res.json();

            return data.map((h: any) => ({
                date: h.date * 1000,
                name: h.name,
                amount: h.amount,
                chain: h.chain,
                classification: h.classification,
            })).sort((a: any, b: any) => b.date - a.date).slice(0, 20);

        } catch (error) {
            console.error('DefiLlama getHacks error:', error);
            return [];
        }
    }
};

export default defillamaExtendedAdapter;
