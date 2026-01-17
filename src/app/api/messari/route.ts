/**
 * Messari API Route - On-chain metrics & fundamentals
 */

import { NextRequest, NextResponse } from 'next/server';

const MESSARI_BASE = 'https://data.messari.io/api/v1';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'bitcoin';
    const type = searchParams.get('type') || 'metrics';

    try {
        let endpoint = '';

        switch (type) {
            case 'metrics':
                endpoint = `/assets/${symbol}/metrics`;
                break;
            case 'market':
                endpoint = `/assets/${symbol}/metrics/market-data`;
                break;
            case 'profile':
                endpoint = `/assets/${symbol}/profile`;
                break;
            case 'assets':
                endpoint = '/assets?limit=50';
                break;
            case 'news':
                endpoint = '/news?limit=20';
                break;
            default:
                endpoint = `/assets/${symbol}/metrics`;
        }

        const res = await fetch(`${MESSARI_BASE}${endpoint}`, { next: { revalidate: 300 } });

        if (!res.ok) throw new Error('Messari API error');

        const json = await res.json();
        const data = json.data;

        let result;
        switch (type) {
            case 'metrics':
                result = {
                    symbol: data?.symbol,
                    name: data?.name,
                    price: data?.market_data?.price_usd || 0,
                    volume24h: data?.market_data?.volume_last_24_hours || 0,
                    marketCap: data?.marketcap?.current_marketcap_usd || 0,
                    marketCapDominance: data?.marketcap?.marketcap_dominance_percent || 0,
                    roi: {
                        last24h: data?.roi_data?.percent_change_last_1_hour || 0,
                        last7d: data?.roi_data?.percent_change_last_1_week || 0,
                        last30d: data?.roi_data?.percent_change_last_1_month || 0,
                        ytd: data?.roi_data?.percent_change_year_to_date || 0,
                    },
                    supply: {
                        circulating: data?.supply?.circulating || 0,
                        total: data?.supply?.total || 0,
                        max: data?.supply?.max || 0,
                    },
                    blockchain: {
                        txnCount24h: data?.blockchain_stats_24_hours?.count_of_tx_24_hours || 0,
                        txnVolume24h: data?.blockchain_stats_24_hours?.transaction_volume_24_hours || 0,
                        activeAddresses: data?.blockchain_stats_24_hours?.count_of_active_addresses || 0,
                    },
                    allTimeHigh: {
                        price: data?.all_time_high?.price || 0,
                        date: data?.all_time_high?.at || null,
                        percentDown: data?.all_time_high?.percent_down || 0,
                    },
                };
                break;
            case 'assets':
                result = (data || []).map((a: {
                    symbol: string;
                    name: string;
                    metrics: {
                        market_data: { price_usd: number };
                        marketcap: { current_marketcap_usd: number };
                    };
                }) => ({
                    symbol: a.symbol,
                    name: a.name,
                    price: a.metrics?.market_data?.price_usd || 0,
                    marketCap: a.metrics?.marketcap?.current_marketcap_usd || 0,
                }));
                break;
            case 'news':
                result = (data || []).map((n: {
                    id: string;
                    title: string;
                    published_at: string;
                    author: { name: string };
                    url: string;
                }) => ({
                    id: n.id,
                    title: n.title,
                    publishedAt: n.published_at,
                    author: n.author?.name || 'Unknown',
                    url: n.url,
                }));
                break;
            default:
                result = data;
        }

        return NextResponse.json({
            success: true,
            data: result,
            source: 'messari',
            cached: false,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error('Messari API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch Messari data', timestamp: Date.now() },
            { status: 500 }
        );
    }
}
