import { ChatLayout } from "@/components/chat/ChatLayout";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Route, Routes } from "react-router-dom";

const ChatPage = () => {
    return (
        <Routes>
            <Route element={<ChatLayout />}>
                <Route index element={<ChatWindow />} />
                <Route path=":conversationId" element={<ChatWindow />} />
            </Route>
        </Routes>
    );
};

export default ChatPage;
