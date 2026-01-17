/**
 * Deribit API Route - Options & Futures
 */

import { NextRequest, NextResponse } from 'next/server';

const DERIBIT_BASE = 'https://www.deribit.com/api/v2/public';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const instrument = searchParams.get('instrument') || 'BTC-PERPETUAL';
    const type = searchParams.get('type') || 'ticker';

    try {
        let endpoint = '';

        switch (type) {
            case 'ticker':
                endpoint = `/ticker?instrument_name=${instrument}`;
                break;
            case 'orderbook':
                endpoint = `/get_order_book?instrument_name=${instrument}&depth=20`;
                break;
            case 'trades':
                endpoint = `/get_last_trades_by_instrument?instrument_name=${instrument}&count=50`;
                break;
            case 'index':
                endpoint = '/get_index?currency=BTC';
                break;
            case 'funding':
                endpoint = `/get_funding_rate_history?instrument_name=${instrument}&count=24`;
                break;
            case 'oi':
                endpoint = `/get_open_interest?instrument_name=${instrument}`;
                break;
            default:
                endpoint = `/ticker?instrument_name=${instrument}`;
        }

        const res = await fetch(`${DERIBIT_BASE}${endpoint}`, { next: { revalidate: 5 } });
        if (!res.ok) throw new Error('Deribit API error');

        const json = await res.json();
        const data = json.result;

        let result;
        switch (type) {
            case 'ticker':
                result = {
                    instrument: data?.instrument_name,
                    price: data?.last_price || 0,
                    markPrice: data?.mark_price || 0,
                    indexPrice: data?.index_price || 0,
                    bestBid: data?.best_bid_price || 0,
                    bestAsk: data?.best_ask_price || 0,
                    high24h: data?.stats?.high || 0,
                    low24h: data?.stats?.low || 0,
                    volume24h: data?.stats?.volume || 0,
                    openInterest: data?.open_interest || 0,
                    fundingRate: data?.current_funding || 0,
                    impliedVolatility: data?.mark_iv || 0,
                    timestamp: data?.timestamp || Date.now(),
                };
                break;
            case 'index':
                result = {
                    currency: 'BTC',
                    price: data?.BTC || 0,
                };
                break;
            case 'funding':
                result = (data || []).map((f: { timestamp: number; interest_8h: number }) => ({
                    timestamp: f.timestamp,
                    rate: f.interest_8h || 0,
                }));
                break;
            case 'oi':
                result = {
                    openInterest: data || 0,
                };
                break;
            default:
                result = data;
        }

        return NextResponse.json({
            success: true,
            data: result,
            exchange: 'deribit',
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Deribit API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Deribit data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
