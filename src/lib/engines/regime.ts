/**
 * NEXUS Market Regime Engine
 * Determines overall market state based on multiple factors
 * 
 * Regimes:
 * - RISK_ON: Bullish momentum, leverage increasing, greed
 * - RISK_OFF: Bearish momentum, deleveraging, fear
 * - DISTRIBUTION: Smart money selling into strength
 * - ACCUMULATION: Smart money buying into weakness
 * - SPECULATION: Alt season, high leverage, meme coins pumping
 * - NEUTRAL: Sideways, low conviction
 */

import type { MarketRegime, RegimeAnalysis, RegimeComponent } from '../types-extended';

// Weights for each component
const REGIME_WEIGHTS = {
    btcTrend: 0.25,
    oiChange: 0.15,
    fundingBias: 0.15,
    stablecoinFlow: 0.15,
    dominanceShift: 0.15,
    liquidationPressure: 0.05,
    fearGreed: 0.10,
};

// Thresholds
const THRESHOLDS = {
    btcTrend: {
        strongBullish: 0.05,    // +5%
        bullish: 0.02,          // +2%
        bearish: -0.02,         // -2%
        strongBearish: -0.05,   // -5%
    },
    oiChange: {
        expanding: 0.03,        // +3%
        contracting: -0.03,     // -3%
    },
    funding: {
        longCrowded: 0.0002,    // 0.02%
        shortCrowded: -0.0002,  // -0.02%
    },
    stablecoin: {
        inflow: 0.01,           // +1% supply
        outflow: -0.01,         // -1% supply
    },
    dominance: {
        btcGaining: 0.01,       // +1%
        btcLosing: -0.01,       // -1%
    },
    fearGreed: {
        greed: 60,
        extremeGreed: 75,
        fear: 40,
        extremeFear: 25,
    },
};

interface RegimeInput {
    // BTC metrics
    btcPrice: number;
    btcChange24h: number;
    btcChange7d: number;

    // OI metrics (aggregated)
    totalOI: number;
    oiChange24h: number;

    // Funding (average across exchanges)
    avgFunding: number;
    positiveFundingCount: number;
    negativeFundingCount: number;

    // Stablecoin supply
    stablecoinMcap: number;
    stablecoinChange24h: number;
    stablecoinChange7d: number;

    // Dominance
    btcDominance: number;
    btcDominanceChange24h: number;
    ethDominance: number;

    // Liquidations (24h)
    longLiquidations: number;
    shortLiquidations: number;

    // Sentiment
    fearGreedValue: number;
    fearGreedClassification: string;
}

/**
 * Analyze a single component for regime determination
 */
function analyzeComponent(
    name: string,
    value: number,
    bullishThreshold: number,
    bearishThreshold: number,
    weight: number
): RegimeComponent {
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let contribution = 0;

    if (value > bullishThreshold) {
        signal = 'bullish';
        contribution = Math.min((value - bullishThreshold) / bullishThreshold, 1) * weight;
    } else if (value < bearishThreshold) {
        signal = 'bearish';
        contribution = Math.min((bearishThreshold - value) / Math.abs(bearishThreshold), 1) * weight * -1;
    }

    return {
        name,
        value,
        signal,
        weight,
        contribution,
    };
}

/**
 * Calculate market regime from input data
 */
