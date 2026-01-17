/**
 * DefiLlama API Route - TVL, Protocols, Chains
 * Filters out CEXs and non-DeFi entities
 */

import { NextRequest, NextResponse } from 'next/server';
import { defillamaExtendedAdapter } from '@/lib/onchain/defillama-extended';

const DEFILLAMA_BASE = 'https://api.llama.fi';

// CEX and non-DeFi entities to filter out
const EXCLUDED_NAMES = [
    'binance', 'coinbase', 'kraken', 'bitfinex', 'gemini', 'robinhood',
    'okx', 'bybit', 'kucoin', 'huobi', 'gate.io', 'bitstamp', 'crypto.com',
    'ftx', 'bitget', 'mexc', 'phemex', 'deribit', 'bitmart', 'poloniex',
    'htx', 'lbank', 'bitrue', 'whitebit', 'ascendex', 'bitmex',
];

const EXCLUDED_CATEGORIES = ['CEX', 'Centralized Exchange'];

function isCEX(name: string, category?: string): boolean {
    const lowerName = name.toLowerCase();
    if (EXCLUDED_NAMES.some(ex => lowerName.includes(ex))) return true;
    if (category && EXCLUDED_CATEGORIES.includes(category)) return true;
    return false;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'tvl';

    try {
        let data;

        switch (type) {
            case 'tvl':
                const tvlRes = await fetch(`${DEFILLAMA_BASE}/tvl`, { next: { revalidate: 300 } });
                const totalTvl = await tvlRes.json();
                data = { totalTvl };
                break;

            case 'chains':
                const chainsRes = await fetch(`${DEFILLAMA_BASE}/v2/chains`, { next: { revalidate: 300 } });
                const chains = await chainsRes.json();
                // Filter out any chain that looks like a CEX
                data = (chains || [])
                    .filter((c: { name: string }) => !isCEX(c.name))
                    .slice(0, 30)
                    .map((c: { name: string; tvl: number }) => ({
                        name: c.name,
                        tvl: c.tvl,
                    }));
                break;

            case 'protocols':
                // ... (existing protocols logic)
                const protocolsRes = await fetch(`${DEFILLAMA_BASE}/protocols`, { next: { revalidate: 300 } });
                const protocols = await protocolsRes.json();
                // Filter out CEXs and non-DeFi protocols
                data = (protocols || [])
                    .filter((p: { name: string; category: string }) => !isCEX(p.name, p.category))
                    .slice(0, 50)
                    .map((p: {
                        name: string;
                        tvl: number;
                        chain: string;
                        category: string;
                        change_1d: number;
                        change_7d: number;
                    }) => ({
                        name: p.name,
                        tvl: p.tvl,
                        chain: p.chain,
                        category: p.category,
                        change1d: p.change_1d || 0,
                        change7d: p.change_7d || 0,
                    }));
                break;

            case 'yields':
                // Use the adapter which handles the large fetch and filtering
                data = await defillamaExtendedAdapter.getTopYields(50);
                break;

            case 'fees':
                // Use the adapter for fees/revenue
                data = await defillamaExtendedAdapter.getFeesAndRevenue();
                break;

            default:
                data = null;
        }

        return NextResponse.json({
            success: true,
            data,
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('DefiLlama API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch DeFi data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
