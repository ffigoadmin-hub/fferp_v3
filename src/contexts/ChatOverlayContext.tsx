import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatOverlayContextType {
    isOpen: boolean;
    toggleChat: () => void;
    openChat: () => void;
    closeChat: () => void;
}

const ChatOverlayContext = createContext<ChatOverlayContextType | undefined>(undefined);

export function ChatOverlayProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleChat = () => {
        console.log('ChatOverlayContext: toggleChat called, current:', isOpen);
        setIsOpen(prev => !prev);
    };
    const openChat = () => setIsOpen(true);
    const closeChat = () => setIsOpen(false);

    return (
        <ChatOverlayContext.Provider value={{ isOpen, toggleChat, openChat, closeChat }}>
            {children}
        </ChatOverlayContext.Provider>
    );
}

export const useChatOverlay = () => {
    const context = useContext(ChatOverlayContext);
    if (context === undefined) {
        throw new Error('useChatOverlay must be used within a ChatOverlayProvider');
    }
    return context;
};
