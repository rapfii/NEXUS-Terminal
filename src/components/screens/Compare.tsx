'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatLargeNumber, formatPrice } from '@/lib/i18n';
import { useLanguageStore, useMarketStore } from '@/stores';
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ArrowRight,
    ChevronUp,
    ChevronDown
} from 'lucide-react';
import styles from './Compare.module.css';

interface ExchangeData {
    exchange: string;
    price: number;
    bid: number;
    ask: number;
    volume24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
    timestamp: number;
    status: string;
}

// Fee structure per exchange (maker/taker in bps)
const EXCHANGE_FEES: Record<string, { maker: number; taker: number; withdraw: number }> = {
    binance: { maker: 10, taker: 10, withdraw: 0.0005 }, // 0.1%
    bybit: { maker: 10, taker: 10, withdraw: 0.0005 },
    okx: { maker: 8, taker: 10, withdraw: 0.0004 },
    kucoin: { maker: 10, taker: 10, withdraw: 0.0005 },
    gateio: { maker: 15, taker: 15, withdraw: 0.001 },
    bitget: { maker: 10, taker: 10, withdraw: 0.0006 },
};

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

export function Compare() {
    const { locale } = useLanguageStore();
    const { symbol, setSymbol } = useMarketStore();
    const [data, setData] = useState<ExchangeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSymbol, setSelectedSymbol] = useState(symbol || 'BTCUSDT');
    const [tradeSize, setTradeSize] = useState<number>(10000); // Default $10k

    useEffect(() => {
        const fetchAgg = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/aggregator?symbol=${selectedSymbol}`);
                const d = await res.json();
                if (d.data?.exchanges) {
                    setData(d.data.exchanges.filter((e: ExchangeData) => e.status === 'online'));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchAgg();
        const iv = setInterval(fetchAgg, 2000);
        return () => clearInterval(iv);
    }, [selectedSymbol]);

    // Calculate real executable arbitrage with fees and slippage
    const analysis = useMemo(() => {
        if (data.length === 0) {
            return {
                bestBid: null,
                bestAsk: null,
                rawArb: 0,
                netArb: 0,
                arbPercent: 0,
                isRealOpportunity: false,
                breakdown: null,
                avgPrice: 0,
                priceRange: 0,
            };
        }

        const bb = data.reduce((m, e) => e.bid > m.bid ? e : m, data[0]);
        const ba = data.reduce((m, e) => e.ask > 0 && e.ask < m.ask ? e : m, { ...data[0], ask: Infinity });

        if (ba.ask === Infinity) {
            return {
                bestBid: bb,
                bestAsk: null,
                rawArb: 0,
                netArb: 0,
                arbPercent: 0,
                isRealOpportunity: false,
                breakdown: null,
                avgPrice: data.reduce((acc, e) => acc + e.price, 0) / data.length,
                priceRange: Math.max(...data.map(e => e.price)) - Math.min(...data.map(e => e.price)),
            };
        }

        const rawSpread = bb.bid - ba.ask;
        const rawPercent = ba.ask > 0 ? (rawSpread / ba.ask) * 100 : 0;

        // Calculate fees
        const buyFees = EXCHANGE_FEES[ba.exchange]?.taker || 10;
        const sellFees = EXCHANGE_FEES[bb.exchange]?.taker || 10;
        const buyFeeCost = (buyFees / 10000) * tradeSize;
        const sellFeeCost = (sellFees / 10000) * tradeSize;

        // Estimate slippage (rough: 0.05% per $10k for BTC, more for alts)
        const slippageRate = selectedSymbol === 'BTCUSDT' ? 0.0005 : 0.001;
        const slippageCost = slippageRate * tradeSize * 2; // Both sides

        // Withdrawal cost (if moving funds)
        const withdrawRate = EXCHANGE_FEES[ba.exchange]?.withdraw || 0.0005;
        const withdrawCost = withdrawRate * (tradeSize / ba.ask);

        const totalCosts = buyFeeCost + sellFeeCost + slippageCost;
        const grossProfit = rawSpread > 0 ? (rawSpread / ba.ask) * tradeSize : 0;
        const netProfit = grossProfit - totalCosts;

        const avg = data.reduce((acc, e) => acc + e.price, 0) / data.length;
        const range = Math.max(...data.map(e => e.price)) - Math.min(...data.map(e => e.price));

        return {
            bestBid: bb,
            bestAsk: ba,
            rawArb: Math.max(0, rawSpread),
            netArb: Math.max(0, netProfit),
            arbPercent: Math.max(0, rawPercent),
            isRealOpportunity: netProfit > 0,
            breakdown: {
                grossProfit,
                buyFee: buyFeeCost,
                sellFee: sellFeeCost,
                slippage: slippageCost,
                withdrawFee: withdrawCost,
                netProfit,
            },
            avgPrice: avg,
            priceRange: range,
        };
    }, [data, tradeSize, selectedSymbol]);

    const handleSymbolChange = (sym: string) => {
        setSelectedSymbol(sym);
        setSymbol(sym);
    };

    return (
        <div className={styles.container}>
            {/* HEADER */}
            <div className={styles.header}>
                <div className={styles.symbolSelector}>
                    {SYMBOLS.map(s => (
                        <button
                            key={s}
                            className={`${styles.symBtn} ${selectedSymbol === s ? styles.active : ''}`}
                            onClick={() => handleSymbolChange(s)}
                        >
                            {s.replace('USDT', '')}
                        </button>
                    ))}
                </div>

                {/* Trade Size Input */}
                <div className={styles.sizeInput}>
                    <label>TRADE SIZE</label>
                    <div className={styles.sizeOptions}>
                        {[1000, 10000, 50000, 100000].map(size => (
                            <button
                                key={size}
                                className={`${styles.sizeBtn} ${tradeSize === size ? styles.active : ''}`}
                                onClick={() => setTradeSize(size)}
                            >
                                ${formatLargeNumber(size, locale)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ARBITRAGE ANALYSIS - Honest View */}
            <div className={`${styles.arbPanel} ${analysis.isRealOpportunity ? styles.opportunity : styles.noOpportunity}`}>
                <div className={styles.arbHeader}>
                    {analysis.isRealOpportunity ? (
                        <>
                            <CheckCircle2 size={20} className={styles.icon} />
                            REAL OPPORTUNITY
                        </>
                    ) : (
                        <>
                            <XCircle size={20} className={styles.icon} />
                            NO REAL ARBITRAGE
                        </>
                    )}
                </div>
                <div className={styles.arbGrid}>
                    <div className={styles.arbBox}>
                        <small>BUY</small>
                        <span className={styles.exchange}>{analysis.bestAsk?.exchange.toUpperCase() || '--'}</span>
                        <span className={styles.price}>${analysis.bestAsk ? formatPrice(analysis.bestAsk.ask, locale) : '--'}</span>
                    </div>
                    <div className={styles.arbArrow}>
                        <ArrowRight size={24} />
                    </div>
                    <div className={styles.arbBox}>
                        <small>SELL</small>
                        <span className={styles.exchange}>{analysis.bestBid?.exchange.toUpperCase() || '--'}</span>
                        <span className={styles.price}>${analysis.bestBid ? formatPrice(analysis.bestBid.bid, locale) : '--'}</span>
                    </div>
                </div>

                {analysis.breakdown && (
                    <div className={styles.breakdown}>
                        <div className={styles.breakdownRow}>
                            <span>Gross Spread</span>
                            <span className={analysis.breakdown.grossProfit > 0 ? styles.pos : ''}>
                                ${analysis.breakdown.grossProfit.toFixed(2)}
                            </span>
                        </div>
                        <div className={styles.breakdownRow}>
                            <span>Buy Fee ({EXCHANGE_FEES[analysis.bestAsk?.exchange || 'binance']?.taker || 10} bps)</span>
                            <span className={styles.neg}>-${analysis.breakdown.buyFee.toFixed(2)}</span>
                        </div>
                        <div className={styles.breakdownRow}>
                            <span>Sell Fee ({EXCHANGE_FEES[analysis.bestBid?.exchange || 'binance']?.taker || 10} bps)</span>
                            <span className={styles.neg}>-${analysis.breakdown.sellFee.toFixed(2)}</span>
                        </div>
                        <div className={styles.breakdownRow}>
                            <span>Est. Slippage (both sides)</span>
                            <span className={styles.neg}>-${analysis.breakdown.slippage.toFixed(2)}</span>
                        </div>
                        <div className={`${styles.breakdownRow} ${styles.totalRow}`}>
                            <span>NET PROFIT</span>
                            <span className={analysis.breakdown.netProfit > 0 ? styles.pos : styles.neg}>
                                ${analysis.breakdown.netProfit.toFixed(2)}
                            </span>
                        </div>
                    </div>
                )}

                {!analysis.isRealOpportunity && analysis.rawArb > 0 && (
                    <div className={styles.warning}>
                        <AlertTriangle size={16} />
                        Raw spread of ${analysis.rawArb.toFixed(2)} exists, but after fees and slippage, no profit remains.
                    </div>
                )}
            </div>

            {/* STATS */}
            <div className={styles.stats}>
                <div className={styles.statBox}>
                    <small>PRICE RANGE</small>
                    <span>${analysis.priceRange.toFixed(2)}</span>
                </div>
                <div className={styles.statBox}>
                    <small>AVG PRICE</small>
                    <span>${formatPrice(analysis.avgPrice, locale)}</span>
                </div>
                <div className={styles.statBox}>
                    <small>EXCHANGES</small>
                    <span>{data.length} online</span>
                </div>
            </div>

            {/* EXCHANGE TABLE */}
            <div className={styles.grid}>
                <div className={styles.tableHeader}>
                    <div>EXCHANGE</div>
                    <div>PRICE</div>
                    <div>BID</div>
                    <div>ASK</div>
                    <div>SPREAD</div>
                    <div>FEE (TAKER)</div>
                    <div>24H VOL</div>
                    <div>24H %</div>
                </div>
                <div className={styles.tableBody}>
                    {loading ? (
                        <div className={styles.loading}>Scanning {data.length > 0 ? data.length : '6'} Exchanges...</div>
                    ) : data.map(e => {
                        const isBestBid = analysis.bestBid && e.exchange === analysis.bestBid.exchange;
                        const isBestAsk = analysis.bestAsk && e.exchange === analysis.bestAsk.exchange;
                        const spread = e.ask - e.bid;
                        const spreadBps = e.bid > 0 ? (spread / e.bid) * 10000 : 0;
                        const fees = EXCHANGE_FEES[e.exchange] || { taker: 10 };

                        return (
                            <div
                                key={e.exchange}
                                className={`${styles.row} ${isBestBid ? styles.highlightBid : ''} ${isBestAsk ? styles.highlightAsk : ''}`}
                            >
                                <div className={styles.cell}>
                                    <b>{e.exchange.toUpperCase()}</b>
                                    {isBestBid && <span className={styles.bestBidBadge}>BEST BID</span>}
                                    {isBestAsk && <span className={styles.bestAskBadge}>BEST ASK</span>}
                                </div>
                                <div className={styles.cell}>
                                    <span className={styles.mono}>${formatPrice(e.price, locale)}</span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={styles.bid}>${formatPrice(e.bid, locale)}</span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={styles.ask}>${formatPrice(e.ask, locale)}</span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={styles.dim}>{spreadBps.toFixed(2)} bps</span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={styles.dim}>{fees.taker} bps</span>
                                </div>
                                <div className={styles.cell}>
                                    <span>${formatLargeNumber(e.volume24h, locale)}</span>
                                </div>
                                <div className={styles.cell}>
                                    <span className={e.change24h >= 0 ? styles.positive : styles.negative}>
                                        {e.change24h >= 0 ? '+' : ''}{e.change24h.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
