/**
 * NEXUS Arbitrage Calculator
 * Depth-aware, fee-accurate arbitrage detection
 * 
 * This is the HONEST arb engine that:
 * 1. Uses actual orderbook depth, not price spread
 * 2. Calculates slippage based on size vs liquidity
 * 3. Applies tiered fee structure
 * 4. Accounts for withdrawal/settlement time
 * 5. Only shows executable opportunities
 */

import type { OrderbookLevel } from '@/lib/types';

// ============================================
// TYPES
// ============================================

export interface ExchangeOrderbook {
    exchange: string;
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    bestBid: number;
    bestAsk: number;
    timestamp: number;
}

export interface FeeSchedule {
    maker: number;         // basis points
    taker: number;         // basis points
    volumeTiers?: {
        volume: number;    // 30d volume in USD
        maker: number;
        taker: number;
    }[];
    withdrawalFee: number; // in asset units (e.g., 0.0005 BTC)
    withdrawalTime: string; // e.g., "~30 min"
}

export interface SlippageResult {
    averagePrice: number;
    totalFilled: number;
    slippageAmount: number;   // absolute
    slippagePercent: number;  // percentage
    levelsConsumed: number;   // how deep we went
    remainingSize: number;    // unfilled if book too thin
}

export interface ArbOpportunity {
    buyExchange: string;
    sellExchange: string;

    // Prices
    buyPrice: number;         // effective price after slippage
    sellPrice: number;        // effective price after slippage
    rawSpread: number;        // best bid - best ask
    effectiveSpread: number;  // sell price - buy price after slippage

    // Slippage
    buySlippage: SlippageResult;
    sellSlippage: SlippageResult;

    // Costs
    buyFee: number;           // USD
    sellFee: number;          // USD
    totalFees: number;        // USD
    withdrawalFee: number;    // USD

    // Profit
    grossProfit: number;      // before fees
    netProfit: number;        // after all costs
    netProfitPercent: number; // ROI on trade size

    // Execution
    executable: boolean;      // true only if profitable after everything
    executionNotes: string[]; // warnings or issues
    settlementTime: string;   // estimated time to complete

    timestamp: number;
}

export interface ArbAnalysis {
    tradeSize: number;
    symbol: string;
    opportunities: ArbOpportunity[];
    bestOpportunity: ArbOpportunity | null;
    marketStats: {
        exchangeCount: number;
        averageSpread: number;
        liquidityScore: number;  // 0-100
    };
    timestamp: number;
}

// ============================================
// FEE SCHEDULES (Tiered by Volume)
// ============================================

export const FEE_SCHEDULES: Record<string, FeeSchedule> = {
    binance: {
        maker: 10, taker: 10,
        volumeTiers: [
            { volume: 0, maker: 10, taker: 10 },
            { volume: 1_000_000, maker: 9, taker: 10 },
            { volume: 5_000_000, maker: 8, taker: 9 },
            { volume: 20_000_000, maker: 7, taker: 8 },
            { volume: 100_000_000, maker: 5, taker: 6 },
        ],
        withdrawalFee: 0.0005,
        withdrawalTime: '~30 min (on-chain)',
    },
    bybit: {
        maker: 10, taker: 10,
        volumeTiers: [
            { volume: 0, maker: 10, taker: 10 },
            { volume: 2_500_000, maker: 8, taker: 10 },
            { volume: 10_000_000, maker: 6, taker: 8 },
        ],
        withdrawalFee: 0.0005,
        withdrawalTime: '~30 min (on-chain)',
    },
    okx: {
        maker: 8, taker: 10,
        volumeTiers: [
            { volume: 0, maker: 8, taker: 10 },
            { volume: 5_000_000, maker: 6, taker: 8 },
            { volume: 25_000_000, maker: 4, taker: 6 },
        ],
        withdrawalFee: 0.0004,
        withdrawalTime: '~20 min (on-chain)',
    },
    kucoin: {
        maker: 10, taker: 10,
        withdrawalFee: 0.0005,
        withdrawalTime: '~30 min (on-chain)',
    },
    gateio: {
        maker: 15, taker: 15,
        withdrawalFee: 0.001,
        withdrawalTime: '~30 min (on-chain)',
    },
    bitget: {
        maker: 10, taker: 10,
        withdrawalFee: 0.0006,
        withdrawalTime: '~30 min (on-chain)',
    },
    kraken: {
        maker: 16, taker: 26,
        volumeTiers: [
            { volume: 0, maker: 16, taker: 26 },
            { volume: 50_000, maker: 14, taker: 24 },
            { volume: 100_000, maker: 12, taker: 22 },
            { volume: 1_000_000, maker: 8, taker: 18 },
        ],
        withdrawalFee: 0.00015,
        withdrawalTime: '~15 min (on-chain)',
    },
};

