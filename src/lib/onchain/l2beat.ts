/**
 * L2BEAT API Adapter
 * Layer 2 scaling solutions data
 */

const BASE_URL = 'https://l2beat.com/api';

export const l2beatAdapter = {
    name: 'l2beat' as const,

    /**
     * Get all L2 projects TVL and Risk
     */
    async getTvl(): Promise<{
        projects: {
            id: string;
            name: string;
            tvl: number;
            change7d: number;
            marketShare: number;
            category: string;
            provider: string;
            stage: string;
        }[];
        totalTvl: number;
    } | null> {
        try {
            const res = await fetch(`${BASE_URL}/tvl`, {
                next: { revalidate: 600 }
            });

            if (!res.ok) return null;

            const data = await res.json();

            // Calculate total based on what we find
            // Data structure from L2Beat API can be complex, simplifying assumption for demonstration
            // In reality, we might need to sum up canonical TVL from response

            // Assuming simpler structure for reliability or parsing what we know exists
            const projects = (data.projects || []).map((p: any) => ({
                id: p.projectId,
                name: p.displayName || p.projectId,
                tvl: p.tvl?.canonical || 0,
                change7d: p.tvlChange?.week || 0,
                marketShare: 0, // Calculate after summing
                category: p.category || 'rollup',
                provider: p.provider || 'Unknown',
                stage: p.stage || 'Not Rated'
            })).sort((a: any, b: any) => b.tvl - a.tvl);

            const totalTvl = projects.reduce((sum: number, p: any) => sum + p.tvl, 0);

            // Update market share
            projects.forEach((p: any) => {
                p.marketShare = totalTvl > 0 ? (p.tvl / totalTvl) * 100 : 0;
            });

            return { projects, totalTvl };
        } catch (error) {
            console.error('L2BEAT getTvl error:', error);
            // Return fallback structure if API fails
            return { projects: [], totalTvl: 0 };
        }
    },

    /**
     * Get L2 Activity (TPS)
     */
    async getActivity(): Promise<{
        projects: {
            id: string;
            name: string;
            tps: number;
            tps7d: number;
        }[];
        totalTps: number;
        ethereumTps: number;
        scalingFactor: number;
    } | null> {
        try {
            const res = await fetch(`${BASE_URL}/activity`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return null;
            const data = await res.json();

            // Simplified parsing
            const projects = (data.projects || []).map((p: any) => ({
                id: p.projectId,
                name: p.displayName || p.projectId,
                tps: p.activity?.tps || 0,
                tps7d: p.activity?.tps7d || 0
            })).sort((a: any, b: any) => b.tps - a.tps);

            const totalTps = data.combined?.tps || 0;
            const ethereumTps = data.ethereum?.tps || 0;
            const scalingFactor = ethereumTps > 0 ? totalTps / ethereumTps : 0;

            return {
                projects,
                totalTps,
                ethereumTps,
                scalingFactor
            };
        } catch (error) {
            console.error('L2BEAT getActivity error:', error);
            return null;
        }
    }
};

export default l2beatAdapter;
