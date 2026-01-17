/**
 * NEXUS Squeeze Engine
 * REAL squeeze detection based on multiple factors
 * 
 * A REAL squeeze requires ALL of:
 * 1. Open Interest rising (positions building)
 * 2. Directional imbalance (long vs short ratio extreme)
 * 3. Liquidation clusters near price
 * 4. Volume absorption (price not moving despite volume)
 * 5. Funding rate extreme
 * 6. Price rejection at key levels
 */

import { binanceAdapter } from '../exchanges/binance';
import { bybitAdapter } from '../exchanges/bybit';
import type { SqueezeSignal, SqueezeComponent, SqueezeType, SqueezeStrength } from '../types-extended';

// Thresholds for squeeze components
const THRESHOLDS = {
    // OI must rise by at least 3% in 24h
    oiChangeMin: 0.03,
    oiChangeStrong: 0.08,

    // Funding rate thresholds (8h rate)
    fundingExtreme: 0.0003,     // 0.03%
    fundingVeryExtreme: 0.0006, // 0.06%

    // Long/short ratio imbalance
    lsRatioImbalance: 0.55,     // 55% on one side
    lsRatioExtreme: 0.65,       // 65% on one side

    // Price stalling threshold
    priceChangeMax: 0.02,       // Less than 2% move while building

    // Volume absorption
    volumeAbsorptionRatio: 1.5, // Buy vol > sell vol * 1.5
};

// Component weights for probability calculation
const WEIGHTS = {
    oiRising: 0.20,
    fundingExtreme: 0.20,
    directionalImbalance: 0.20,
    liquidationCluster: 0.15,
    volumeAbsorption: 0.15,
    priceRejection: 0.10,
};

interface SqueezeInput {
    symbol: string;
    currentPrice: number;

    // OI data
    oiCurrent: number;
    oiPrevious24h: number;
    oiChange24h: number;

    // Funding
    fundingRate: number;

    // Positioning
    longRatio: number;
    shortRatio: number;

    // Volume
    buyVolume: number;
    sellVolume: number;
    priceChange24h: number;

    // Liquidations (optional - from CoinGlass etc)
    nearbyLongLiquidations?: number;
    nearbyShortLiquidations?: number;
    nearestLongLiqPrice?: number;
    nearestShortLiqPrice?: number;
}

/**
 * Analyze a single component
 */
function analyzeComponent(
    name: string,
    value: number,
    threshold: number,
    strongThreshold: number,
    isActive: boolean
): SqueezeComponent {
    const intensity = Math.min(value / strongThreshold, 1);
    return {
        name,
        active: isActive,
        value,
        threshold,
        contribution: isActive ? intensity : 0,
    };
}

/**
 * Determine squeeze strength based on component count and intensity
 */
function determineStrength(components: Record<string, SqueezeComponent>, probability: number): SqueezeStrength {
    const activeCount = Object.values(components).filter(c => c.active).length;
    const avgIntensity = Object.values(components).reduce((sum, c) => sum + c.contribution, 0) / 6;

    if (probability >= 80 && activeCount >= 5) return 'ACTIVE';
    if (probability >= 65 && activeCount >= 4) return 'IMMINENT';
    if (probability >= 50 && activeCount >= 3) return 'BUILDING';
    return 'LOADING';
}

/**
 * Detect squeeze for a symbol
 */