// ============================================
// SLIPPAGE CALCULATION
// ============================================

/**
 * Calculate actual slippage by walking the orderbook
 * This is the HONEST way - no guessing
 */
export function calculateSlippage(
    levels: OrderbookLevel[],
    sizeUSD: number,
    side: 'buy' | 'sell'
): SlippageResult {
    if (levels.length === 0) {
        return {
            averagePrice: 0,
            totalFilled: 0,
            slippageAmount: 0,
            slippagePercent: 0,
            levelsConsumed: 0,
            remainingSize: sizeUSD,
        };
    }

    const bestPrice = levels[0].price;
    let remainingUSD = sizeUSD;
    let totalValueFilled = 0;
    let totalQtyFilled = 0;
    let levelsConsumed = 0;

    for (const level of levels) {
        if (remainingUSD <= 0) break;

        const levelValueUSD = level.price * level.size;
        const fillValue = Math.min(remainingUSD, levelValueUSD);
        const fillQty = fillValue / level.price;

        totalValueFilled += fillValue;
        totalQtyFilled += fillQty;
        remainingUSD -= fillValue;
        levelsConsumed++;
    }

    const averagePrice = totalQtyFilled > 0 ? totalValueFilled / totalQtyFilled : bestPrice;
    const slippageAmount = side === 'buy'
        ? averagePrice - bestPrice
        : bestPrice - averagePrice;
    const slippagePercent = bestPrice > 0 ? (slippageAmount / bestPrice) * 100 : 0;

    return {
        averagePrice,
        totalFilled: totalValueFilled,
        slippageAmount: Math.abs(slippageAmount),
        slippagePercent: Math.abs(slippagePercent),
        levelsConsumed,
        remainingSize: Math.max(0, remainingUSD),
    };
}

/**
 * Get fee rate for a given volume tier
 */
export function getFeeRate(
    exchange: string,
    side: 'maker' | 'taker',
    volume30d: number = 0
): number {
    const schedule = FEE_SCHEDULES[exchange];
    if (!schedule) return 10; // default

    if (schedule.volumeTiers && volume30d > 0) {
        const tier = [...schedule.volumeTiers]
            .reverse()
            .find(t => volume30d >= t.volume);
        if (tier) return tier[side];
    }

    return schedule[side];
}

// ============================================
// ARBITRAGE DETECTION
// ============================================

/**
 * Analyze arbitrage opportunity between two exchanges
 */
