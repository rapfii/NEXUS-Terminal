/**
 * OKX API Route - Spot & Futures Data
 */

import { NextRequest, NextResponse } from 'next/server';

const OKX_BASE = 'https://www.okx.com/api/v5';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTC-USDT';
    const type = searchParams.get('type') || 'ticker';

    try {
        let endpoint = '';

        switch (type) {
            case 'ticker':
                endpoint = `/market/ticker?instId=${symbol}`;
                break;
            case 'depth':
                endpoint = `/market/books?instId=${symbol}&sz=20`;
                break;
            case 'trades':
                endpoint = `/market/trades?instId=${symbol}&limit=50`;
                break;
            case 'funding':
                endpoint = `/public/funding-rate?instId=${symbol}-SWAP`;
                break;
            case 'oi':
                endpoint = `/public/open-interest?instType=SWAP&instId=${symbol}-SWAP`;
                break;
            case 'mark':
                endpoint = `/public/mark-price?instType=SWAP&instId=${symbol}-SWAP`;
                break;
            default:
                endpoint = `/market/ticker?instId=${symbol}`;
        }

        const res = await fetch(`${OKX_BASE}${endpoint}`, { next: { revalidate: 5 } });

        if (!res.ok) throw new Error('OKX API error');

        const json = await res.json();

        if (json.code !== '0') {
            throw new Error(json.msg || 'OKX API error');
        }

        const data = json.data?.[0] || {};

        let result;
        switch (type) {
            case 'ticker':
                result = {
                    symbol: data.instId,
                    price: parseFloat(data.last) || 0,
                    bestBid: parseFloat(data.bidPx) || 0,
                    bestAsk: parseFloat(data.askPx) || 0,
                    high24h: parseFloat(data.high24h) || 0,
                    low24h: parseFloat(data.low24h) || 0,
                    volume24h: parseFloat(data.vol24h) || 0,
                    change24h: parseFloat(data.sodUtc8) || 0,
                    timestamp: parseInt(data.ts) || Date.now(),
                };
                break;
            case 'funding':
                result = {
                    symbol: data.instId,
                    fundingRate: parseFloat(data.fundingRate) || 0,
                    nextFundingTime: parseInt(data.nextFundingTime) || 0,
                };
                break;
            case 'oi':
                result = {
                    symbol: data.instId,
                    openInterest: parseFloat(data.oi) || 0,
                    openInterestUsd: parseFloat(data.oiCcy) || 0,
                };
                break;
            case 'mark':
                result = {
                    symbol: data.instId,
                    markPrice: parseFloat(data.markPx) || 0,
                };
                break;
            default:
                result = data;
        }

        return NextResponse.json({
            success: true,
            data: result,
            exchange: 'okx',
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('OKX API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch OKX data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
