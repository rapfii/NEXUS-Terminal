/**
 * NEXUS Execution Reality Engine
 * Analyzes liquidity depth, spread, slippage, and fee impact to show TRUE cost of execution.
 * 
 * "Stop cosplaying, start executing."
 */

import type { Orderbook, Trade } from '../types';

// Standard fees (can be overridden)
const BASE_FEES = {
    taker: 0.0005, // 0.05%
    maker: 0.0002, // 0.02%
};

interface ExecutionAnalysis {
    symbol: string;
    side: 'buy' | 'sell';
    size: number;          // Size in base asset (e.g. 1 BTC)

    // Price breakdown
    marketPrice: number;   // Mid price or best tick
    averagePrice: number;  // Real execution price
    worstPrice: number;    // Price of last fill

    // Cost breakdown
    value: number;         // Nominal value (size * marketPrice)
    cost: number;          // Actual cost (marketPrice vs avgPrice difference)
    fees: number;          // Exchange fees
    slippage: number;      // Slippage amount in quote currency
    slippagePercent: number;

    // Impact
    priceImpact: number;   // % move in orderbook
    depthConsumed: number; // % of depth used

    // Rating
    liquidityRating: 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous';
    warning?: string;
}

/**
 * Calculate execution reality for a market order
 */
export function analyzeExecution(
    orderbook: Orderbook,
    size: number, // In base asset
    side: 'buy' | 'sell',
    feeRate: number = BASE_FEES.taker
): ExecutionAnalysis {
    const { bids, asks } = orderbook;

    // For buy order, we eat asks (lowest to highest)
    // For sell order, we eat bids (highest to lowest)
    const levels = side === 'buy' ? asks : bids;
    const bestPrice = levels[0]?.price || 0;

    if (!levels || levels.length === 0 || bestPrice === 0) {
        return {
            symbol: 'UNKNOWN',
            side,
            size,
            marketPrice: 0,
            averagePrice: 0,
            worstPrice: 0,
            value: 0,
            cost: 0,
            fees: 0,
            slippage: 0,
            slippagePercent: 0,
            priceImpact: 0,
            depthConsumed: 100,
            liquidityRating: 'dangerous',
            warning: 'Empty orderbook',
        };
    }

    let remainingSize = size;
    let totalCost = 0; // Usage of quote ccy (USD)
    let fillLevels = 0;
    let worstPrice = bestPrice;

    // Walk the book
    for (const level of levels) {
        const fillAmount = Math.min(remainingSize, level.size);
        totalCost += fillAmount * level.price;
        remainingSize -= fillAmount;
        worstPrice = level.price;
        fillLevels++;

        if (remainingSize <= 0.00000001) break; // Finished
    }

    // Did we clear the whole book?
    if (remainingSize > 0.0001) {
        return {
            symbol: 'UNKNOWN',
            side,
            size,
            marketPrice: bestPrice,
            averagePrice: 0,
            worstPrice: worstPrice,
            value: size * bestPrice,
            cost: Infinity,
            fees: 0,
            slippage: Infinity,
            slippagePercent: Infinity,
            priceImpact: 100,
            depthConsumed: 100,
            liquidityRating: 'dangerous',
            warning: `Insufficient liquidity. Filled ${(size - remainingSize).toFixed(4)} / ${size}`,
        };
    }

    const averagePrice = totalCost / size;
    const valueNominal = size * bestPrice;

    // Slippage = difference between ideal (best price) and actual (avg price)
    // For BUY: Avg > Best (Positive diff is bad)
    // For SELL: Avg < Best (Negative diff is bad)
    const slippageAmount = side === 'buy'
        ? totalCost - valueNominal
        : valueNominal - totalCost;

    const slippagePercent = (Math.abs(averagePrice - bestPrice) / bestPrice) * 100;

    // Price impact (move from start to end)
    const impact = (Math.abs(worstPrice - bestPrice) / bestPrice) * 100;

    // Fees
    const fees = totalCost * feeRate;

    // Rating
    let rating: ExecutionAnalysis['liquidityRating'] = 'excellent';
    if (slippagePercent > 0.1) rating = 'good';
    if (slippagePercent > 0.5) rating = 'fair';
    if (slippagePercent > 1.0) rating = 'poor';
    if (slippagePercent > 3.0) rating = 'dangerous';

    return {
        symbol: 'UNKNOWN', // Caller should set
        side,
        size,
        marketPrice: bestPrice,
        averagePrice,
        worstPrice,
        value: valueNominal,
        cost: slippageAmount + fees, // Total "lost" value
        fees,
        slippage: slippageAmount,
        slippagePercent,
        priceImpact: impact,
        depthConsumed: (fillLevels / levels.length) * 100, // Rough proxy
        liquidityRating: rating,
        warning: rating === 'dangerous' ? 'High slippage warning!' : undefined,
    };
}

/**
 * Compare execution across multiple exchanges
 */
export function compareExecution(
    exchanges: { name: string; orderbook: Orderbook }[],
    size: number,
    side: 'buy' | 'sell'
): { exchange: string; analysis: ExecutionAnalysis; rank: number }[] {
    const results = exchanges.map(ex => ({
        exchange: ex.name,
        analysis: analyzeExecution(ex.orderbook, size, side),
    }));

    // Sort by best average price (lowest for buy, highest for sell)
    return results.sort((a, b) => {
        if (side === 'buy') {
            return a.analysis.averagePrice - b.analysis.averagePrice;
        } else {
            return b.analysis.averagePrice - a.analysis.averagePrice;
        }
    }).map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Calculate "True Spread" including fees
 * A spread is only profitable if (Bid - Ask) > (TakerFee * 2)
 */
export function calculateTrueSpread(
    bid: number,
    ask: number,
    takerFee: number = BASE_FEES.taker
): { spread: number; spreadPercent: number; isProfitable: boolean; minMoveToProfit: number } {
    const rawSpread = ask - bid;
    const rawSpreadPercent = (rawSpread / ask) * 100;

    // Cost to enter and exit immediately
    const roundTripFeePercent = takerFee * 2 * 100;

    // True spread is what's left after fees
    // If negative, you start underwater
    const netSpreadPercent = rawSpreadPercent - roundTripFeePercent;

    return {
        spread: rawSpread,
        spreadPercent: rawSpreadPercent,
        isProfitable: netSpreadPercent > 0, // Should be always false for same-exchange spread
        minMoveToProfit: roundTripFeePercent, // How much price must move to breakeven
    };
}

const executionEngine = {
    analyzeExecution,
    compareExecution,
    calculateTrueSpread,
};

export default executionEngine;
