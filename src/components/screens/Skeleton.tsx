'use client';

export function ComingSoon({ title }: { title: string }) {
    return (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h2 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>{title}</h2>
            <p>Module under construction.</p>
        </div>
    );
}

export const Dashboard = () => <ComingSoon title="DASHBOARD (Macro)" />;
export const Markets = () => <ComingSoon title="MARKETS (Scanner)" />;
export const Compare = () => <ComingSoon title="COMPARE (Arbitrage)" />;
export const Derivatives = () => <ComingSoon title="DERIVATIVES (Analytics)" />;
export const OnChain = () => <ComingSoon title="ON-CHAIN (DeFi)" />;
export const News = () => <ComingSoon title="NEWS (Intel)" />;
export const Watchlist = () => <ComingSoon title="WATCHLIST" />;
