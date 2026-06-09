# Mobile App Daily Workflow Architecture

## Overview

The mobile app now features a unified **Daily Workflow** system that intelligently adapts to user types (Shift Users vs General Users). All workflow items are accessible from a dedicated hub screen with quick action cards and a comprehensive list view.

---

## Navigation Structure

### Bottom Tab Navigation
```
┌─────────────┬──────────┬──────────┬─────────┐
│   Workflow  │   Home   │ Requests │  More   │
│  (NEW! ⚡)  │          │          │         │
└─────────────┴──────────┴──────────┴─────────┘
      │          │          │         │
      ↓          ↓          ↓         ↓
    Daily      Home/   Leave/LOP  Settings/
   Workflow    Shift   Requests   Profile
   (Hub)                           Docs
```

---

## Daily Workflow Stack

### Hub Screen (`DailyWorkflowScreen.tsx`)
- **Smart Detection**: Automatically shows either Shift or General User workflow
- **Header**: Shows user type and total available tasks
- **Layout**:
  - **Quick Actions** (Grid): Top 5 items as 3-column cards
  - **All Tasks** (List): Remaining items in expandable list
- **Features**:
  - Real-time badge counts (pending tasks, escalations, etc.)
  - "NEW" badges for new features (My SOPs)
  - Color-coded icons for visual recognition
  - Tap any item to navigate directly to that screen

---

## General User Workflow

```
Daily Workflow Hub
├── Quick Actions (Grid - 5 items)
│   ├── 1️⃣  Login (Clock in/Day Start)
│   ├── ⏱️  Hourly Plan & Report
│   ├── 📋 Day Plan
│   ├── ✅ EOD Summary
│   └── 📅 Company Calendar
│
└── All Tasks (List - 10 items)
    ├── ✓ My Tasks
    ├── ⚠️  My LOP / Discipline
    ├── 🔔 My Escalations
    ├── 📅 Leave Request
    ├── 💳 Payment Request
    ├── 📄 My Payslip
    ├── 📖 My SOPs [NEW ✨]
    ├── 📜 My Requests
    ├── ☕ PALM CAFE
    └── 💬 Chat
```

**Total Items**: 15

### Screen Routes
- `/day-start` → Login/Day Start
- `/hourly-report` → Hourly Plan & Report
- `/day-plan` → Day Plan
- `/eod-summary` → EOD Summary
- `/company-calendar` → Company Calendar
- `/my-tasks` → My Tasks
- `/my-lop` → My LOP / Discipline
- `/dashboard/my-escalations` → My Escalations
- `/leave-request` → Leave Request
- `/payment-request` → Payment Request
- `/my-payslips` → My Payslip
- `/my-sops` → My SOPs [NEW]
- `/my-requests` → My Requests
- `/palm-cafe` → PALM CAFE
- `/chat` → Chat

---

## Shift User Workflow

```
Daily Workflow Hub
├── Quick Actions (Grid - 5 items)
│   ├── 🕐 Shift Login (Clock In)
│   ├── ⏱️  Hourly Slots
│   ├── ☕ Break Management
│   ├── 📄 End Shift
│   └── 📤 Shift Logout
│
└── All Tasks (List - 6 items)
    ├── 💳 Payment Audit
    ├── 📅 Company Calendar
    ├── 🔔 My Escalations
    ├── 📅 Leave Request
    ├── 📖 My SOPs [NEW ✨]
    └── 💬 Chat
```

**Total Items**: 11

### Screen Routes
- `/shift-login` → Shift Login (Clock In)
- `/shift-hourly` → Hourly Slots
- `/shift-break` → Break Management
- `/shift-eod` → End Shift
- `/shift-logout` → Shift Logout
- `/payment-audit` → Payment Audit
- `/company-calendar` → Company Calendar
- `/dashboard/my-escalations` → My Escalations
- `/leave-request` → Leave Request
- `/my-sops` → My SOPs [NEW]
- `/chat` → Chat

---

## Component Architecture

### DailyWorkflowScreen.tsx
```typescript
DailyWorkflowScreen
├── Header (User type + task count)
├── Quick Actions Section
│   └── WorkflowCard (x5)
│       ├── Icon
│       ├── Label
│       ├── Badge (if count > 0)
│       └── NEW badge (if new)
├── All Tasks Section
│   └── WorkflowListItem (x5-10)
│       ├── Icon
│       ├── Label
│       ├── Description
│       ├── Badge (if count > 0)
│       └── NEW badge (if new)
└── ScrollView
```

### WorkflowStackNavigator.tsx
- **Unified Hub Entry**: `DailyWorkflowHub` (always visible)
- **Conditional Screens**: Renders either Shift OR General user screens
- **Common Screens**: Calendar, Chat, Menu available to both
- **Lazy Loading**: Screens load only when navigated to

---

## Key Features

### 1. Smart User Type Detection
```typescript
const { isShiftUser } = useShiftUserStatus();
// Automatically determines which workflow to show
```

### 2. Real-time Badge Counts
```typescript
// Fetches counts in background:
- Pending tasks
- Active LOPs
- Open escalations
// Updates UI automatically
```

### 3. Color-Coded Icons
Each workflow item has a unique color for visual recognition:
- Primary (Blue) - Login
- Warning (Orange) - Hourly tracking
- Info (Cyan) - Day Plan
- Success (Green) - EOD
- Purple - Calendar
- Teal - Tasks
- Red - LOP/Escalations
- Rose - SOPs [NEW]
- Emerald - Chat
- Amber - Cafe

### 4. New Feature Badges
```typescript
{ isNew: true } // Shows green "NEW" badge
```
Currently showing on: My SOPs

