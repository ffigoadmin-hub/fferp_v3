import { ReactNode } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ShiftSidebar } from './ShiftSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

interface ShiftLayoutProps {
    children: ReactNode;
}

export function ShiftLayout({ children }: ShiftLayoutProps) {
    const { isAuthenticated, isLoading } = useAuth();

    // During loading, just render children (they handle their own loading states)
    if (isLoading) {
        return <>{children}</>;
    }

    if (!isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-background">
            <TopBar />
            <AnnouncementBanner />
            <div className="flex">
                <ShiftSidebar />
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