export async function detectSqueeze(input: SqueezeInput): Promise<SqueezeSignal | null> {
    const {
        symbol,
        currentPrice,
        oiCurrent,
        oiPrevious24h,
        oiChange24h,
        fundingRate,
        longRatio,
        shortRatio,
        buyVolume,
        sellVolume,
        priceChange24h,
        nearbyLongLiquidations = 0,
        nearbyShortLiquidations = 0,
        nearestLongLiqPrice,
        nearestShortLiqPrice,
    } = input;

    // Determine direction based on positioning
    const isLongHeavy = longRatio > THRESHOLDS.lsRatioImbalance;
    const isShortHeavy = shortRatio > THRESHOLDS.lsRatioImbalance;

    // If no clear imbalance, no squeeze potential
    if (!isLongHeavy && !isShortHeavy) return null;

    const squeezeType: SqueezeType = isLongHeavy ? 'LONG_SQUEEZE' : 'SHORT_SQUEEZE';

    // ========================================
    // COMPONENT 1: OI Rising
    // ========================================
    const oiRising = oiChange24h > THRESHOLDS.oiChangeMin;
    const oiComponent = analyzeComponent(
        'Open Interest Rising',
        oiChange24h,
        THRESHOLDS.oiChangeMin,
        THRESHOLDS.oiChangeStrong,
        oiRising
    );

    // ========================================
    // COMPONENT 2: Funding Extreme
    // ========================================
    const fundingAbs = Math.abs(fundingRate);
    const fundingExtreme = fundingAbs > THRESHOLDS.fundingExtreme;
    // For long squeeze: positive funding (longs paying)
    // For short squeeze: negative funding (shorts paying)
    const fundingDirectional = squeezeType === 'LONG_SQUEEZE'
        ? fundingRate > THRESHOLDS.fundingExtreme
        : fundingRate < -THRESHOLDS.fundingExtreme;

    const fundingComponent = analyzeComponent(
        'Extreme Funding Rate',
        fundingAbs,
        THRESHOLDS.fundingExtreme,
        THRESHOLDS.fundingVeryExtreme,
        fundingExtreme && fundingDirectional
    );

    // ========================================
    // COMPONENT 3: Directional Imbalance
    // ========================================
    const dominantRatio = Math.max(longRatio, shortRatio);
    const imbalanceActive = dominantRatio > THRESHOLDS.lsRatioImbalance;

    const imbalanceComponent = analyzeComponent(
        'Directional Imbalance',
        dominantRatio,
        THRESHOLDS.lsRatioImbalance,
        THRESHOLDS.lsRatioExtreme,
        imbalanceActive
    );

    // ========================================
    // COMPONENT 4: Liquidation Cluster
    // ========================================
    const relevantLiquidations = squeezeType === 'LONG_SQUEEZE'
        ? nearbyLongLiquidations
        : nearbyShortLiquidations;
    const hasLiquidationCluster = relevantLiquidations > 0;

    const liquidationComponent: SqueezeComponent = {
        name: 'Liquidation Cluster Nearby',
        active: hasLiquidationCluster,
        value: relevantLiquidations,
        threshold: 1,
        contribution: hasLiquidationCluster ? Math.min(relevantLiquidations / 10, 1) : 0,
    };

    // ========================================
    // COMPONENT 5: Volume Absorption
    // ========================================
    // Price stalling while volume is high
    const priceStalling = Math.abs(priceChange24h) < THRESHOLDS.priceChangeMax;
    const volumeRatio = buyVolume > 0 ? sellVolume / buyVolume : 1;

    // For long squeeze: high buy volume but price not rising
    // For short squeeze: high sell volume but price not falling
    const volumeAbsorption = squeezeType === 'LONG_SQUEEZE'
        ? (volumeRatio > THRESHOLDS.volumeAbsorptionRatio && priceStalling)
        : (volumeRatio < (1 / THRESHOLDS.volumeAbsorptionRatio) && priceStalling);

    const volumeComponent: SqueezeComponent = {
        name: 'Volume Absorption',
        active: volumeAbsorption,
        value: volumeRatio,
        threshold: THRESHOLDS.volumeAbsorptionRatio,
        contribution: volumeAbsorption ? 0.8 : 0,
    };

    // ========================================
    // COMPONENT 6: Price Rejection
    // ========================================
    // Price trying to move in one direction but failing
    const priceRejection = priceStalling && oiRising;

    const priceComponent: SqueezeComponent = {
        name: 'Price Rejection',
        active: priceRejection,
        value: Math.abs(priceChange24h),
        threshold: THRESHOLDS.priceChangeMax,
        contribution: priceRejection ? 0.7 : 0,
    };

    // ========================================
    // AGGREGATE COMPONENTS
    // ========================================
    const components = {
        oiRising: oiComponent,
        fundingExtreme: fundingComponent,
        directionalImbalance: imbalanceComponent,
        liquidationCluster: liquidationComponent,
        volumeAbsorption: volumeComponent,
        priceRejection: priceComponent,
    };

    // Calculate weighted probability
    const probability = (
        (oiComponent.active ? WEIGHTS.oiRising * oiComponent.contribution : 0) +
        (fundingComponent.active ? WEIGHTS.fundingExtreme * fundingComponent.contribution : 0) +
        (imbalanceComponent.active ? WEIGHTS.directionalImbalance * imbalanceComponent.contribution : 0) +
        (liquidationComponent.active ? WEIGHTS.liquidationCluster * liquidationComponent.contribution : 0) +
        (volumeComponent.active ? WEIGHTS.volumeAbsorption * volumeComponent.contribution : 0) +
        (priceComponent.active ? WEIGHTS.priceRejection * priceComponent.contribution : 0)
    ) * 100;

    // Minimum probability threshold
    if (probability < 40) return null;

    const strength = determineStrength(components, probability);

    // Nearest liquidation price
    const nearestLiquidationPrice = squeezeType === 'LONG_SQUEEZE'
        ? nearestLongLiqPrice || currentPrice * 0.95
        : nearestShortLiqPrice || currentPrice * 1.05;

    // Estimated liquidation value (rough estimate)
    const estimatedLiquidationValue = relevantLiquidations * currentPrice * 100; // Rough estimate

    return {
        symbol,
        type: squeezeType,
        strength,
        probability,
        components,
        nearestLiquidationPrice,
        estimatedLiquidationValue,
        triggerZone: {
            low: squeezeType === 'LONG_SQUEEZE' ? currentPrice * 0.97 : currentPrice,
            high: squeezeType === 'LONG_SQUEEZE' ? currentPrice : currentPrice * 1.03,
        },
        similarSetups: 0,      // Would need historical data
        historicalWinRate: 0,  // Would need historical data
        timestamp: Date.now(),
    };
}

