/**
 * NEXUS Data Aggregator
 * Cross-exchange aggregation for OI, Funding, Positioning, and Liquidations
 * 
 * This is the core intelligence layer that transforms raw exchange data
 * into actionable market intelligence.
 */

import { binanceAdapter } from './exchanges/binance';
import { bybitAdapter } from './exchanges/bybit';
import { okxAdapter } from './exchanges/okx';
import { recordOI, getOIChange, recordPrice, PERIODS } from './cache-service';
import type {
    AggregatedPositioning,
    PositioningData,
    LiquidationCluster,
    LiquidationHeatmap,
    Liquidation,
    ExtendedExchange
} from './types-extended';

// ============================================
// TYPES
// ============================================

export interface AggregatedDerivatives {
    symbol: string;
    timestamp: number;

    // Open Interest
    totalOI: number;              // Sum across exchanges
    totalOIValue: number;         // USD value
    oiChange1h: number;           // Percent change
    oiChange24h: number;          // Percent change
    oiTrend: 'expanding' | 'contracting' | 'stable';

    // Funding
    weightedFunding: number;      // Volume-weighted avg
    fundingBias: 'long_paying' | 'short_paying' | 'neutral';
    fundingHeat: 'extreme' | 'elevated' | 'normal';

    // Positioning
    avgLongRatio: number;
    avgShortRatio: number;
    positionBias: 'long_heavy' | 'short_heavy' | 'balanced';

    // Per-exchange breakdown
    exchanges: {
        name: ExtendedExchange;
        oi: number;
        oiValue: number;
        funding: number;
        longRatio: number;
        shortRatio: number;
        volume24h: number;
    }[];
}

export interface AggregatedLiquidations {
    symbol: string;
    timestamp: number;

    // Totals
    longLiqs1h: number;
    shortLiqs1h: number;
    longLiqs24h: number;
    shortLiqs24h: number;
    longValue1h: number;
    shortValue1h: number;
    longValue24h: number;
    shortValue24h: number;

    // Pressure indicator
    pressure: 'long_pain' | 'short_pain' | 'balanced';
    pressureIntensity: number;    // 0-100

    // Recent large liquidations
    recentLarge: Liquidation[];

    // Clusters near current price
    clusters: LiquidationCluster[];
}

export interface MarketPressure {
    symbol: string;
    currentPrice: number;
    timestamp: number;

    // Who is trapped?
    longsTrapped: boolean;
    shortsTrapped: boolean;
    trappedSide: 'longs' | 'shorts' | 'both' | 'none';

    // Where is the pressure?
    nearestLongLiqPrice: number;
    nearestShortLiqPrice: number;
    longLiqDistance: number;      // % from current price
    shortLiqDistance: number;     // % from current price

    // How much is at risk?
    longValueAtRisk: number;      // USD within 5% of price
    shortValueAtRisk: number;     // USD within 5% of price

    // Squeeze probability
    squeezeProbability: number;   // 0-100
    squeezeDirection: 'long' | 'short' | null;
}

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

/**
 * Aggregate derivatives data across exchanges
 */