export function analyzeArbPair(
    buyBook: ExchangeOrderbook,
    sellBook: ExchangeOrderbook,
    sizeUSD: number,
    currentPrice: number,
    volume30d: number = 0
): ArbOpportunity | null {
    const notes: string[] = [];

    // Calculate slippage on both sides
    const buySlippage = calculateSlippage(buyBook.asks, sizeUSD, 'buy');
    const sellSlippage = calculateSlippage(sellBook.bids, sizeUSD, 'sell');

    // Warn if book too thin
    if (buySlippage.remainingSize > 0) {
        notes.push(`Buy book too thin: ${((buySlippage.remainingSize / sizeUSD) * 100).toFixed(1)}% unfilled`);
    }
    if (sellSlippage.remainingSize > 0) {
        notes.push(`Sell book too thin: ${((sellSlippage.remainingSize / sizeUSD) * 100).toFixed(1)}% unfilled`);
    }

    // Get fee rates
    const buyFeeRate = getFeeRate(buyBook.exchange, 'taker', volume30d);
    const sellFeeRate = getFeeRate(sellBook.exchange, 'taker', volume30d);

    // Calculate costs
    const buyFee = (buyFeeRate / 10000) * sizeUSD;
    const sellFee = (sellFeeRate / 10000) * sizeUSD;
    const totalFees = buyFee + sellFee;

    // Withdrawal fee (in USD)
    const buySchedule = FEE_SCHEDULES[buyBook.exchange];
    const withdrawalFeeAsset = buySchedule?.withdrawalFee || 0.0005;
    const withdrawalFee = withdrawalFeeAsset * currentPrice;

    // Calculate spread
    const rawSpread = sellBook.bestBid - buyBook.bestAsk;
    const effectiveSpread = sellSlippage.averagePrice - buySlippage.averagePrice;

    // Calculate profit
    const tradeQty = sizeUSD / buySlippage.averagePrice;
    const grossProfit = tradeQty * effectiveSpread;
    const netProfit = grossProfit - totalFees - withdrawalFee;
    const netProfitPercent = (netProfit / sizeUSD) * 100;

    // Determine if executable
    const executable = netProfit > 0 &&
        buySlippage.remainingSize === 0 &&
        sellSlippage.remainingSize === 0;

    if (!executable && netProfit <= 0 && rawSpread > 0) {
        notes.push('Raw spread exists but fees/slippage eliminate profit');
    }

    // Settlement time
    const settlementTime = buySchedule?.withdrawalTime || '~30 min';

    return {
        buyExchange: buyBook.exchange,
        sellExchange: sellBook.exchange,
        buyPrice: buySlippage.averagePrice,
        sellPrice: sellSlippage.averagePrice,
        rawSpread,
        effectiveSpread,
        buySlippage,
        sellSlippage,
        buyFee,
        sellFee,
        totalFees,
        withdrawalFee,
        grossProfit,
        netProfit,
        netProfitPercent,
        executable,
        executionNotes: notes,
        settlementTime,
        timestamp: Date.now(),
    };
}

/**
 * Full arbitrage analysis across all exchange pairs
 */
export function analyzeArbitrage(
    orderbooks: ExchangeOrderbook[],
    sizeUSD: number,
    currentPrice: number,
    volume30d: number = 0
): ArbAnalysis {
    const opportunities: ArbOpportunity[] = [];

    // Compare all pairs
    for (let i = 0; i < orderbooks.length; i++) {
        for (let j = 0; j < orderbooks.length; j++) {
            if (i === j) continue;

            const buyBook = orderbooks[i];
            const sellBook = orderbooks[j];

            // Only check if there's a raw spread
            if (sellBook.bestBid > buyBook.bestAsk) {
                const opp = analyzeArbPair(
                    buyBook,
                    sellBook,
                    sizeUSD,
                    currentPrice,
                    volume30d
                );
                if (opp) {
                    opportunities.push(opp);
                }
            }
        }
    }

    // Sort by net profit
    opportunities.sort((a, b) => b.netProfit - a.netProfit);

    // Calculate market stats
    const allSpreads = orderbooks.map(ob => {
        const spread = ob.bestAsk - ob.bestBid;
        return ob.bestBid > 0 ? (spread / ob.bestBid) * 10000 : 0;
    });
    const avgSpread = allSpreads.length > 0
        ? allSpreads.reduce((a, b) => a + b, 0) / allSpreads.length
        : 0;

    // Liquidity score based on how much can be filled at 0.1% slippage
    const targetSlippage = 0.001; // 0.1%
    const maxFillable = orderbooks.reduce((max, ob) => {
        let fillable = 0;
        let price = ob.bestAsk;
        for (const level of ob.asks) {
            if (level.price > price * (1 + targetSlippage)) break;
            fillable += level.price * level.size;
        }
        return Math.max(max, fillable);
    }, 0);
    const liquidityScore = Math.min(100, (maxFillable / 1_000_000) * 100);

    return {
        tradeSize: sizeUSD,
        symbol: orderbooks[0]?.exchange || 'UNKNOWN',
        opportunities,
        bestOpportunity: opportunities.find(o => o.executable) || null,
        marketStats: {
            exchangeCount: orderbooks.length,
            averageSpread: avgSpread,
            liquidityScore,
        },
        timestamp: Date.now(),
    };
}

const arbCalculator = {
    calculateSlippage,
    getFeeRate,
    analyzeArbPair,
    analyzeArbitrage,
    FEE_SCHEDULES,
};

export default arbCalculator;
