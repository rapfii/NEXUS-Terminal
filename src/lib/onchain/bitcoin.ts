/**
 * Bitcoin On-Chain Data Adapter
 * Combines Blockchain.info and Mempool.space APIs
 */

// API Endpoints
const BLOCKCHAIN_INFO = 'https://blockchain.info';
const MEMPOOL_SPACE = 'https://mempool.space/api';

export const bitcoinOnchainAdapter = {
    name: 'bitcoin-onchain' as const,

    // ============================================
    // BLOCKCHAIN.INFO APIs
    // ============================================

    /**
     * Get blockchain stats
     */
    async getStats(): Promise<{
        marketPriceUsd: number;
        hashRate: number;  // TH/s
        difficulty: number;
        blocksCount: number;
        totalBtcSent: number;
        estimatedBtcSent: number;
        minutesBetweenBlocks: number;
        totalFeesBtc: number;
        nTx: number;  // transactions
        totalBtcExisted: number;
        nextRetarget: number;
    } | null> {
        try {
            const res = await fetch(`${BLOCKCHAIN_INFO}/stats?format=json`, {
                next: { revalidate: 60 }
            });

            if (!res.ok) return null;

            const data = await res.json();

            return {
                marketPriceUsd: data.market_price_usd || 0,
                hashRate: (data.hash_rate || 0) / 1e12, // Convert to TH/s
                difficulty: data.difficulty || 0,
                blocksCount: data.n_blocks_total || 0,
                totalBtcSent: data.total_btc_sent / 1e8 || 0,
                estimatedBtcSent: data.estimated_btc_sent / 1e8 || 0,
                minutesBetweenBlocks: data.minutes_between_blocks || 10,
                totalFeesBtc: data.total_fees_btc / 1e8 || 0,
                nTx: data.n_tx || 0,
                totalBtcExisted: data.totalbc / 1e8 || 0,
                nextRetarget: data.nextretarget || 0,
            };
        } catch (error) {
            console.error('Blockchain.info getStats error:', error);
            return null;
        }
    },

    /**
     * Get current hashrate
     */
    async getHashrate(): Promise<number> {
        try {
            const res = await fetch(`${BLOCKCHAIN_INFO}/q/hashrate`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return 0;

            const hashrate = await res.text();
            return parseFloat(hashrate) / 1e9 || 0; // G to EH
        } catch (error) {
            console.error('Blockchain.info getHashrate error:', error);
            return 0;
        }
    },

    /**
     * Get unconfirmed transactions count
     */
    async getUnconfirmedCount(): Promise<number> {
        try {
            const res = await fetch(`${BLOCKCHAIN_INFO}/q/unconfirmedcount`, {
                next: { revalidate: 30 }
            });

            if (!res.ok) return 0;

            const count = await res.text();
            return parseInt(count) || 0;
        } catch (error) {
            console.error('Blockchain.info getUnconfirmedCount error:', error);
            return 0;
        }
    },

    // ============================================
    // MEMPOOL.SPACE APIs
    // ============================================

    /**
     * Get recommended fees
     */
    async getRecommendedFees(): Promise<{
        fastestFee: number;
        halfHourFee: number;
        hourFee: number;
        economyFee: number;
        minimumFee: number;
    } | null> {
        try {
            const res = await fetch(`${MEMPOOL_SPACE}/v1/fees/recommended`, {
                next: { revalidate: 30 }
            });

            if (!res.ok) return null;

            return await res.json();
        } catch (error) {
            console.error('Mempool.space getRecommendedFees error:', error);
            return null;
        }
    },

    /**
     * Get mempool stats
     */
    async getMempoolInfo(): Promise<{
        count: number;
        vsize: number;
        totalFee: number;
        feeHistogram: [number, number][];
    } | null> {
        try {
            const res = await fetch(`${MEMPOOL_SPACE}/mempool`, {
                next: { revalidate: 30 }
            });

            if (!res.ok) return null;

            const data = await res.json();

            return {
                count: data.count || 0,
                vsize: data.vsize || 0,
                totalFee: data.total_fee || 0,
                feeHistogram: data.fee_histogram || [],
            };
        } catch (error) {
            console.error('Mempool.space getMempoolInfo error:', error);
            return null;
        }
    },

    /**
     * Get recent blocks
     */
    async getRecentBlocks(count: number = 10): Promise<{
        id: string;
        height: number;
        timestamp: number;
        txCount: number;
        size: number;
        weight: number;
        medianFee: number;
    }[]> {
        try {
            const res = await fetch(`${MEMPOOL_SPACE}/v1/blocks`, {
                next: { revalidate: 60 }
            });

            if (!res.ok) return [];

            const data = await res.json();

            return data.slice(0, count).map((b: any) => ({
                id: b.id,
                height: b.height,
                timestamp: b.timestamp,
                txCount: b.tx_count,
                size: b.size,
                weight: b.weight,
                medianFee: b.extras?.medianFee || 0,
            }));
        } catch (error) {
            console.error('Mempool.space getRecentBlocks error:', error);
            return [];
        }
    },

    /**
     * Get difficulty adjustment info
     */
    async getDifficultyAdjustment(): Promise<{
        progressPercent: number;
        difficultyChange: number;
        estimatedRetargetDate: number;
        remainingBlocks: number;
        remainingTime: number;
        previousRetarget: number;
    } | null> {
        try {
            const res = await fetch(`${MEMPOOL_SPACE}/v1/difficulty-adjustment`, {
                next: { revalidate: 300 }
            });

            if (!res.ok) return null;

            const data = await res.json();

            return {
                progressPercent: data.progressPercent || 0,
                difficultyChange: data.difficultyChange || 0,
                estimatedRetargetDate: data.estimatedRetargetDate || 0,
                remainingBlocks: data.remainingBlocks || 0,
                remainingTime: data.remainingTime || 0,
                previousRetarget: data.previousRetarget || 0,
            };
        } catch (error) {
            console.error('Mempool.space getDifficultyAdjustment error:', error);
            return null;
        }
    },

    /**
     * Get aggregated on-chain summary
     */
    async getSummary(): Promise<{
        hashRate: number;
        difficulty: number;
        mempoolCount: number;
        mempoolSize: number;
        fastestFee: number;
        hourFee: number;
        economyFee: number;
        blocksToRetarget: number;
        difficultyChange: number;
        avgBlockTime: number;
    } | null> {
        try {
            const [stats, mempool, fees, difficulty] = await Promise.allSettled([
                this.getStats(),
                this.getMempoolInfo(),
                this.getRecommendedFees(),
                this.getDifficultyAdjustment(),
            ]);

            const statsData = stats.status === 'fulfilled' ? stats.value : null;
            const mempoolData = mempool.status === 'fulfilled' ? mempool.value : null;
            const feesData = fees.status === 'fulfilled' ? fees.value : null;
            const diffData = difficulty.status === 'fulfilled' ? difficulty.value : null;

            return {
                hashRate: statsData?.hashRate || 0,
                difficulty: statsData?.difficulty || 0,
                mempoolCount: mempoolData?.count || 0,
                mempoolSize: mempoolData?.vsize || 0,
                fastestFee: feesData?.fastestFee || 0,
                hourFee: feesData?.hourFee || 0,
                economyFee: feesData?.economyFee || 0,
                blocksToRetarget: diffData?.remainingBlocks || 0,
                difficultyChange: diffData?.difficultyChange || 0,
                avgBlockTime: statsData?.minutesBetweenBlocks || 10,
            };
        } catch (error) {
            console.error('Bitcoin getSummary error:', error);
            return null;
        }
    },
};

export default bitcoinOnchainAdapter;
