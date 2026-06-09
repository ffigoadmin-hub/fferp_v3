import { useState, useEffect, createContext, useContext } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatNavRail } from "./ChatNavRail";
import { EmployeeList } from "./EmployeeList";
import { DepartmentList } from "./DepartmentList";
import { ConnectionsManager } from "./ConnectionsManager";
import { GroupsList } from "./GroupsList";
import { AdminChatAuditDashboard } from "./AdminChatAuditDashboard";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/hooks/usePresence";
import { Calendar, Video } from "lucide-react";

// Create context for chat state
type ChatContextType = {
    onlineUsers: Set<string>;
    activeTab: string;
    setActiveTab: (tab: string) => void;
};

const ChatContext = createContext<ChatContextType>({
    onlineUsers: new Set(),
    activeTab: 'chat',
    setActiveTab: () => { },
});

export const useChat = () => useContext(ChatContext);

export const ChatLayout = () => {
    const { user } = useAuth();
    const { onlineUsers } = usePresence();
    const [activeTab, setActiveTab] = useState('chat');
    const location = useLocation();
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    // Auto-switch to chat tab if a conversation is selected via URL
    useEffect(() => {
        if (location.pathname.startsWith('/chat/')) {
            const pathParts = location.pathname.split('/');
            if (pathParts.length > 2 && pathParts[2] !== '') {
                setActiveTab('chat');
            }
        }
    }, [location.pathname]);

    useEffect(() => {
        if (!isAdmin && (activeTab === 'employees' || activeTab === 'departments' || activeTab === 'admin-audit')) {
            setActiveTab('chat');
        }
    }, [activeTab, isAdmin]);

    const renderSidebar = () => {
        switch (activeTab) {
            case 'chat': return <ChatSidebar />;
            case 'groups': return <GroupsList />;
            case 'employees': return isAdmin ? <EmployeeList /> : <ChatSidebar />;
            case 'departments': return isAdmin ? <DepartmentList /> : <ChatSidebar />;
            case 'teams': return <ConnectionsManager />;
            default: return null;
        }
    };

    const isFullViewTab = activeTab === 'calendar' || activeTab === 'meeting' || activeTab === 'admin-audit';

    return (
        <ChatContext.Provider value={{ onlineUsers, activeTab, setActiveTab }}>
            {/* Use calc to account for the TopBar (h-12 = 3rem) */}
            <div className="flex h-[calc(100vh-3rem)] w-full overflow-hidden bg-background">
                <ChatNavRail activeTab={activeTab} onTabChange={setActiveTab} />

                <div className="flex flex-1 overflow-hidden">
                    {!isFullViewTab && renderSidebar()}

                    <main className="flex-1 overflow-hidden relative">
                        {activeTab === 'calendar' || activeTab === 'meeting' ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-muted/10">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                    {activeTab === 'calendar' ? (
                                        <Calendar className="w-10 h-10 text-primary" />
                                    ) : (
                                        <Video className="w-10 h-10 text-primary" />
                                    )}
                                </div>
                                <h3 className="text-2xl font-bold text-foreground mb-2">
                                    {activeTab === 'calendar' ? 'Calendar' : 'Meeting'} Coming Soon
                                </h3>
                                <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
                                    {activeTab === 'calendar'
                                        ? "We're working hard to bring integrated meeting scheduling and event management to IGO Connect."
                                        : "High-quality group video meetings and collaborative workspace tools are coming soon to IGO Connect."}
                                </p>
                            </div>
                        ) : activeTab === 'admin-audit' && isAdmin ? (
                            <AdminChatAuditDashboard />
                        ) : (
                            <Outlet context={{ onlineUsers }} />
                        )}
                    </main>
                </div>
            </div>
        </ChatContext.Provider>
    );
};