export async function aggregateDerivatives(symbol: string): Promise<AggregatedDerivatives | null> {
    const formattedSymbol = symbol.replace('-', '').replace('/', '');

    // Fetch from all exchanges in parallel
    const [binanceData, bybitData, okxData] = await Promise.allSettled([
        fetchBinanceDerivatives(formattedSymbol),
        fetchBybitDerivatives(formattedSymbol),
        fetchOKXDerivatives(formattedSymbol),
    ]);

    const exchanges: AggregatedDerivatives['exchanges'] = [];
    let totalOI = 0;
    let totalOIValue = 0;
    let totalVolume = 0;
    let weightedFundingSum = 0;
    let longRatioSum = 0;
    let shortRatioSum = 0;
    let validExchanges = 0;

    // Process Binance
    if (binanceData.status === 'fulfilled' && binanceData.value) {
        const d = binanceData.value;
        exchanges.push({
            name: 'binance',
            oi: d.oi,
            oiValue: d.oiValue,
            funding: d.funding,
            longRatio: d.longRatio,
            shortRatio: d.shortRatio,
            volume24h: d.volume24h,
        });
        totalOI += d.oi;
        totalOIValue += d.oiValue;
        totalVolume += d.volume24h;
        weightedFundingSum += d.funding * d.volume24h;
        longRatioSum += d.longRatio;
        shortRatioSum += d.shortRatio;
        validExchanges++;
    }

    // Process Bybit
    if (bybitData.status === 'fulfilled' && bybitData.value) {
        const d = bybitData.value;
        exchanges.push({
            name: 'bybit',
            oi: d.oi,
            oiValue: d.oiValue,
            funding: d.funding,
            longRatio: d.longRatio,
            shortRatio: d.shortRatio,
            volume24h: d.volume24h,
        });
        totalOI += d.oi;
        totalOIValue += d.oiValue;
        totalVolume += d.volume24h;
        weightedFundingSum += d.funding * d.volume24h;
        longRatioSum += d.longRatio;
        shortRatioSum += d.shortRatio;
        validExchanges++;
    }

    // Process OKX
    if (okxData.status === 'fulfilled' && okxData.value) {
        const d = okxData.value;
        exchanges.push({
            name: 'okx',
            oi: d.oi,
            oiValue: d.oiValue,
            funding: d.funding,
            longRatio: d.longRatio,
            shortRatio: d.shortRatio,
            volume24h: d.volume24h,
        });
        totalOI += d.oi;
        totalOIValue += d.oiValue;
        totalVolume += d.volume24h;
        weightedFundingSum += d.funding * d.volume24h;
        longRatioSum += d.longRatio;
        shortRatioSum += d.shortRatio;
        validExchanges++;
    }

    if (validExchanges === 0) {
        return null;
    }

    // Calculate weighted funding
    const weightedFunding = totalVolume > 0 ? weightedFundingSum / totalVolume : 0;

    // Calculate average ratios
    const avgLongRatio = longRatioSum / validExchanges;
    const avgShortRatio = shortRatioSum / validExchanges;

    // Determine biases
    const fundingBias: AggregatedDerivatives['fundingBias'] =
        weightedFunding > 0.0001 ? 'long_paying' :
            weightedFunding < -0.0001 ? 'short_paying' : 'neutral';

    const fundingHeat: AggregatedDerivatives['fundingHeat'] =
        Math.abs(weightedFunding) > 0.0003 ? 'extreme' :
            Math.abs(weightedFunding) > 0.0001 ? 'elevated' : 'normal';

    const positionBias: AggregatedDerivatives['positionBias'] =
        avgLongRatio > 0.55 ? 'long_heavy' :
            avgShortRatio > 0.55 ? 'short_heavy' : 'balanced';

    // Record current OI snapshot for future delta calculations
    recordOI(symbol, totalOI, totalOIValue);

    // Get OI changes from cache
    const oiChange1h = getOIChange(symbol, PERIODS.ONE_HOUR);
    const oiChange24h = getOIChange(symbol, PERIODS.ONE_DAY);

    // Determine OI trend from actual data
    const oiTrend: AggregatedDerivatives['oiTrend'] =
        oiChange1h > 2 ? 'expanding' :
            oiChange1h < -2 ? 'contracting' : 'stable';

    return {
        symbol,
        timestamp: Date.now(),
        totalOI,
        totalOIValue,
        oiChange1h,
        oiChange24h,
        oiTrend,
        weightedFunding,
        fundingBias,
        fundingHeat,
        avgLongRatio,
        avgShortRatio,
        positionBias,
        exchanges,
    };
}

/**
 * Aggregate liquidations across exchanges
 */
export async function aggregateLiquidations(symbol: string): Promise<AggregatedLiquidations | null> {
    const formattedSymbol = symbol.replace('-', '').replace('/', '');
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Fetch liquidations from exchanges
    const [binanceLiqs, okxLiqs] = await Promise.allSettled([
        binanceAdapter.getLiquidations(formattedSymbol, 1000),
        okxAdapter.getLiquidations('SWAP', symbol.split('USDT')[0]),
    ]);

    const allLiquidations: Liquidation[] = [];

    // Process Binance liquidations
    if (binanceLiqs.status === 'fulfilled') {
        for (const liq of binanceLiqs.value) {
            allLiquidations.push({
                id: `binance-${liq.timestamp}-${liq.price}`,
                exchange: 'binance',
                symbol: liq.symbol,
                side: liq.side,
                price: liq.price,
                quantity: liq.quantity,
                value: liq.value,
                timestamp: liq.timestamp,
            });
        }
    }

    // Process OKX liquidations
    if (okxLiqs.status === 'fulfilled') {
        for (const liq of okxLiqs.value) {
            allLiquidations.push({
                id: `okx-${liq.ts}-${liq.price}`,
                exchange: 'okx',
                symbol: liq.instId,
                side: liq.side,
                price: liq.price,
                quantity: liq.sz,
                value: liq.price * liq.sz,
                timestamp: liq.ts,
            });
        }
    }

    // Calculate totals
    let longLiqs1h = 0, shortLiqs1h = 0;
    let longLiqs24h = 0, shortLiqs24h = 0;
    let longValue1h = 0, shortValue1h = 0;
    let longValue24h = 0, shortValue24h = 0;

    for (const liq of allLiquidations) {
        if (liq.timestamp >= oneDayAgo) {
            if (liq.side === 'long') {
                longLiqs24h++;
                longValue24h += liq.value;
            } else {
                shortLiqs24h++;
                shortValue24h += liq.value;
            }
        }
        if (liq.timestamp >= oneHourAgo) {
            if (liq.side === 'long') {
                longLiqs1h++;
                longValue1h += liq.value;
            } else {
                shortLiqs1h++;
                shortValue1h += liq.value;
            }
        }
    }

    // Determine pressure
    const totalLong = longValue24h;
    const totalShort = shortValue24h;
    const total = totalLong + totalShort;

    let pressure: AggregatedLiquidations['pressure'] = 'balanced';
    let pressureIntensity = 0;

    if (total > 0) {
        const longRatio = totalLong / total;
        if (longRatio > 0.65) {
            pressure = 'long_pain';
            pressureIntensity = Math.min(100, (longRatio - 0.5) * 200);
        } else if (longRatio < 0.35) {
            pressure = 'short_pain';
            pressureIntensity = Math.min(100, (0.5 - longRatio) * 200);
        }
    }

    // Get recent large liquidations (> $100k)
    const recentLarge = allLiquidations
        .filter(l => l.value >= 100000 && l.timestamp >= oneHourAgo)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

    // Build clusters (simplified - group by price levels)
    const clusters = buildLiquidationClusters(allLiquidations, 0);

    return {
        symbol,
        timestamp: now,
        longLiqs1h,
        shortLiqs1h,
        longLiqs24h,
        shortLiqs24h,
        longValue1h,
        shortValue1h,
        longValue24h,
        shortValue24h,
        pressure,
        pressureIntensity,
        recentLarge,
        clusters,
    };
}

