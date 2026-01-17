/**
 * NEXUS Terminal - Extended Types
 * Comprehensive data models for real market intelligence
 */

// ============================================
// EXCHANGES (Extended)
// ============================================

export type ExtendedExchange =
    | 'binance'
    | 'bybit'
    | 'okx'
    | 'kraken'
    | 'coinbase'
    | 'kucoin'
    | 'bitget'
    | 'gateio'
    | 'deribit';

// ============================================
// LIQUIDATIONS
// ============================================

export interface Liquidation {
    id: string;
    exchange: ExtendedExchange;
    symbol: string;
    side: 'long' | 'short';
    price: number;
    quantity: number;
    value: number;           // USD value
    timestamp: number;
}

export interface LiquidationCluster {
    priceLevel: number;
    priceLevelPercent: number;  // Distance from current price
    longLiquidations: number;   // Count
    shortLiquidations: number;  // Count
    longValue: number;          // USD
    shortValue: number;         // USD
    totalValue: number;         // USD
    intensity: number;          // 0-1 normalized
}

export interface LiquidationHeatmap {
    symbol: string;
    currentPrice: number;
    clusters: LiquidationCluster[];
    nearestLongCluster: LiquidationCluster | null;
    nearestShortCluster: LiquidationCluster | null;
    totalLongLiquidatable: number;
    totalShortLiquidatable: number;
    timestamp: number;
}

// ============================================
// OPTIONS (Deribit/OKX)
// ============================================

export interface OptionsContract {
    exchange: 'deribit' | 'okx';
    symbol: string;           // e.g., "BTC-31JAN26-100000-C"
    underlying: string;       // e.g., "BTC"
    strike: number;
    expiry: number;           // Unix timestamp
    type: 'call' | 'put';

    // Pricing
    markPrice: number;
    bidPrice: number;
    askPrice: number;
    lastPrice: number;

    // Greeks
    iv: number;               // Implied volatility
    delta: number;
    gamma: number;
    theta: number;
    vega: number;

    // Volume & OI
    openInterest: number;
    openInterestValue: number;
    volume24h: number;
    volumeValue24h: number;

    timestamp: number;
}

export interface OptionsAggregates {
    underlying: string;
    expiry: number | null;    // null = all expiries

    // Put/Call metrics
    totalCallOI: number;
    totalPutOI: number;
    callOIValue: number;
    putOIValue: number;
    putCallRatio: number;     // Put OI / Call OI

    // IV metrics
    atmIV: number;            // At-the-money IV
    avgCallIV: number;
    avgPutIV: number;
    ivSkew: number;           // OTM puts IV - OTM calls IV (positive = fear)

    // Max pain
    maxPainStrike: number;
    maxPainValue: number;     // Total losses at max pain

    // Volume
    callVolume24h: number;
    putVolume24h: number;

    timestamp: number;
}

export interface IVSurfacePoint {
    strike: number;
    expiry: number;
    iv: number;
    type: 'call' | 'put';
}

export interface OptionsFlow {
    id: string;
    exchange: 'deribit' | 'okx';
    symbol: string;
    underlying: string;
    strike: number;
    expiry: number;
    type: 'call' | 'put';
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    value: number;
    isBlock: boolean;         // Large block trade
    timestamp: number;
}

// ============================================
// POSITIONING DATA
// ============================================

export interface PositioningData {
    exchange: ExtendedExchange;
    symbol: string;

    // Account-based ratios
    longAccountRatio: number;     // % of accounts long
    shortAccountRatio: number;    // % of accounts short

    // Position-based ratios
    longPositionRatio: number;    // % of positions long (by value)
    shortPositionRatio: number;   // % of positions short (by value)

    // Top trader ratios
    topTraderLongRatio: number;
    topTraderShortRatio: number;
    topTraderLongPositions: number;
    topTraderShortPositions: number;

    timestamp: number;
}

export interface AggregatedPositioning {
    symbol: string;
    exchanges: PositioningData[];

