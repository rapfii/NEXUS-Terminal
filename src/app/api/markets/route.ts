/**
 * Multi-Exchange Markets API
 * Returns all futures markets with bid/ask/spread/funding/OI
 */

import { NextRequest, NextResponse } from 'next/server';

const BINANCE_FUTURES = 'https://fapi.binance.com/fapi/v1';
const BINANCE_SPOT = 'https://api.binance.com/api/v3';

interface FuturesTicker {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    spread: number;
    spreadBps: number;
    volume24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
    fundingRate: number;
    openInterest: number;
    markPrice: number;
    indexPrice: number;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'futures';

    try {
        if (type === 'futures') {
            // Fetch ticker with bookTicker for bid/ask, and funding data
            const [tickerRes, bookRes, fundingRes] = await Promise.all([
                fetch(`${BINANCE_FUTURES}/ticker/24hr`),
                fetch(`${BINANCE_FUTURES}/ticker/bookTicker`), // This has bid/ask
                fetch(`${BINANCE_FUTURES}/premiumIndex`),
            ]);

            if (!tickerRes.ok || !bookRes.ok || !fundingRes.ok) {
                throw new Error('Failed to fetch from Binance');
            }

            const [tickers, bookTickers, premiumData] = await Promise.all([
                tickerRes.json(),
                bookRes.json(),
                fundingRes.json(),
            ]);

            // Create maps for quick lookup
            const bookMap = new Map<string, { bid: number; ask: number }>();
            (bookTickers as any[]).forEach((b: any) => {
                bookMap.set(b.symbol, {
                    bid: parseFloat(b.bidPrice),
                    ask: parseFloat(b.askPrice),
                });
            });

            const fundingMap = new Map<string, { markPrice: number; indexPrice: number; fundingRate: number }>();
            (premiumData as any[]).forEach((p: any) => {
                fundingMap.set(p.symbol, {
                    markPrice: parseFloat(p.markPrice),
                    indexPrice: parseFloat(p.indexPrice),
                    fundingRate: parseFloat(p.lastFundingRate || '0'),
                });
            });

            // Parse tickers
            const markets: FuturesTicker[] = (tickers as any[])
                .filter((t: any) => t.symbol.endsWith('USDT'))
                .map((t: any) => {
                    const book = bookMap.get(t.symbol);
                    const funding = fundingMap.get(t.symbol);
                    const bid = book?.bid || 0;
                    const ask = book?.ask || 0;
                    const spread = ask > 0 && bid > 0 ? ask - bid : 0;
                    const spreadBps = bid > 0 ? (spread / bid) * 10000 : 0;

                    return {
                        symbol: t.symbol,
                        price: parseFloat(t.lastPrice),
                        bid,
                        ask,
                        spread,
                        spreadBps,
                        volume24h: parseFloat(t.quoteVolume),
                        change24h: parseFloat(t.priceChangePercent),
                        high24h: parseFloat(t.highPrice),
                        low24h: parseFloat(t.lowPrice),
                        fundingRate: funding?.fundingRate || 0,
                        openInterest: 0,
                        markPrice: funding?.markPrice || parseFloat(t.lastPrice),
                        indexPrice: funding?.indexPrice || parseFloat(t.lastPrice),
                    };
                })
                .sort((a: FuturesTicker, b: FuturesTicker) => b.volume24h - a.volume24h);

            return NextResponse.json({
                success: true,
                data: markets.slice(0, 100),
                timestamp: Date.now(),
            });
        }

        // Spot tickers with bid/ask
        const [tickerRes, bookRes] = await Promise.all([
            fetch(`${BINANCE_SPOT}/ticker/24hr`),
            fetch(`${BINANCE_SPOT}/ticker/bookTicker`),
        ]);

        const [tickers, bookTickers] = await Promise.all([
            tickerRes.json(),
            bookRes.json(),
        ]);

        const bookMap = new Map<string, { bid: number; ask: number }>();
        (bookTickers as any[]).forEach((b: any) => {
            bookMap.set(b.symbol, {
                bid: parseFloat(b.bidPrice),
                ask: parseFloat(b.askPrice),
            });
        });

        const markets = (tickers as any[])
            .filter((t: any) => t.symbol.endsWith('USDT'))
            .map((t: any) => {
                const book = bookMap.get(t.symbol);
                const bid = book?.bid || 0;
                const ask = book?.ask || 0;
                const spread = ask > 0 && bid > 0 ? ask - bid : 0;
                const spreadBps = bid > 0 ? (spread / bid) * 10000 : 0;

                return {
                    symbol: t.symbol,
                    price: parseFloat(t.lastPrice),
                    bid,
                    ask,
                    spread,
                    spreadBps,
                    volume24h: parseFloat(t.quoteVolume),
                    change24h: parseFloat(t.priceChangePercent),
                    high24h: parseFloat(t.highPrice),
                    low24h: parseFloat(t.lowPrice),
                };
            })
            .sort((a: any, b: any) => b.volume24h - a.volume24h);

        return NextResponse.json({
            success: true,
            data: markets.slice(0, 100),
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Markets API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
    }
}
