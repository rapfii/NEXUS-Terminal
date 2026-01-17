'use client';

import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { Terminal } from '@/components/screens/Terminal';
import { Dashboard } from '@/components/screens/Dashboard';
import { Markets } from '@/components/screens/Markets';
import { Derivatives } from '@/components/screens/Derivatives';
import { Compare } from '@/components/screens/Compare';
import { OnChain } from '@/components/screens/OnChain';
import { News } from '@/components/screens/News';
import { Watchlist } from '@/components/screens/Watchlist';

import Yields from '@/components/screens/Yields';

export default function Page() {
    const [activeTab, setActiveTab] = useState('terminal');

    return (
        <Shell activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'markets' && <Markets />}
            {activeTab === 'terminal' && <Terminal />}
            {activeTab === 'compare' && <Compare />}
            {activeTab === 'derivatives' && <Derivatives />}
            {activeTab === 'yields' && <Yields />}
            {activeTab === 'onchain' && <OnChain />}
            {activeTab === 'news' && <News />}
            {activeTab === 'watchlist' && <Watchlist />}
        </Shell>
    );
}