### 5. Responsive Layout
- **Grid Cards**: 3-column layout, 30% width
- **List Items**: Full width with left icon
- **Touch Feedback**: Active opacity on press
- **Spacing**: Consistent with theme

---

## Mobile Navigation Flow

### General User Journey
```
App Launch
    ↓
Check User Type
    ↓
Daily Workflow Hub
    ├─→ Tap "Login" → Day Start Screen
    ├─→ Tap "Day Plan" → Day Plan Screen
    ├─→ Tap "My SOPs" → My SOPs Screen [NEW]
    ├─→ Tap "Hourly Plan" → Hourly Report Screen
    └─→ Tap "Chat" → Chat Screen (via More tab)
    ↓
Home Tab: Quick access to day-start
Work Tab: Quick access to day planning
Requests Tab: Quick access to requests
More Tab: Settings, profile, diagnostics
```

### Shift User Journey
```
App Launch
    ↓
Check User Type
    ↓
Daily Workflow Hub
    ├─→ Tap "Shift Login" → Shift Home Screen
    ├─→ Tap "Hourly Slots" → Shift Hourly Screen
    ├─→ Tap "My SOPs" → My SOPs Screen [NEW]
    ├─→ Tap "Break" → Shift Break Screen
    └─→ Tap "Chat" → Chat Screen (via More tab)
    ↓
Home Tab: Shift operations (login, hourly, break, eod, logout)
Requests Tab: Quick access to requests
More Tab: Settings, profile, diagnostics
```

---

## File Structure

```
mobile-app/src/
├── screens/
│   ├── workflow/
│   │   └── DailyWorkflowScreen.tsx [NEW ⭐]
│   ├── work/
│   │   ├── DayPlanScreen.tsx
│   │   ├── HourlyPlanReportScreen.tsx
│   │   ├── EODReportScreen.tsx
│   │   ├── MySOPsScreen.tsx [UPDATED - now accessible from workflow]
│   │   └── TasksScreen.tsx
│   ├── shift/
│   │   ├── ShiftHomeScreen.tsx
│   │   ├── ShiftHourlyScreen.tsx
│   │   ├── ShiftBreakScreen.tsx
│   │   ├── ShiftEODScreen.tsx
│   │   ├── ShiftLogoutScreen.tsx
│   │   └── PaymentAuditScreen.tsx
│   ├── requests/
│   │   ├── LeaveRequestScreen.tsx
│   │   ├── LOPReversalScreen.tsx
│   │   ├── TravelApprovalScreen.tsx
│   │   ├── TravelClaimScreen.tsx
│   │   └── TripListScreen.tsx
│   ├── calendar/
│   │   └── CompanyCalendarScreen.tsx
│   └── profile/
│       ├── MenuScreen.tsx
│       └── DiagnosticsScreen.tsx
│
└── navigation/
    ├── AppNavigator.tsx [UPDATED ⭐]
    │   └── Now includes WorkflowStackNavigator as "Workflow" tab
    └── WorkflowStackNavigator.tsx [NEW ⭐]
        └── Handles all workflow screens for both user types
```

---

## Technical Highlights

### Performance Optimizations
1. **Conditional Rendering**: Only renders relevant screens based on user type
2. **Lazy Loading**: Screens load on-demand via React Navigation
3. **Background Data Fetching**: Badge counts updated without blocking UI
4. **Memoization**: Workflow items memoized to prevent unnecessary re-renders

### Accessibility
1. **Color + Icons**: Not reliant on color alone
2. **Descriptions**: Each item has a description for context
3. **Touch Targets**: All cards/items exceed 44px minimum
4. **Labels**: All icons have corresponding text labels

### User Experience
1. **One-Tap Access**: All workflow items accessible from hub
2. **Visual Hierarchy**: Quick actions (grid) vs all tasks (list)
3. **Status Indicators**: Badges show pending counts
4. **Smooth Navigation**: React Navigation handles animations

---

## Future Enhancements

1. **Favorite Items**: Users can star favorite workflow items
2. **Search**: Search across all workflow items
3. **Recent Items**: Show recently used workflow screens
4. **Customizable Layout**: Allow users to reorder quick actions
5. **Offline Support**: Cache workflow items for offline access
6. **Voice Commands**: "Hey Siri, open My SOPs"
7. **Notifications**: Push alerts for pending items with quick action

---

## Testing Checklist

- [ ] Daily Workflow Hub loads correctly
- [ ] General user sees all 15 items
- [ ] Shift user sees all 11 items
- [ ] Badge counts update in real-time
- [ ] Tap on each item navigates correctly
- [ ] "NEW" badge displays on My SOPs
- [ ] Grid cards display correctly (3-column)
- [ ] List items scroll smoothly
- [ ] Header gradient displays properly
- [ ] Both shift and general user flows work
- [ ] Deep linking works for all screens
- [ ] Offline fallback works (if implemented)

---

## Migration Notes

**Breaking Changes**: None - existing tabs (Home, Work, Requests, More) still available

**Additions**:
- New "Workflow" tab (⚡) as the first tab
- My SOPs now accessible from workflow for all users
- Enhanced Home tab (previously day-start focus)

**Backward Compatibility**:
- Users can still access screens via Home, Work, Requests tabs
- Workflow tab is the recommended primary interface
- Shift users: Old Home → Shift tab now shows ShiftStackNavigator

---

## Support & Documentation

For implementation help, refer to:
- `DailyWorkflowScreen.tsx` - Main hub screen
- `WorkflowStackNavigator.tsx` - Navigation configuration
- `AppNavigator.tsx` - Tab navigation setup

For mobile app patterns, see existing screens like:
- `DayPlanScreen.tsx` - Example of work screen
- `ShiftHomeScreen.tsx` - Example of shift screen
- `MySOPsScreen.tsx` - Example of recent feature
