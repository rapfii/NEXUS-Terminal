/**
 * NEXUS Capital Rotation Engine
 * Tracks the flow of capital between sectors to predict market phases
 * 
 * PHASES:
 * 1. Bitcoin Season (BTC dominance rising, price rising)
 * 2. Ethereum Season (ETH/BTC rising)
 * 3. Large Cap Season (Top 10 alts outperforming ETH)
 * 4. Alt Season (Broad market rally, BTC dominance falling)
 * 5. Distribution (Everything dropping, stablecoin dominance rising)
 */

import type { RotationSignal, RotationPhase } from '../types-extended';

// Weights for rotation detection
const WEIGHTS = {
    btcDominance: 0.3,
    ethBtc: 0.25,
    stablecoinSupply: 0.2,
    sectorPerformance: 0.15,
    totalMcap: 0.1,
};

// Thresholds
const THRESHOLDS = {
    dominanceChange: 0.005,      // 0.5% change
    ethBtcBreakout: 0.02,        // 2% move
    altOutperformance: 0.05,     // 5% vs BTC
    stablecoinInflow: 0.01,      // 1% supply increase
};

interface RotationInput {
    // Market Caps
    totalMcap: number;
    totalMcapChange24h: number;
    altMcap: number;             // Total - BTC - ETH
    altMcapChange24h: number;

    // Dominance
    btcDominance: number;
    btcDominanceChange24h: number;
    ethDominance: number;
    ethDominanceChange24h: number;
    stablecoinDominance: number;
    stablecoinDominanceChange24h: number;

    // Prices & Ratios
    btcPriceChange24h: number;
    ethPriceChange24h: number;
    ethBtcRatio: number;
    ethBtcChange24h: number;

    // Sector Performance (avg % change)
    defiChange24h: number;
    l1Change24h: number;
    gamingChange24h: number;
    memeChange24h: number;
    aiChange24h: number;
}

/**
 * Calculate dominance from market caps
 */
export function calculateDominance(
    assetMcap: number,
    totalMcap: number
): number {
    if (totalMcap === 0) return 0;
    return (assetMcap / totalMcap) * 100;
}

/**
 * Detect current capital rotation phase
 */