export function calculateRegime(input: RegimeInput): RegimeAnalysis {
    const {
        btcChange24h,
        btcChange7d,
        oiChange24h,
        avgFunding,
        stablecoinChange24h,
        btcDominanceChange24h,
        longLiquidations,
        shortLiquidations,
        fearGreedValue,
    } = input;

    // ========================================
    // COMPONENT ANALYSIS
    // ========================================

    // BTC Trend
    const btcTrendComponent = analyzeComponent(
        'BTC Trend',
        btcChange24h / 100, // Convert percentage
        THRESHOLDS.btcTrend.bullish,
        THRESHOLDS.btcTrend.bearish,
        REGIME_WEIGHTS.btcTrend
    );

    // OI Change
    const oiComponent = analyzeComponent(
        'Open Interest Change',
        oiChange24h,
        THRESHOLDS.oiChange.expanding,
        THRESHOLDS.oiChange.contracting,
        REGIME_WEIGHTS.oiChange
    );

    // Funding Bias
    const fundingComponent = analyzeComponent(
        'Funding Rate Bias',
        avgFunding,
        THRESHOLDS.funding.longCrowded,
        THRESHOLDS.funding.shortCrowded,
        REGIME_WEIGHTS.fundingBias
    );

    // Stablecoin Flow
    const stablecoinComponent = analyzeComponent(
        'Stablecoin Flow',
        stablecoinChange24h,
        THRESHOLDS.stablecoin.inflow,
        THRESHOLDS.stablecoin.outflow,
        REGIME_WEIGHTS.stablecoinFlow
    );

    // Dominance Shift
    const dominanceComponent = analyzeComponent(
        'BTC Dominance Shift',
        btcDominanceChange24h,
        THRESHOLDS.dominance.btcGaining,
        THRESHOLDS.dominance.btcLosing,
        REGIME_WEIGHTS.dominanceShift
    );

    // Liquidation Pressure
    const netLiquidations = longLiquidations - shortLiquidations;
    const totalLiquidations = longLiquidations + shortLiquidations;
    const liquidationRatio = totalLiquidations > 0 ? netLiquidations / totalLiquidations : 0;

    const liquidationComponent: RegimeComponent = {
        name: 'Liquidation Pressure',
        value: liquidationRatio,
        signal: liquidationRatio > 0.3 ? 'bearish' : liquidationRatio < -0.3 ? 'bullish' : 'neutral',
        weight: REGIME_WEIGHTS.liquidationPressure,
        contribution: liquidationRatio * REGIME_WEIGHTS.liquidationPressure * -1, // More long liqs = bearish
    };

    // Fear & Greed
    const fgNormalized = (fearGreedValue - 50) / 50; // -1 to 1
    const fearGreedComponent: RegimeComponent = {
        name: 'Fear & Greed Index',
        value: fearGreedValue,
        signal: fearGreedValue > THRESHOLDS.fearGreed.greed
            ? 'bullish'
            : fearGreedValue < THRESHOLDS.fearGreed.fear
                ? 'bearish'
                : 'neutral',
        weight: REGIME_WEIGHTS.fearGreed,
        contribution: fgNormalized * REGIME_WEIGHTS.fearGreed,
    };

    // ========================================
    // AGGREGATE SCORE
    // ========================================
    const components = {
        btcTrend: btcTrendComponent,
        oiChange: oiComponent,
        fundingBias: fundingComponent,
        stablecoinFlow: stablecoinComponent,
        dominanceShift: dominanceComponent,
        liquidationPressure: liquidationComponent,
        fearGreed: fearGreedComponent,
    };

    const score = Object.values(components).reduce((sum, c) => sum + c.contribution, 0) * 100;

    // ========================================
    // DETERMINE REGIME
    // ========================================
    const drivers: string[] = [];
    let regime: MarketRegime = 'NEUTRAL';

    // Count signals
    const bullishSignals = Object.values(components).filter(c => c.signal === 'bullish').length;
    const bearishSignals = Object.values(components).filter(c => c.signal === 'bearish').length;

    // Add driver descriptions
    if (btcTrendComponent.signal === 'bullish') drivers.push('BTC trending up');
    if (btcTrendComponent.signal === 'bearish') drivers.push('BTC trending down');
    if (oiComponent.signal === 'bullish') drivers.push('OI expanding');
    if (oiComponent.signal === 'bearish') drivers.push('OI contracting');
    if (fundingComponent.signal === 'bullish') drivers.push('Longs crowded');
    if (fundingComponent.signal === 'bearish') drivers.push('Shorts crowded');
    if (stablecoinComponent.signal === 'bullish') drivers.push('Stablecoin inflows');
    if (stablecoinComponent.signal === 'bearish') drivers.push('Stablecoin outflows');
    if (dominanceComponent.signal === 'bearish') drivers.push('BTC dominance falling');
    if (fearGreedComponent.signal === 'bullish') drivers.push('Extreme Greed');
    if (fearGreedComponent.signal === 'bearish') drivers.push('Extreme Fear');

    // Determine primary regime
    if (score > 30 && bullishSignals >= 4) {
        regime = 'RISK_ON';
    } else if (score < -30 && bearishSignals >= 4) {
        regime = 'RISK_OFF';
    } else if (
        btcTrendComponent.signal === 'bullish' &&
        oiComponent.signal === 'bearish' &&
        fundingComponent.value > 0
    ) {
        // Price up, OI down, funding positive = distribution
        regime = 'DISTRIBUTION';
        drivers.push('Smart money selling into strength');
    } else if (
        btcTrendComponent.signal === 'bearish' &&
        stablecoinComponent.signal === 'bullish' &&
        fundingComponent.value < 0
    ) {
        // Price down, stables in, funding negative = accumulation
        regime = 'ACCUMULATION';
        drivers.push('Smart money buying weakness');
    } else if (
        dominanceComponent.signal === 'bearish' &&
        oiComponent.signal === 'bullish' &&
        fearGreedValue > THRESHOLDS.fearGreed.greed
    ) {
        // BTC dom falling, OI up, greed = alt speculation
        regime = 'SPECULATION';
        drivers.push('Alt season indicators');
    }

    // Confidence calculation
    const signalAgreement = Math.max(bullishSignals, bearishSignals) / 7;
    const confidence = Math.min(Math.abs(score) + signalAgreement * 30, 100);

    // Transition detection
    let isTransitioning = false;
    let transitionTo: MarketRegime | null = null;
    let transitionProgress = 0;

    // Check for regime transition signals
    if (regime === 'RISK_ON' && fundingComponent.value > THRESHOLDS.funding.longCrowded * 2) {
        isTransitioning = true;
        transitionTo = 'DISTRIBUTION';
        transitionProgress = 30;
    } else if (regime === 'RISK_OFF' && stablecoinComponent.signal === 'bullish') {
        isTransitioning = true;
        transitionTo = 'ACCUMULATION';
        transitionProgress = 40;
    }

    return {
        current: regime,
        previous: 'NEUTRAL', // Would need state tracking
        confidence,
        drivers,
        components,
        score,
        isTransitioning,
        transitionTo,
        transitionProgress,
        timestamp: Date.now(),
    };
}