    // Weighted averages
    avgLongRatio: number;
    avgShortRatio: number;
    avgTopTraderLongRatio: number;
    avgTopTraderShortRatio: number;

    // Bias detection
    bias: 'LONG_HEAVY' | 'SHORT_HEAVY' | 'BALANCED';
    biasStrength: number;  // 0-1

    timestamp: number;
}

// ============================================
// ON-CHAIN FLOWS
// ============================================

export interface ExchangeFlow {
    exchange: string;
    asset: 'BTC' | 'ETH' | 'USDT' | 'USDC';

    // Inflows (deposits to exchange = potential sell pressure)
    inflow1h: number;
    inflow24h: number;
    inflow7d: number;

    // Outflows (withdrawals = accumulation)
    outflow1h: number;
    outflow24h: number;
    outflow7d: number;

    // Net flow (positive = more deposits)
    netFlow1h: number;
    netFlow24h: number;
    netFlow7d: number;

    // Reserve
    totalReserve: number;
    reserveChange24h: number;

    timestamp: number;
}

export interface StablecoinFlow {
    chain: string;
    stablecoin: 'USDT' | 'USDC' | 'DAI' | 'BUSD' | 'ALL';

    // Supply metrics
    supply: number;
    supplyChange1d: number;
    supplyChange7d: number;
    supplyChange30d: number;

    // Market share
    marketShare: number;

    timestamp: number;
}

export interface WhaleMovement {
    id: string;
    address: string;
    label: string | null;      // Known entity label
    asset: string;
    action: 'transfer' | 'exchange_deposit' | 'exchange_withdrawal';
    amount: number;
    valueUSD: number;
    from: string;
    to: string;
    fromLabel: string | null;
    toLabel: string | null;
    timestamp: number;
}

export interface SmartMoneyFlow {
    address: string;
    label: string;
    tokenIn: { symbol: string; amount: number; value: number }[];
    tokenOut: { symbol: string; amount: number; value: number }[];
    netFlow: number;
    lastActivity: number;
}

// ============================================
// MARKET REGIME ENGINE
// ============================================

export type MarketRegime =
    | 'RISK_ON'         // Bullish momentum, expansion
    | 'RISK_OFF'        // Bearish momentum, contraction
    | 'DISTRIBUTION'    // Topping, smart money selling
    | 'ACCUMULATION'    // Bottoming, smart money buying
    | 'SPECULATION'     // Alt season, high risk appetite
    | 'NEUTRAL';        // Sideways, low conviction

export interface RegimeComponent {
    name: string;
    value: number;
    signal: 'bullish' | 'bearish' | 'neutral';
    weight: number;
    contribution: number;
}

export interface RegimeAnalysis {
    current: MarketRegime;
    previous: MarketRegime;
    confidence: number;        // 0-100

    // What's driving the regime
    drivers: string[];

    // Component breakdown
    components: {
        btcTrend: RegimeComponent;
        oiChange: RegimeComponent;
        fundingBias: RegimeComponent;
        stablecoinFlow: RegimeComponent;
        dominanceShift: RegimeComponent;
        liquidationPressure: RegimeComponent;
        fearGreed: RegimeComponent;
    };

    // Weighted score
    score: number;             // -100 to +100

    // Transition detection
    isTransitioning: boolean;
    transitionTo: MarketRegime | null;
    transitionProgress: number; // 0-100

    timestamp: number;
}

// ============================================
// SQUEEZE ENGINE
// ============================================

export type SqueezeType = 'LONG_SQUEEZE' | 'SHORT_SQUEEZE' | 'DOUBLE_SQUEEZE';
export type SqueezeStrength = 'LOADING' | 'BUILDING' | 'IMMINENT' | 'ACTIVE';

export interface SqueezeComponent {
    name: string;
    active: boolean;
    value: number;
    threshold: number;
    contribution: number;
}

export interface SqueezeSignal {
    symbol: string;
    type: SqueezeType;
    strength: SqueezeStrength;
    probability: number;       // 0-100

