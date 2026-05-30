import { ReactNode, useEffect, useRef } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ShiftSidebar } from '@/components/shift/ShiftSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useShiftUserStatus } from '@/hooks/useShiftUserStatus';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { FallingHearts } from '@/components/effects/FallingHearts';
import { LoveClickEffect } from '@/components/effects/LoveClickEffect';
import { useTheme } from '@/hooks/useTheme';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useChatOverlay } from '@/contexts/ChatOverlayContext';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

import { useChatEvents } from '@/hooks/useChatEvents';
import { IncomingCallDialog } from '@/components/chat/IncomingCallDialog';
import { CallScreen } from '@/components/chat/CallScreen';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { WifiOff, Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isShiftUser, isLoading: isShiftLoading } = useShiftUserStatus();
  const { isOpen: isChatOpen } = useChatOverlay();
  const {
    incomingCall,
    setIncomingCall,
    activeCall,
    setActiveCall,
    acceptCall,
    declineCall,
    endActiveCall
  } = useChatEvents();
  const { isOnline, supabaseStatus, isConnecting } = useConnectionMonitor();
  const location = useLocation();
  const isDedicatedChatPage = location.pathname.startsWith('/chat');
  const mainRef = useRef<HTMLElement>(null);

  // Scroll main content to top on every route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // During loading, just render children (they handle their own loading states)
  if (isLoading || (isAuthenticated && isShiftLoading)) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const showChatOverlay = isChatOpen && !isDedicatedChatPage;


  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {!location.pathname.includes('/site-visit-daily-report') && <TopBar />}
      <AnnouncementBanner />

      {/* Connectivity banner */}
      {isConnecting && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white py-1.5 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2">
          {!isOnline ? <WifiOff className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
          <span>{!isOnline ? 'No internet connection — please check your network.' : 'Reconnecting to server…'}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — fixed height, scrolls independently */}
        {!location.pathname.includes('/site-visit-daily-report') && (
          <div className="hidden md:flex md:flex-col h-full overflow-y-auto shrink-0">
            {isShiftUser ? <ShiftSidebar /> : <Sidebar />}
          </div>
        )}

        <main
          ref={mainRef}
          className={cn(
            "flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden transition-all duration-200",
            "p-3 sm:p-4 md:p-5",
            showChatOverlay ? "mr-80" : ""
          )}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>

        {/* Right Chat Overlay */}
        <div className={cn(
          "fixed top-14 right-0 bottom-0 w-80 bg-white border-l border-gray-200 transition-transform duration-300 ease-in-out z-[60] shadow-xl",
          showChatOverlay ? "translate-x-0" : "translate-x-full"
        )}>
          <ChatSidebar />
        </div>
      </div>

      {/* Global Incoming Call Dialog */}
      <IncomingCallDialog
        call={incomingCall}
        onClose={() => declineCall(incomingCall)}
        onAccept={acceptCall}
      />

      {/* Global Active Call Screen */}
      {activeCall && (
        <CallScreen
          callId={activeCall.id}
          callType={activeCall.type}
          callerName={activeCall.caller_name}
          userId={user.id}
          isInitiator={activeCall.isInitiator}
          otherUserIds={activeCall.otherUserIds}
          onEnd={endActiveCall}
        />
      )}
    </div>
  );
}
