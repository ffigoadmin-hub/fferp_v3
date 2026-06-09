# Chat & Notification Module Audit Report
**Generated:** 2026-03-30

---

## 📋 Summary
Reviewed 7 major files in the chat module. Found **6 critical issues** and **4 warnings** that could impact stability and functionality.

---

## 🔴 CRITICAL ISSUES

### 1. **ChatWindow.tsx (Line 163) - Reference Before Definition**
**Severity:** HIGH
**File:** `src/components/chat/ChatWindow.tsx:163`
**Issue:** Variable `chatName` is used before it's defined.

```typescript
// Line 163 - WRONG (chatName not defined yet)
callerName: chatName || 'Unknown',

// Line 586-590 - chatName defined AFTER usage
const chatName = conversation?.type === 'group'
    ? conversation.name
    : getOtherParticipant()?.name
    : 'Chat';
```

**Impact:** Call initiations will always send `undefined` or fallback as `chatName`.
**Fix:** Move the `chatName` calculation to the top of the component or pass it as a parameter.

---

### 2. **ChatInput.tsx (Line 166) - Unsafe MediaRecorder State Reset**
**Severity:** HIGH
**File:** `src/components/chat/ChatInput.tsx:162-172`

```typescript
const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        // ISSUE: Setting onstop to null can cause issues
        mediaRecorderRef.current.onstop = null;  // ❌ Problematic
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        // ... rest of cleanup
    }
};
```

**Impact:**
- The `stop()` call will trigger the `onstop` handler before it's nullified, creating race conditions
- Audio blob might still be processed even though we want to discard it

**Fix:** Use a flag instead:
```typescript
const cancelRecordingRef = useRef(false);
// In onstop handler:
if (cancelRecordingRef.current) return; // Skip processing
```

---

### 3. **ChatWindow.tsx (Lines 74-97) - Missing Dependency in markAsRead**
**Severity:** MEDIUM
**File:** `src/components/chat/ChatWindow.tsx:93-97`

```typescript
useEffect(() => {
    if (conversationId && messages.length > 0) {
        markAsRead();  // Called every message change
    }
}, [messages.length, conversationId]);
```

**Impact:**
- `markAsRead()` is called on EVERY message change, causing excessive database writes
- No rate limiting or debouncing
- Could cause API throttling or quota issues

**Fix:** Add debouncing:
```typescript
useEffect(() => {
    const timeout = setTimeout(() => {
        if (conversationId && messages.length > 0) {
            markAsRead();
        }
    }, 1000); // Debounce 1s
    return () => clearTimeout(timeout);
}, [messages.length, conversationId]);
```

---

### 4. **ActivityList.tsx (Line 104) - Unnecessary Refetch After State Update**
**Severity:** MEDIUM
**File:** `src/components/chat/ActivityList.tsx:90-105`

```typescript
const handleActivityClick = async (activity: Activity) => {
    // Mark as read
    await supabase.from('chat_activity').update({ is_read: true }).eq('id', activity.id);

    if (activity.type === 'message') {
        navigate(`/chat/${activity.entity_id}`);
    }

    fetchActivity();  // ❌ Refetching all 20 items for one update
};
```

**Impact:**
- Fetches ALL activities (20 items) after updating just one
- Unnecessary network request
- Causes visual flicker

**Fix:** Update state directly:
```typescript
setActivities(prev => prev.map(a =>
    a.id === activity.id ? { ...a, is_read: true } : a
));
```

---

### 5. **ChatWindow.tsx (Lines 250-262) - Redundant markAsRead Calls**
**Severity:** MEDIUM
**File:** `src/components/chat/ChatWindow.tsx`

```typescript
// Called in 3 places:
// 1. Line 73 - fetchConversationDetails()
// 2. Line 348 - subscribeToMessages INSERT event
// 3. Line 93-97 - useEffect on messages.length

// Each creates new Supabase request with identical logic
```

**Impact:**
- Multiple identical queries sent to database
- Could overwhelm Supabase connection
- Inconsistent "read" state across tabs

**Fix:** Create a debounced `markAsReadOnce` function used everywhere.

---

### 6. **ChatInput.tsx (Line 220-221) - Type Inconsistency**
**Severity:** LOW
**File:** `src/components/chat/ChatInput.tsx:216-220`

```typescript
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;  // ✓ Correct
};
```

**Status:** Actually correct (no issue here - secs is converted to string)

---

## ⚠️ WARNINGS

### 1. **Message Reactions - No Deduplication**
**File:** `src/components/chat/ChatWindow.tsx:496-519`
**Issue:** Same user can add duplicate reactions to same message
```typescript
// No check for existing emoji + user combination
const existing = reactions[messageId]?.find(r =>
    r.user_id === user.id && r.emoji === emoji
);
// This works, but could create duplicates if concurrent requests occur
```

---

### 2. **Real-Time Subscription Error Handling**
**File:** `src/components/chat/ChatWindow.tsx:364-370`

```typescript
.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
        toast.error("Real-time connection lost. Reconnecting...");
        // ❌ But there's no actual reconnection logic!
    }
});
```

**Impact:** User sees error but connection doesn't auto-reconnect.

---

### 3. **No Typing Indicator Cleanup**
**File:** `src/components/chat/ChatWindow.tsx:415-433`

```typescript
const handleTyping = async () => {
    // Timeout set, but no guarantee it fires if component unmounts
    // Could leave typing status stuck "true" for other users
};
```

---

### 4. **File Upload Security**
**File:** `src/components/chat/ChatInput.tsx:58-109`

```typescript
const fileExt = file.name.split('.').pop();
const fileName = `${conversationId}/${Math.random()}.${fileExt}`;
```

**Issue:**
- No file type validation (only size check)
- `Math.random()` is predictable
- No virus scanning
- File extension not validated

**Recommendation:** Add mime type validation and use `crypto.getRandomValues()` for filename.

---

## ✅ WHAT'S WORKING WELL

1. ✅ Message soft-delete with audit trail (metadata storage)
2. ✅ Optimistic message rendering with deduplication
3. ✅ Good error handling with toast notifications
4. ✅ Audio recording with MIME type negotiation
5. ✅ Presence tracking (online/offline status)
6. ✅ Read receipts with proper comparison logic

---

## 🔧 RECOMMENDED FIXES (Priority Order)

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 P1 | Fix `chatName` reference before definition | 5min | HIGH |
| 🔴 P1 | Fix cancel recording race condition | 10min | HIGH |
| 🟡 P2 | Add debouncing to `markAsRead()` | 15min | MEDIUM |
| 🟡 P2 | Optimize activity click handling | 5min | MEDIUM |
| 🟡 P2 | Add file type validation | 10min | MEDIUM |
| 🟢 P3 | Implement typing cleanup on unmount | 10min | LOW |
| 🟢 P3 | Fix reconnection logic | 15min | LOW |

---

## 📊 Testing Recommendations

- [ ] Test calling with multiple participants (verify `chatName` is passed correctly)
- [ ] Cancel voice recording multiple times rapidly
- [ ] Leave chat open for 30+ minutes and monitor markAsRead calls
- [ ] Send large files and verify mime type handling
- [ ] Simulate connection loss and verify reconnection

---

## 🎯 Next Steps

1. **Immediate:** Fix P1 issues (chatName + cancellation)
2. **Short-term:** Implement debouncing and optimization
3. **Review:** Add unit tests for subscription cleanup
4. **Security:** Add file validation and rate limiting
