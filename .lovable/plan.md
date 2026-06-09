

# AI Analysis for Intelligence Hub

## Overview
Add an **AI Analysis Panel** to the existing Intelligence Hub (`/management/intelligence`) that provides intelligent, real-time insights about employee performance based on work summaries, compliance scores, and productivity patterns.

## Current State Analysis
The Intelligence Hub already has:
- **Real-time employee monitoring** via `useUnifiedWorkAnalytics` hook
- **Compliance scoring** (0-100) based on login time, plans, reports, EOD, punctuality
- **Employee activity grid** showing individual cards with scores
- **Department & type filters**
- **Weekly trend analysis**

What's missing:
- AI-powered analysis and recommendations
- Pattern recognition across employee data
- Natural language insights about team performance
- Predictive/actionable suggestions

## Solution Architecture

```text
+-------------------------+       +------------------------+       +------------------+
|  Intelligence Hub Page  | <---> |  intelligence-analyze  | <---> |   Lovable AI     |
|  (AI Analysis Panel)    |       |   Edge Function        |       | (Gemini 3 Flash) |
+-------------------------+       +------------------------+       +------------------+
         |                                  |
         v                                  v
+-------------------------+       +------------------------+
| useUnifiedWorkAnalytics |       |  Aggregated Employee   |
| (existing hook)         |       |  Data Context          |
+-------------------------+       +------------------------+
```

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/intelligence-analyze/index.ts` | Edge function for AI analysis |
| `src/components/intelligence/AIAnalysisPanel.tsx` | Floating AI analysis panel component |
| `src/hooks/useIntelligenceAI.ts` | Hook for AI streaming & state management |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/shift/ManagementIntelligenceDashboard.tsx` | Add AI Analysis button & panel |
| `supabase/config.toml` | Register new edge function |

## Implementation Details

### Phase 1: Edge Function - `intelligence-analyze`

The edge function will:
1. Accept pre-aggregated employee activity data from the client
2. Use Lovable AI (Gemini 3 Flash) for analysis
3. Stream responses back via SSE

**Input Payload:**
```typescript
{
  activities: UnifiedActivity[], // Pre-fetched from client
  analysisType: 'overview' | 'department' | 'individuals' | 'recommendations'
}
```

**Analysis Types:**

| Type | Description |
|------|-------------|
| `overview` | Organization-wide compliance summary |
| `department` | Department-by-department breakdown |
| `individuals` | Top performers & watchlist analysis |
| `recommendations` | Actionable improvement suggestions |

### Phase 2: AI Analysis Panel UI

A sleek floating panel that appears on the right side:

**Features:**
- Collapsible panel (icon button trigger)
- Quick analysis preset buttons:
  - "Organization Overview"
  - "Department Analysis"
  - "Top/Bottom Performers"
  - "Improvement Recommendations"
- Streaming markdown responses
- Loading skeleton states
- Copy to clipboard functionality

**UI Design:**
- Glassmorphic design matching Intelligence Hub theme
- Slide-in animation from right
- Fixed position, 400px width
- Scrollable content area
- Dark theme with primary accents

### Phase 3: Integration

**AI Analysis Button** in the header:
```
[Intelligence Hub]  [Date Picker]  [🤖 AI Analyze]  [Sync]
```

When clicked:
1. Opens the AI Analysis Panel
2. Automatically runs "Organization Overview" analysis
3. User can select other analysis types

**Data Flow:**
1. Client already has `activities` from `useUnifiedWorkAnalytics`
2. Send aggregated data to edge function (avoids re-fetching)
3. Edge function builds context and prompts AI
4. Stream response back to panel

## Sample AI Responses

**Organization Overview:**
```markdown
## Today's Workforce Intelligence

**Compliance Score: 78%** (↑3% from yesterday)

### Key Observations
- **42 employees** actively working
- **8 employees** currently on break
- **5 employees** marked absent

### Department Performance
| Department | Score | Status |
|------------|-------|--------|
| Engineering | 85% | ✅ Strong |
| Operations | 72% | ⚠️ Needs attention |
| AgriMart | 68% | ⚠️ Below target |

### Immediate Actions Needed
1. **3 employees** have compliance below 50%
2. **Operations** has 4 late submissions this morning
```

**Improvement Recommendations:**
```markdown
## Recommended Actions

### Short-term (Today)
1. **Send reminder** to 5 employees who haven't submitted hourly reports
2. **Review** Operations department - 40% late login rate today

### Long-term Patterns
1. **Monday syndrome**: Compliance drops 12% on Mondays
2. **Peak lateness**: 11 AM slot has highest late submissions
3. **Top performer pattern**: Employees with 90+ scores submit plans 15 mins early

### System Suggestions
- Consider automated reminders 10 mins before slot deadlines
- Department-specific login windows may improve AgriMart compliance
```

## Technical Notes

- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Streaming via SSE for real-time response rendering
- Client sends pre-fetched data (no duplicate DB queries)
- 10-second timeout per analysis
- Rate limit handling (429/402 errors)

## Security

- Protected route (admin, ceo, hr, auditor, boi roles)
- Edge function validates JWT
- Read-only analysis (no data modifications)
- No sensitive data exposed in prompts