/**
 * Get regime from macro API data
 */
export async function getMarketRegime(macroData: {
    btcPrice: number;
    btcChange24h: number;
    btcDominance: number;
    fearGreed: number;
}): Promise<RegimeAnalysis> {
    // This would fetch additional data from APIs
    // For now, use sensible defaults for missing data

    return calculateRegime({
        btcPrice: macroData.btcPrice,
        btcChange24h: macroData.btcChange24h,
        btcChange7d: macroData.btcChange24h * 2, // Rough estimate
        totalOI: 0,
        oiChange24h: 0,
        avgFunding: 0,
        positiveFundingCount: 0,
        negativeFundingCount: 0,
        stablecoinMcap: 0,
        stablecoinChange24h: 0,
        stablecoinChange7d: 0,
        btcDominance: macroData.btcDominance,
        btcDominanceChange24h: 0,
        ethDominance: 0,
        longLiquidations: 0,
        shortLiquidations: 0,
        fearGreedValue: macroData.fearGreed,
        fearGreedClassification: '',
    });
}

/**
 * Get regime color for UI
 */
export function getRegimeColor(regime: MarketRegime): string {
    switch (regime) {
        case 'RISK_ON': return '#22c55e';
        case 'RISK_OFF': return '#ef4444';
        case 'DISTRIBUTION': return '#f97316';
        case 'ACCUMULATION': return '#3b82f6';
        case 'SPECULATION': return '#a855f7';
        case 'NEUTRAL': return '#6b7280';
        default: return '#6b7280';
    }
}

/**
 * Get regime description
 */
export function getRegimeDescription(regime: MarketRegime): string {
    switch (regime) {
        case 'RISK_ON':
            return 'Bullish momentum with expanding leverage and positive sentiment';
        case 'RISK_OFF':
            return 'Bearish momentum with deleveraging and negative sentiment';
        case 'DISTRIBUTION':
            return 'Smart money selling into strength, potential top forming';
        case 'ACCUMULATION':
            return 'Smart money buying into weakness, potential bottom forming';
        case 'SPECULATION':
            return 'Alt season with high leverage and risk appetite';
        case 'NEUTRAL':
            return 'Sideways consolidation with mixed signals';
        default:
            return 'Unknown market state';
    }
}

const regimeEngine = {
    calculateRegime,
    getMarketRegime,
    getRegimeColor,
    getRegimeDescription,
};

export default regimeEngine;