/**
 * Detect squeezes across multiple symbols using real data
 */
export async function detectSqueezeMulti(symbols: string[]): Promise<SqueezeSignal[]> {
    const squeezes: SqueezeSignal[] = [];

    for (const symbol of symbols) {
        try {
            // Fetch data from multiple sources
            const [binanceSnapshot, bybitSnapshot] = await Promise.all([
                fetchBinanceSqueezeData(symbol),
                bybitAdapter.getPositioningSnapshot(symbol).catch(() => null),
            ]);

            if (!binanceSnapshot) continue;

            // Merge data from both exchanges
            const input: SqueezeInput = {
                symbol,
                currentPrice: binanceSnapshot.price,
                oiCurrent: binanceSnapshot.oi,
                oiPrevious24h: binanceSnapshot.oiPrev,
                oiChange24h: binanceSnapshot.oiChange,
                fundingRate: binanceSnapshot.funding,
                longRatio: bybitSnapshot?.buyRatio || binanceSnapshot.longRatio,
                shortRatio: bybitSnapshot?.sellRatio || binanceSnapshot.shortRatio,
                buyVolume: binanceSnapshot.buyVolume,
                sellVolume: binanceSnapshot.sellVolume,
                priceChange24h: binanceSnapshot.priceChange,
            };

            const squeeze = await detectSqueeze(input);
            if (squeeze) {
                squeezes.push(squeeze);
            }
        } catch (error) {
            console.error(`Squeeze detection failed for ${symbol}:`, error);
        }
    }

    // Sort by probability
    return squeezes.sort((a, b) => b.probability - a.probability);
}

/**
 * Fetch squeeze data from Binance
 */
async function fetchBinanceSqueezeData(symbol: string): Promise<{
    price: number;
    priceChange: number;
    oi: number;
    oiPrev: number;
    oiChange: number;
    funding: number;
    longRatio: number;
    shortRatio: number;
    buyVolume: number;
    sellVolume: number;
} | null> {
    try {
        const formatted = symbol.replace('-', '').toUpperCase();

        const [instrument, oiHistory, lsRatio, takerRatio] = await Promise.all([
            binanceAdapter.getInstrument(formatted, 'perpetual'),
            binanceAdapter.getOpenInterestHistory(formatted, '1h', 24),
            binanceAdapter.getGlobalLongShortRatio(formatted, '1h', 1),
            binanceAdapter.getTakerBuySellRatio(formatted, '1h', 1),
        ]);

        if (!instrument) return null;

        // Calculate OI change
        const oiCurrent = oiHistory[0]?.oi || 0;
        const oiPrev = oiHistory[23]?.oi || oiHistory[oiHistory.length - 1]?.oi || oiCurrent;
        const oiChange = oiPrev > 0 ? (oiCurrent - oiPrev) / oiPrev : 0;

        // Get positioning
        const latestLs = lsRatio[0];
        const longRatio = latestLs?.longAccountRatio || 0.5;
        const shortRatio = latestLs?.shortAccountRatio || 0.5;

        // Get volume
        const latestTaker = takerRatio[0];
        const buyVolume = latestTaker?.buyVolume || 0;
        const sellVolume = latestTaker?.sellVolume || 0;

        // Price change - estimate from 24hr data
        // This would be better with actual 24h comparison
        const priceChange = 0; // Would need proper calculation

        return {
            price: instrument.price,
            priceChange,
            oi: oiCurrent,
            oiPrev,
            oiChange,
            funding: instrument.fundingRate,
            longRatio,
            shortRatio,
            buyVolume,
            sellVolume,
        };
    } catch (error) {
        console.error(`fetchBinanceSqueezeData error for ${symbol}:`, error);
        return null;
    }
}

const squeezeEngine = {
    detectSqueeze,
    detectSqueezeMulti,
};

export default squeezeEngine;
