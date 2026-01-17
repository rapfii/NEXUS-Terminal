/**
 * Bitget API Route - Spot & Mix (Futures)
 */

import { NextRequest, NextResponse } from 'next/server';

const BITGET_BASE = 'https://api.bitget.com';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const type = searchParams.get('type') || 'ticker';
    const productType = searchParams.get('productType') || 'USDT-FUTURES';

    try {
        let endpoint = '';

        switch (type) {
            case 'ticker':
                endpoint = `/api/v2/mix/market/ticker?symbol=${symbol}&productType=${productType}`;
                break;
            case 'depth':
                endpoint = `/api/v2/mix/market/orderbook?symbol=${symbol}&productType=${productType}&limit=20`;
                break;
            case 'funding':
                endpoint = `/api/v2/mix/market/current-fund-rate?symbol=${symbol}&productType=${productType}`;
                break;
            case 'oi':
                endpoint = `/api/v2/mix/market/open-interest?symbol=${symbol}&productType=${productType}`;
                break;
            case 'tickers':
                endpoint = `/api/v2/mix/market/tickers?productType=${productType}`;
                break;
            default:
                endpoint = `/api/v2/mix/market/ticker?symbol=${symbol}&productType=${productType}`;
        }

        const res = await fetch(`${BITGET_BASE}${endpoint}`, { next: { revalidate: 5 } });

        if (!res.ok) throw new Error('Bitget API error');

        const json = await res.json();

        if (json.code !== '00000') {
            throw new Error(json.msg || 'Bitget API error');
        }

        const data = json.data;

        let result;
        switch (type) {
            case 'ticker':
                result = {
                    symbol: data?.symbol,
                    price: parseFloat(data?.lastPr) || 0,
                    bestBid: parseFloat(data?.bidPr) || 0,
                    bestAsk: parseFloat(data?.askPr) || 0,
                    high24h: parseFloat(data?.high24h) || 0,
                    low24h: parseFloat(data?.low24h) || 0,
                    volume24h: parseFloat(data?.baseVolume) || 0,
                    quoteVolume: parseFloat(data?.quoteVolume) || 0,
                    openUtc: parseFloat(data?.openUtc) || 0,
                    changeUtc24h: parseFloat(data?.changeUtc24h) || 0,
                    indexPrice: parseFloat(data?.indexPrice) || 0,
                    markPrice: parseFloat(data?.markPrice) || 0,
                    fundingRate: parseFloat(data?.fundingRate) || 0,
                    timestamp: parseInt(data?.ts) || Date.now(),
                };
                break;
            case 'funding':
                result = {
                    symbol: data?.symbol,
                    fundingRate: parseFloat(data?.fundingRate) || 0,
                };
                break;
            case 'oi':
                result = {
                    symbol: data?.symbol,
                    openInterest: parseFloat(data?.openInterest) || 0,
                    openInterestUsd: parseFloat(data?.openInterestUsd) || 0,
                };
                break;
            case 'tickers':
                result = (Array.isArray(data) ? data : []).map((t: {
                    symbol: string;
                    lastPr: string;
                    changeUtc24h: string;
                    baseVolume: string;
                    fundingRate: string;
                }) => ({
                    symbol: t.symbol,
                    price: parseFloat(t.lastPr) || 0,
                    change24h: parseFloat(t.changeUtc24h) || 0,
                    volume: parseFloat(t.baseVolume) || 0,
                    fundingRate: parseFloat(t.fundingRate) || 0,
                }));
                break;
            default:
                result = data;
        }

        return NextResponse.json({
            success: true,
            data: result,
            exchange: 'bitget',
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Bitget API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Bitget data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