    // Real squeeze components
    components: {
        oiRising: SqueezeComponent;
        fundingExtreme: SqueezeComponent;
        directionalImbalance: SqueezeComponent;
        liquidationCluster: SqueezeComponent;
        volumeAbsorption: SqueezeComponent;
        priceRejection: SqueezeComponent;
    };

    // Actionable data
    nearestLiquidationPrice: number;
    estimatedLiquidationValue: number;
    triggerZone: { low: number; high: number };

    // Historical context
    similarSetups: number;     // Count of similar setups in last 30d
    historicalWinRate: number; // % that resulted in actual squeeze

    timestamp: number;
}

// ============================================
// CAPITAL ROTATION ENGINE
// ============================================

export type RotationPhase =
    | 'BTC_ACCUMULATION'    // Money flowing into BTC
    | 'BTC_DISTRIBUTION'    // Money flowing out of BTC
    | 'ETH_ROTATION'        // Money moving BTC -> ETH
    | 'LARGE_CAP_ROTATION'  // Money moving to top 10 alts
    | 'ALT_SPECULATION'     // Money flowing to small caps
    | 'RISK_OFF_STABLES';   // Money fleeing to stablecoins

export interface RotationSignal {
    phase: RotationPhase;
    confidence: number;

    // Flow indicators
    btcDominanceChange: number;
    ethBtcRatioChange: number;
    altOIChange: number;
    stablecoinMcapChange: number;
    defiTVLChange: number;

    // Sector flows
    sectorFlows: {
        sector: string;
        inflow: number;
        outflow: number;
        netFlow: number;
    }[];

    // Recommendations (not financial advice, just data)
    flowingInto: string[];
    flowingOutOf: string[];

    timestamp: number;
}

// ============================================
// NARRATIVE ENGINE
// ============================================

export interface NewsItem {
    id: string;
    title: string;
    source: string;
    url: string;
    publishedAt: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impact: 'high' | 'medium' | 'low';
    assets: string[];
    categories: string[];
}

export interface Narrative {
    id: string;
    theme: string;           // "ETF Delay Impact", "Exchange FUD"
    summary: string;
    headlines: NewsItem[];

    // Market correlation
    marketImpact: {
        symbol: string;
        priceChange: number;
        oiChange: number;
        volumeSpike: number;
    }[];

    // Sentiment aggregation
    overallSentiment: number;   // -100 to +100

    // Positioning implication
    conclusion: string;         // "Longs trapped", "Shorts squeezed"
    tradingImplication: string; // "Caution on longs", "Watch for bounce"

    createdAt: number;
    updatedAt: number;
}

export interface NarrativeContext {
    headlines: NewsItem[];
    narratives: Narrative[];

    // Market state
    marketContext: {
        fearGreed: number;
        btcChange24h: number;
        btcDominance: number;
        totalMcapChange: number;
    };

    // Dominant narrative
    dominantTheme: string;
    dominantSentiment: 'bullish' | 'bearish' | 'neutral';

    timestamp: number;
}

// ============================================
// AGGREGATED DATA RESPONSES
// ============================================

export interface DerivativesIntelligence {
    symbol: string;

    // Cross-exchange data
    funding: {
        exchange: ExtendedExchange;
        rate: number;
        nextTime: number;
    }[];
    avgFunding: number;

    // Open Interest
    oi: {
        exchange: ExtendedExchange;
        value: number;
        change24h: number;
    }[];
    totalOI: number;
    oiChange24h: number;

    // Positioning
    positioning: AggregatedPositioning;

    // Liquidations
    liquidations: LiquidationHeatmap;

    // Squeeze detection
    squeezeSignal: SqueezeSignal | null;

    timestamp: number;
}

export interface MarketIntelligence {
    regime: RegimeAnalysis;
    rotation: RotationSignal;
    narrative: NarrativeContext;
    topSqueezes: SqueezeSignal[];
    timestamp: number;
}

// ============================================
// API RESPONSE WRAPPERS
// ============================================

export interface APIResponse<T> {
    success: boolean;
    data: T | null;
    error?: string;
    cached?: boolean;
    source?: string;
    timestamp: number;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}