/**
 * Calculate market pressure - who is trapped and where
 */
export async function calculateMarketPressure(symbol: string): Promise<MarketPressure | null> {
    const [derivatives, liquidations] = await Promise.all([
        aggregateDerivatives(symbol),
        aggregateLiquidations(symbol),
    ]);

    if (!derivatives) return null;

    // Get current price from first exchange
    const currentPrice = derivatives.exchanges[0]?.oi > 0
        ? await getCurrentPrice(symbol)
        : 0;

    if (currentPrice === 0) return null;

    // Analyze trapped positions
    const { funding, longRatio, shortRatio } = {
        funding: derivatives.weightedFunding,
        longRatio: derivatives.avgLongRatio,
        shortRatio: derivatives.avgShortRatio,
    };

    // Longs are trapped when:
    // - Price dropping + high long ratio + positive funding (longs paying to stay in losing positions)
    const longsTrapped = longRatio > 0.55 && funding > 0.0001;

    // Shorts are trapped when:
    // - Price rising + high short ratio + negative funding
    const shortsTrapped = shortRatio > 0.55 && funding < -0.0001;

    const trappedSide: MarketPressure['trappedSide'] =
        longsTrapped && shortsTrapped ? 'both' :
            longsTrapped ? 'longs' :
                shortsTrapped ? 'shorts' : 'none';

    // Calculate value at risk from liquidation data
    const longValueAtRisk = liquidations?.clusters
        .filter(c => c.priceLevelPercent < 0 && c.priceLevelPercent > -5) // Below price
        .reduce((sum, c) => sum + c.longValue, 0) || 0;

    const shortValueAtRisk = liquidations?.clusters
        .filter(c => c.priceLevelPercent > 0 && c.priceLevelPercent < 5) // Above price
        .reduce((sum, c) => sum + c.shortValue, 0) || 0;

    // Find nearest liquidation levels
    const nearestLongCluster = liquidations?.clusters
        .filter(c => c.priceLevelPercent < 0)
        .sort((a, b) => b.priceLevelPercent - a.priceLevelPercent)[0];

    const nearestShortCluster = liquidations?.clusters
        .filter(c => c.priceLevelPercent > 0)
        .sort((a, b) => a.priceLevelPercent - b.priceLevelPercent)[0];

    // Calculate squeeze probability
    let squeezeProbability = 0;
    let squeezeDirection: MarketPressure['squeezeDirection'] = null;

    if (longsTrapped && longValueAtRisk > 1000000) {
        squeezeProbability = Math.min(90, 40 + (longRatio - 0.5) * 100 + (funding * 10000));
        squeezeDirection = 'short'; // Shorts would squeeze longs
    } else if (shortsTrapped && shortValueAtRisk > 1000000) {
        squeezeProbability = Math.min(90, 40 + (shortRatio - 0.5) * 100 + (Math.abs(funding) * 10000));
        squeezeDirection = 'long'; // Longs would squeeze shorts (short squeeze)
    }

    return {
        symbol,
        currentPrice,
        timestamp: Date.now(),
        longsTrapped,
        shortsTrapped,
        trappedSide,
        nearestLongLiqPrice: nearestLongCluster?.priceLevel || 0,
        nearestShortLiqPrice: nearestShortCluster?.priceLevel || 0,
        longLiqDistance: nearestLongCluster?.priceLevelPercent || 0,
        shortLiqDistance: nearestShortCluster?.priceLevelPercent || 0,
        longValueAtRisk,
        shortValueAtRisk,
        squeezeProbability,
        squeezeDirection,
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchBinanceDerivatives(symbol: string) {
    try {
        const [ticker, oi, funding, lsRatio] = await Promise.all([
            binanceAdapter.getInstrument(symbol, 'perpetual'),
            binanceAdapter.getOpenInterest(symbol),
            binanceAdapter.getFunding(symbol),
            binanceAdapter.getGlobalLongShortRatio(symbol, '1h', 1),
        ]);

        if (!ticker || !oi) return null;

        const latestRatio = lsRatio[0];
        return {
            oi: oi.openInterest, // Use openInterest field
            oiValue: oi.openInterestValue,
            funding: funding?.rate || 0,
            longRatio: latestRatio?.longAccountRatio || 0.5,
            shortRatio: latestRatio?.shortAccountRatio || 0.5,
            volume24h: ticker.volume24h * ticker.price,
        };
    } catch (e) {
        console.error('Binance derivatives fetch error:', e);
        return null;
    }
}

async function fetchBybitDerivatives(symbol: string) {
    try {
        const [ticker, lsRatio] = await Promise.all([
            bybitAdapter.getTicker(symbol),
            bybitAdapter.getLongShortRatio(symbol, '1h', 1),
        ]);

        if (!ticker) return null;

        const latestRatio = lsRatio[0];
        return {
            oi: ticker.openInterest,
            oiValue: ticker.openInterestValue,
            funding: ticker.fundingRate,
            longRatio: latestRatio?.buyRatio || 0.5,
            shortRatio: latestRatio?.sellRatio || 0.5,
            volume24h: ticker.volume24h,
        };
    } catch (e) {
        console.error('Bybit derivatives fetch error:', e);
        return null;
    }
}

async function fetchOKXDerivatives(symbol: string) {
    try {
        const instId = symbol.replace('USDT', '-USDT-SWAP');
        const [ticker, oi, funding] = await Promise.all([
            okxAdapter.getTicker(symbol, 'SWAP'),
            okxAdapter.getOpenInterest(symbol),
            okxAdapter.getFundingRate(symbol),
        ]);

        if (!ticker || !oi) return null;

        return {
            oi: oi.oiCcy,
            oiValue: oi.oi,
            funding: funding?.fundingRate || 0,
            longRatio: 0.5, // OKX doesn't provide public L/S ratio
            shortRatio: 0.5,
            volume24h: ticker.volCcy24h,
        };
    } catch (e) {
        console.error('OKX derivatives fetch error:', e);
        return null;
    }
}

function buildLiquidationClusters(
    liquidations: Liquidation[],
    currentPrice: number
): LiquidationCluster[] {
    if (liquidations.length === 0 || currentPrice === 0) {
        return [];
    }

    // Group by 1% price buckets
    const bucketSize = currentPrice * 0.01;
    const buckets = new Map<number, LiquidationCluster>();

    for (const liq of liquidations) {
        const bucketKey = Math.floor(liq.price / bucketSize) * bucketSize;

        if (!buckets.has(bucketKey)) {
            const priceLevelPercent = ((bucketKey - currentPrice) / currentPrice) * 100;
            buckets.set(bucketKey, {
                priceLevel: bucketKey,
                priceLevelPercent,
                longLiquidations: 0,
                shortLiquidations: 0,
                longValue: 0,
                shortValue: 0,
                totalValue: 0,
                intensity: 0,
            });
        }

        const cluster = buckets.get(bucketKey)!;
        if (liq.side === 'long') {
            cluster.longLiquidations++;
            cluster.longValue += liq.value;
        } else {
            cluster.shortLiquidations++;
            cluster.shortValue += liq.value;
        }
        cluster.totalValue = cluster.longValue + cluster.shortValue;
    }

    // Calculate intensity (normalize by max value)
    const clusters = Array.from(buckets.values());
    const maxValue = Math.max(...clusters.map(c => c.totalValue), 1);

    for (const cluster of clusters) {
        cluster.intensity = cluster.totalValue / maxValue;
    }

    return clusters.sort((a, b) => b.totalValue - a.totalValue).slice(0, 20);
}

async function getCurrentPrice(symbol: string): Promise<number> {
    try {
        const ticker = await binanceAdapter.getInstrument(symbol.replace('-', ''), 'perpetual');
        return ticker?.price || 0;
    } catch {
        return 0;
    }
}

// ============================================
// EXPORTS
// ============================================

const dataAggregator = {
    aggregateDerivatives,
    aggregateLiquidations,
    calculateMarketPressure,
};

export default dataAggregator;
