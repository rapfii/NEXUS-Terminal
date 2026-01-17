/**
 * i18n Hook - Internationalization
 */

'use client';

import { useLanguageStore } from '@/stores';
import en from '../../../public/locales/en.json';
import id from '../../../public/locales/id.json';

type Translations = typeof en;
type NestedKeyOf<T> = T extends object
    ? { [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : K) : never }[keyof T]
    : never;

const translations: Record<'en' | 'id', Translations> = { en, id };

/**
 * Get nested value from object by dot-notation path
 */
function getNestedValue(obj: unknown, path: string): string {
    const keys = path.split('.');
    let result: unknown = obj;

    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = (result as Record<string, unknown>)[key];
        } else {
            return path;
        }
    }

    return typeof result === 'string' ? result : path;
}

/**
 * Translation hook
 */
export function useTranslation() {
    const { locale, setLocale } = useLanguageStore();
    const t = translations[locale];

    const translate = (key: string, params?: Record<string, string | number>): string => {
        let text = getNestedValue(t, key);

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }

        return text;
    };

    return {
        t: translate,
        locale,
        setLocale,
        isEnglish: locale === 'en',
        isIndonesian: locale === 'id',
    };
}

/**
 * Format large numbers (1.5T, 500B, etc.)
 */
export function formatLargeNumber(num: number | null | undefined, locale: 'en' | 'id' = 'en'): string {
    if (num == null || isNaN(num)) return '--';

    const trillion = 1_000_000_000_000;
    const billion = 1_000_000_000;
    const million = 1_000_000;

    if (num >= trillion) {
        return (num / trillion).toFixed(2) + 'T';
    } else if (num >= billion) {
        return (num / billion).toFixed(2) + 'B';
    } else if (num >= million) {
        return (num / million).toFixed(2) + 'M';
    }

    return num.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US');
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price: number | null | undefined, locale: 'en' | 'id' = 'en'): string {
    if (price == null || isNaN(price)) return '--';

    if (price >= 1000) {
        return price.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    } else if (price >= 1) {
        return price.toFixed(4);
    } else if (price >= 0.0001) {
        return price.toFixed(6);
    }
    return price.toFixed(8);
}

/**
 * Format percentage
 */
export function formatPercent(value: number | null | undefined, showSign = true): string {
    if (value == null || isNaN(value)) return '--';
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format funding rate (usually very small)
 */
export function formatFunding(rate: number | null | undefined): string {
    if (rate == null || isNaN(rate)) return '--';
    return `${(rate * 100).toFixed(4)}%`;
}

/**
 * Format date/time
 */
export function formatTime(timestamp: number, locale: 'en' | 'id' = 'en'): string {
    return new Date(timestamp).toLocaleTimeString(locale === 'id' ? 'id-ID' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export default useTranslation;
