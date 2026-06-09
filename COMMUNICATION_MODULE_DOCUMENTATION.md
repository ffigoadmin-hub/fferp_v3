# Communication Module Documentation — IGO Chain Enterprise

> **High-Fidelity Collaboration Hub (Microsoft Teams Architecture)**
> Date: February 21, 2026
> Version: 4.0 (Airtight Real-time Media)

---

## 1. Executive Summary
The Communication Module is a high-performance, real-time collaboration engine designed to replace external messaging apps with a secure, organization-controlled environment. Built with a **Microsoft Teams-inspired architecture**, it integrates deep organizational awareness (departments, roles) with cutting-edge WebRTC media capabilities.

---

## 2. Core Architecture

### Frontend Stack
- **Framework**: React 18 + TypeScript.
- **UI Components**: Shadcn/UI (Radix) + Tailwind CSS v3.
- **Real-time Engine**: Supabase Realtime (Postgres Changes + Presence).
- **Media Layer**: WebRTC (Peer-to-Peer) with STUN signaling.
- **State Management**: TanStack Query v5 + Context API.

### Database Layer (Supabase/PostgreSQL)
- **Signal Handshake**: Dedicated tables for high-speed WebRTC offer/answer exchange.
- **RLS (Row Level Security)**: Strict role-based access ensuring users only see authorized conversations.
- **Triggers**: Automated participation, last-seen synchronization, and global group joining.

---

## 3. Key Feature Deep-Dive

### 3.1. Unified Teams UI
- **Left Navigation Rail**: Persistent access to Activity, Chat, Teams (Connections), People, and Departments.
- **Context-Aware Sidebar**: Dynamic sidebars that switch between Conversation lists, Employee directories, and Connection managers.
- **Polished Messaging**: 12-hour IST time formatting, high-fidelity message bubbles, and multi-line responsive input.

### 3.2. Governance & Connections
- **Admin-Only Groups**: Only users with the `admin` role can create group conversations.
- **Request to Connect**: A professional handshake system where users must "Connect" before initiating private direct chats.
- **Internal All Group**: Every organization member is automatically joined to a global chat room upon account creation.

### 3.3. Real-time Presence & Sync
- **Online/Offline Status**: Vibrant emerald indicators for active users; "Last seen" timestamps for offline members.
- **Typing Indicators**: Real-time "Team member is typing..." notifications synchronized via dedicated presence channels.
- **Airtight Feed**: Conversations automatically bubble to the top and show "New message" badges instantly.

### 3.4. High-Fidelity Calls (Voice & Video)
- **Signaling Logic**: Complex state machine handling `ringing`, `connecting`, `ongoing`, and `missed` states.
- **Real-time Media**: Direct P2P audio and video streaming with persistent output elements to ensure sound reliability.
- **Call Interface**: Professional overlay with HH:mm call timer, Mute/Video-Off toggles, and Speaker mode.

---

## 4. Technical Implementation Detail

### WebRTC Handshake Flow
1. **Initiation**: Caller inserts record into `chat_calls` -> Receiver's client detects `INSERT` via global listener.
2. **Notification**: Receiver sees "Incoming Call" dialog with Caller ID and avatar.
3. **Handshake**: Accept -> Both clients open `CallInterface`. Caller sends `offer` -> Receiver sends `answer` -> Both exchange `ice-candidates` via `chat_call_signals`.
4. **Media**: Secure P2P stream established; `last_message_at` updated to log call in history.

### Recursion-Free Security
Policies for `chat_participants` use a `SECURITY DEFINER` function (`check_is_chat_participant`) to bypass circular RLS lookups, ensuring 100% database stability without recursion errors.

---

## 5. Database Schema Reference

| Table | Purpose |
|-------|---------|
| `chat_conversations` | Header data for direct and group rooms. |
| `chat_participants` | Junction table linking users to rooms with roles (admin/member). |
| `chat_messages` | Full history of text, images, files, and system logs. |
| `chat_activity` | Real-time notification feed (Activity Tab). |
| `chat_connections` | Professional network management (Request/Accept). |
| `chat_calls` | Signaling header for voice/video sessions. |
| `chat_call_signals` | High-speed WebRTC data exchange (Offer/Answer/ICE). |

---

## 6. Migration History (Deployment Map)

To fully activate the module, the following SQL migrations must be run in sequence:
1. `20260220_create_chat_schema.sql`: Core tables and RLS.
2. `20260220_auto_join_global_chat.sql`: "Internal All" automation.
3. `20260220_chat_v2_updates.sql`: Connections and Activity feed.
4. `20260220_chat_v3_calls.sql`: Call signaling infrastructure.
5. `20260220_chat_v4_webrtc.sql`: WebRTC signaling table.
6. `20260221_chat_final_stabilization.sql`: Critical column fixes and Realtime publication.

---

## 7. Developer Contact & Support
This module is optimized for **IGO Group** organizational standards. For feature extensions or media server (TURN) configuration, contact the System Architect.
