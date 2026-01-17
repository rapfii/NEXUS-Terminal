/**
 * War Room Page
 * The 10-second market intelligence read
 */

import TerminalLayout from '@/components/layout/TerminalLayout';
import { WarRoom } from '@/components/screens/WarRoom';

export const metadata = {
    title: 'War Room | NEXUS Terminal',
    description: 'Real-time market intelligence - regime, pressure, squeezes, capital flows',
};

export default function WarRoomPage() {
    return (
        <TerminalLayout>
            <WarRoom />
        </TerminalLayout>
    );
}
