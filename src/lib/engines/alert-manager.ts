/**
 * Squeeze Alert Manager
 * Handles alert suppression to reduce false positives
 * Phase 3: Alert System
 */

import type { SqueezeSignal } from '@/lib/types-extended';

// ============================================
// TYPES
// ============================================

export interface SqueezeAlert {
    id: string;
    signal: SqueezeSignal;
    createdAt: number;
    notifiedAt: number | null;
    suppressed: boolean;
    suppressReason?: string;
    confirmedAt?: number;
    resolvedAt?: number;
}

export interface AlertSettings {
    minProbability: number;      // 0-100
    minStrength: 'LOADING' | 'BUILDING' | 'IMMINENT' | 'ACTIVE';
    cooldownMs: number;          // ms between alerts for same symbol
    requireMultiExchange: boolean;
    suppressNearSettlement: boolean;  // Suppress within 1h of funding settlement
}

// ============================================
// DEFAULT SETTINGS
// ============================================

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
    minProbability: 60,
    minStrength: 'IMMINENT',
    cooldownMs: 15 * 60 * 1000,  // 15 minutes
    requireMultiExchange: false,
    suppressNearSettlement: true,
};

// ============================================
// ALERT MANAGER
// ============================================

class SqueezeAlertManager {
    private alerts: Map<string, SqueezeAlert> = new Map();
    private settings: AlertSettings = DEFAULT_ALERT_SETTINGS;
    private lastNotified: Map<string, number> = new Map();  // symbol -> timestamp

    /**
     * Update settings
     */
    updateSettings(settings: Partial<AlertSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    /**
     * Process a squeeze signal and determine if an alert should be fired
     */
    processSignal(signal: SqueezeSignal): { shouldAlert: boolean; reason: string } {
        const alertId = `${signal.symbol}-${signal.type}`;

        // Check probability threshold
        if (signal.probability < this.settings.minProbability) {
            return {
                shouldAlert: false,
                reason: `Probability ${signal.probability.toFixed(0)}% below threshold ${this.settings.minProbability}%`
            };
        }

        // Check strength threshold
        const strengthOrder = ['LOADING', 'BUILDING', 'IMMINENT', 'ACTIVE'];
        const signalStrengthIndex = strengthOrder.indexOf(signal.strength);
        const minStrengthIndex = strengthOrder.indexOf(this.settings.minStrength);

        if (signalStrengthIndex < minStrengthIndex) {
            return {
                shouldAlert: false,
                reason: `Strength ${signal.strength} below threshold ${this.settings.minStrength}`
            };
        }

        // Check cooldown
        const lastNotifyTime = this.lastNotified.get(signal.symbol) || 0;
        const timeSinceLastNotify = Date.now() - lastNotifyTime;

        if (timeSinceLastNotify < this.settings.cooldownMs) {
            const remainingCooldown = Math.ceil((this.settings.cooldownMs - timeSinceLastNotify) / 60000);
            return {
                shouldAlert: false,
                reason: `Cooldown: ${remainingCooldown}m remaining for ${signal.symbol}`
            };
        }

        // Check funding settlement proximity
        if (this.settings.suppressNearSettlement) {
            const now = Date.now();
            // Funding happens at 00:00, 08:00, 16:00 UTC
            const hour = new Date(now).getUTCHours();
            const nearSettlement = [23, 0, 7, 8, 15, 16].includes(hour);

            if (nearSettlement) {
                return {
                    shouldAlert: false,
                    reason: `Suppressed: Near funding settlement (hour ${hour} UTC)`
                };
            }
        }

        // Check component quality (at least 3 active components for quality)
        const activeComponents = Object.values(signal.components).filter(c => c.active).length;
        if (activeComponents < 3) {
            return {
                shouldAlert: false,
                reason: `Low quality: Only ${activeComponents}/6 components active`
            };
        }

        // All checks passed - should alert
        this.lastNotified.set(signal.symbol, Date.now());

        // Store alert
        const alert: SqueezeAlert = {
            id: alertId,
            signal,
            createdAt: Date.now(),
            notifiedAt: Date.now(),
            suppressed: false,
        };
        this.alerts.set(alertId, alert);

        return {
            shouldAlert: true,
            reason: `ALERT: ${signal.symbol} ${signal.type} at ${signal.probability.toFixed(0)}% probability`
        };
    }

    /**
     * Get all active alerts
     */
    getActiveAlerts(): SqueezeAlert[] {
        return Array.from(this.alerts.values())
            .filter(a => !a.suppressed && !a.resolvedAt)
            .sort((a, b) => b.signal.probability - a.signal.probability);
    }

    /**
     * Get suppression statistics
     */
    getSuppressionStats(): {
        totalProcessed: number;
        alertsFired: number;
        suppressedByProbability: number;
        suppressedByStrength: number;
        suppressedByCooldown: number;
        suppressedBySettlement: number;
        suppressedByQuality: number;
    } {
        // In a real implementation, track these stats
        return {
            totalProcessed: this.alerts.size + 50,  // Mock - would track all processed
            alertsFired: this.alerts.size,
            suppressedByProbability: 20,
            suppressedByStrength: 15,
            suppressedByCooldown: 10,
            suppressedBySettlement: 3,
            suppressedByQuality: 2,
        };
    }

    /**
     * Clear old alerts (older than 24h)
     */
    cleanup(): void {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        for (const [id, alert] of this.alerts.entries()) {
            if (alert.createdAt < cutoff) {
                this.alerts.delete(id);
            }
        }
    }
}

// Singleton
export const alertManager = new SqueezeAlertManager();

export default alertManager;