export function detectRotation(input: RotationInput): RotationSignal {
    const {
        totalMcapChange24h,
        btcDominanceChange24h,
        ethDominanceChange24h,
        stablecoinDominanceChange24h,
        btcPriceChange24h,
        ethBtcChange24h,
        altMcapChange24h,
        memeChange24h,
    } = input;

    let phase: RotationPhase = 'RISK_OFF_STABLES';
    let confidence = 0;
    const flowingInto: string[] = [];
    const flowingOutOf: string[] = [];

    // 1. Check for Risk Off / Distribution
    // Total cap down, stablecoin dom up
    if (totalMcapChange24h < -2 && stablecoinDominanceChange24h > 0) {
        phase = 'RISK_OFF_STABLES';
        confidence = 80;
        flowingInto.push('USDT', 'USDC');
        flowingOutOf.push('BTC', 'ETH', 'Alts');
    }
    // 2. Check for Bitcoin Season
    // BTC dom up, BTC price up/stable, Alts bleeding against BTC
    else if (btcDominanceChange24h > THRESHOLDS.dominanceChange && btcPriceChange24h > -1) {
        phase = 'BTC_ACCUMULATION';
        confidence = 70;

        if (btcPriceChange24h > 2) {
            // Aggressive BTC pump sucking liquidity
            confidence = 85;
            flowingInto.push('BTC');
            flowingOutOf.push('Alts', 'ETH');
        } else {
            // Slow accumulation
            flowingInto.push('BTC');
            flowingOutOf.push('Stablecoins');
        }
    }
    // 3. Check for ETH Rotation
    // ETH/BTC breakout, ETH dom up
    else if (ethBtcChange24h > THRESHOLDS.ethBtcBreakout) {
        phase = 'ETH_ROTATION';
        confidence = 65 + (ethBtcChange24h * 100); // Higher confidence on strong move
        flowingInto.push('ETH');
        flowingOutOf.push('BTC');
    }
    // 4. Check for Alt Season / Speculation
    // BTC dom down, Alt cap up significantly
    else if (
        btcDominanceChange24h < -THRESHOLDS.dominanceChange &&
        altMcapChange24h > btcPriceChange24h + 2
    ) {
        if (memeChange24h > 10) {
            phase = 'ALT_SPECULATION';
            confidence = 90;
            flowingInto.push('Memes', 'Small Caps');
            flowingOutOf.push('BTC', 'ETH');
        } else {
            phase = 'LARGE_CAP_ROTATION';
            confidence = 75;
            flowingInto.push('L1s', 'DeFi');
            flowingOutOf.push('BTC');
        }
    }
    // 5. Check for BTC Distribution
    // BTC flat/down, Alts flat/down, Stables flat
    else if (btcPriceChange24h < -2 && stablecoinDominanceChange24h < 0.1) {
        phase = 'BTC_DISTRIBUTION';
        confidence = 60;
        flowingOutOf.push('BTC');
        flowingInto.push('Fiat'); // Exiting crypto entirely
    }

    // Identify strongest sectors
    const sectors = [
        { name: 'DeFi', change: input.defiChange24h },
        { name: 'L1', change: input.l1Change24h },
        { name: 'Gaming', change: input.gamingChange24h },
        { name: 'Meme', change: input.memeChange24h },
        { name: 'AI', change: input.aiChange24h },
    ];

    const sortedSectors = [...sectors].sort((a, b) => b.change - a.change);

    // Add top performing sector to flows if meaningful
    if (sortedSectors[0].change > 5) {
        flowingInto.push(sortedSectors[0].name);
    }
    if (sortedSectors[sortedSectors.length - 1].change < -5) {
        flowingOutOf.push(sortedSectors[sortedSectors.length - 1].name);
    }

    // Format sector flows for response
    const sectorFlows = sectors.map(s => ({
        sector: s.name,
        // Rough estimate of flow based on price change (imperfect but useful proxy)
        inflow: s.change > 0 ? s.change * 1000000 : 0,
        outflow: s.change < 0 ? Math.abs(s.change) * 1000000 : 0,
        netFlow: s.change * 1000000,
    }));

    return {
        phase,
        confidence: Math.min(confidence, 100),

        // Metrics
        btcDominanceChange: btcDominanceChange24h,
        ethBtcRatioChange: ethBtcChange24h,
        altOIChange: 0, // Need external data
        stablecoinMcapChange: 0, // Need external data
        defiTVLChange: 0, // Need external data

        sectorFlows,
        flowingInto: [...new Set(flowingInto)], // Dedupe
        flowingOutOf: [...new Set(flowingOutOf)],

        timestamp: Date.now(),
    };
}

/**
 * Generate rotation signal from basic ticker data (when full macro data unavailable)
 */
export function quickDetectRotation(
    btcChange: number,
    ethChange: number,
    solChange: number, // Proxy for alts
    btcDomChange: number
): RotationSignal {
    const input: RotationInput = {
        totalMcap: 0,
        totalMcapChange24h: btcChange, // Rough proxy
        altMcap: 0,
        altMcapChange24h: solChange,
        btcDominance: 50,
        btcDominanceChange24h: btcDomChange,
        ethDominance: 18,
        ethDominanceChange24h: 0,
        stablecoinDominance: 10,
        stablecoinDominanceChange24h: btcChange < 0 ? 0.5 : -0.5,
        btcPriceChange24h: btcChange,
        ethPriceChange24h: ethChange,
        ethBtcRatio: 0.05,
        ethBtcChange24h: ethChange - btcChange,
        defiChange24h: solChange * 0.9,
        l1Change24h: solChange,
        gamingChange24h: solChange * 1.1,
        memeChange24h: solChange * 1.5,
        aiChange24h: solChange * 1.2,
    };

    return detectRotation(input);
}

const rotationEngine = {
    detectRotation,
    quickDetectRotation,
    calculateDominance,
};

export default rotationEngine;
