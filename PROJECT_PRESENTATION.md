---
marp: true
theme: default
class: invert
paginate: true
header: 'IGO GROUP ERP - System Structure'
footer: 'Proprietary & Confidential'
---

# IGO GROUP ERP
## Next-Generation Operational Intelligence

**A Comprehensive System Walkthrough**

---

## 1. The Vision: Why IGO GROUP?

- **Real-time Oversight**: Eliminating the "blind spots" in field operations.
- **Role Mastery**: Empowering everyone from Field Engineers to the CEO with tailored data.
- **Seamless Verticals**: Unified management for Construction, Agriculture, and Supply Chain.
- **Audit-First Culture**: Every action is accountable and traceable.

> **Speaker Note**: Start by explaining that IGO GROUP isn't just an ERP; it's a real-time intelligence hub designed to bridge the gap between office strategy and site execution.

---

## 2. The Engine: Modern Tech Stack

- **Frontend**: React 18 + Vite (Speed and Modular Components)
- **Styling**: Tailwind CSS + Shadcn UI (Premium Design System)
- **Data Layer**: Supabase (Postgres + Real-time WebSockets)
- **Logic**: TypeScript (Type-safe and Scalable)
- **Monitoring**: TanStack Query (Efficient Data Fetching)

> **Speaker Note**: Highlight that we chose a "Real-time First" stack. This ensures that when an escalation happens on-site, the CEO sees it on their dashboard within seconds without a page refresh.

---

## 3. The Bones: Application Architecture

```text
/src
 ├── /pages        # Role-specific business logic
 ├── /components   # Atomic UI elements
 ├── /hooks        # Real-time event listeners
 ├── /integrations # Supabase schema & client
 └── /contexts     # Global Auth & State
```
- **Modular Directory**: Easy for new devs to find where logic "lives".
- **Decoupled Components**: UI is separate from business logic for reusability.

> **Speaker Note**: Explain the clean separation of concerns. The `/pages` folder is organized by role, making it trivial for a team member to find code related to their specific department.

---

## 4. The Brain: Role-Based Access (RBAC)

- **The Redirect Engine**: Centralized path determination based on user role.
- **Role Tiering**:
  - `Admin`: System & User Management
  - `CEO/BOI`: Strategic Intelligence
  - `GM/GMO/SMO`: Operational Oversight
  - `Employee`: Task Execution & Reporting

> **Speaker Note**: Focus on the User Experience. A user logs in and is automatically "pushed" to their specific workspace. They only see what they need to see.

---

## 5. Operational Pulse: Daily Workflow

**The "Closed-Loop" Reporting Cycle:**

1. **Morning**: Day Start (Location Verified) + Day Plan.
2. **Daytime**: Mandatory Hourly Proof-of-Work logs.
3. **Evening**: EOD Summary & Issue Reporting.
4. **Outcome**: Permanent, locked audit trails for HR & Management.

> **Speaker Note**: This is the heart of our data collection. By enforcing hourly reporting, the system builds an accurate map of productivity that feeds into the dashboards.

---

## 6. Intelligence Layer: Escalations

- **Unified Tracking**: One queue for all critical site issues.
- **Promotion Logic**:
  - **L1**: Site Ops (Must Acknowledge Fast)
  - **L2**: GM (Escalated if L1 remains silent)
  - **L3**: CEO (Crisis level - High Visibility)
- **Closure Audit**: Issues can't just be "deleted"; they must be audited and approved.

> **Speaker Note**: Describe the Escalation Flow as the "Safety Net". It ensures that no site problem stays hidden for more than a few hours before it starts climbing the management chain.

---

## 7. Vertical Domains: Deep Execution

- **BOQ Builder**: Transform material requests into structured work orders.
- **Site Updates**: Mobile-friendly photo/video evidence from the fields.
- **Procurement Tracking**: Live visibility into vendor sourcing and project spending.
- **Farm Management**: Specialized logs for cultivation cycles and crop health.

> **Speaker Note**: Show how the app flexes across different industries. Whether it's a construction beam or a crop harvest, the platform handles the specific data requirements of that vertical.

---

## 8. Integrity: The Audit Log

- **Immutable Records**: Every login, approval, and rejected payment is logged.
- **Traceability**: "Who did what, when, and from where?"
- **Transparency**: Builds trust within the team and with stakeholders.

> **Speaker Note**: Emphasize that transparency is a feature, not a byproduct. The audit log is the source of truth for all management decisions.

---

## 9. Conclusion: Ready for Scale

- **Current State**: Fully functional operational core.
- **Next Steps**: Expanding BI reports and AI-driven predictive insights.
- **Team Mission**: Code with performance, security, and the user in mind.

**Questions?**

---
