/**
 * Candlestick Chart Component
 * Uses TradingView Lightweight Charts
 */

'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { useMarketStore } from '@/stores';
import { useTranslation } from '@/lib/i18n';
import type { Kline, Timeframe } from '@/lib/types';
import styles from './CandlestickChart.module.css';

interface CandlestickChartProps {
    data?: Kline[];
    onTimeframeChange?: (tf: Timeframe) => void;
    timeframe?: Timeframe;
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function CandlestickChart({
    data = [],
    onTimeframeChange,
    timeframe = '1h',
}: CandlestickChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const { symbol, instrument } = useMarketStore();
    const { t } = useTranslation();

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { color: '#0b0f14' },
                textColor: '#9ca3af',
            },
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    color: '#3b82f6',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#3b82f6',
                },
                horzLine: {
                    color: '#3b82f6',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#3b82f6',
                },
            },
            rightPriceScale: {
                borderColor: '#1f2937',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2,
                },
            },
            timeScale: {
                borderColor: '#1f2937',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // Candlestick series
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        // Volume series
        const volumeSeries = chart.addHistogramSeries({
            color: '#3b82f6',
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    // Update data
    useEffect(() => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current || !data.length) return;

        const candleData: CandlestickData<Time>[] = data.map((k) => ({
            time: (k.time / 1000) as Time,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
        }));

        const volumeData = data.map((k) => ({
            time: (k.time / 1000) as Time,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }));

        candleSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

        // Fit content
        chartRef.current?.timeScale().fitContent();
    }, [data]);

    // Update last candle in real-time
    useEffect(() => {
        if (!candleSeriesRef.current || !instrument) return;

        const lastCandle = data[data.length - 1];
        if (!lastCandle) return;

        // Update the last candle with current price
        candleSeriesRef.current.update({
            time: (lastCandle.time / 1000) as Time,
            open: lastCandle.open,
            high: Math.max(lastCandle.high, instrument.price),
            low: Math.min(lastCandle.low, instrument.price),
            close: instrument.price,
        });
    }, [instrument, data]);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.symbolInfo}>
                    <span className={styles.symbol}>{symbol}</span>
                    {instrument && (
                        <>
                            <span className={`${styles.price} mono`}>
                                {instrument.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className={`${styles.change} ${instrument.price >= (data[data.length - 1]?.open || 0) ? 'positive' : 'negative'}`}>
                                {((instrument.price / (data[data.length - 1]?.open || instrument.price) - 1) * 100).toFixed(2)}%
                            </span>
                        </>
                    )}
                </div>

                <div className={styles.timeframes}>
                    {TIMEFRAMES.map((tf) => (
                        <button
                            key={tf}
                            className={`${styles.tfBtn} ${timeframe === tf ? styles.active : ''}`}
                            onClick={() => onTimeframeChange?.(tf)}
                        >
                            {t(`terminal.timeframes.${tf}`)}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={chartContainerRef} className={styles.chart} />
        </div>
    );
}
