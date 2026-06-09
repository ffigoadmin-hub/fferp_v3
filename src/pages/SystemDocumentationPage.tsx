import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

const SystemDocumentationPage = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Print Button - Hidden when printing */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2">
        <Button onClick={handlePrint} className="shadow-lg">
          <Printer className="h-4 w-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Document Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-4 print:max-w-none">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-primary pb-6">
          <h1 className="text-4xl font-bold text-primary mb-2">IGO CHAIN ERP</h1>
          <p className="text-xl text-muted-foreground">Complete System Documentation</p>
          <p className="text-sm text-muted-foreground mt-2">
            Generated on: {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Core Philosophy */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">🎯 Core Philosophy</h2>
          <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-primary">
            <p className="text-lg font-semibold italic">
              "Nothing exists without evidence. Nothing moves without approval. Nothing is paid without trace. Nothing is editable after submission. CEO sees only verified intelligence."
            </p>
          </div>
          <p className="mt-4 text-muted-foreground">
            IGO CHAIN ERP is a <strong>Governance Engine</strong> — a constitutional operating system for serious companies, not just software.
          </p>
        </section>

        {/* System Architecture */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">🏗️ System Architecture</h2>
          <div className="grid grid-cols-1 gap-2">
            {[
              { layer: "Access Layer", desc: "Login & Authentication", icon: "🔐" },
              { layer: "Capture Layer", desc: "Time & Payment Input", icon: "📝" },
              { layer: "Validation Layer", desc: "HR + Admin Checks", icon: "✅" },
              { layer: "Decision Layer", desc: "CEO Approvals", icon: "👔" },
              { layer: "Execution Layer", desc: "Accounts Payment", icon: "💰" },
              { layer: "Intelligence Layer", desc: "Analytics & Reports", icon: "📊" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-muted/30 rounded border">
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-semibold">{item.layer}</span>
                  <span className="text-muted-foreground">→ {item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* User Roles */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">👥 User Roles & Access</h2>
          <table className="w-full border-collapse border border-border">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border p-2 text-left">Role</th>
                <th className="border border-border p-2 text-left">Access Level</th>
                <th className="border border-border p-2 text-left">Key Responsibilities</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-2 font-semibold">Employee</td>
                <td className="border border-border p-2">Basic</td>
                <td className="border border-border p-2">Day Start, Hourly Reports, EOD, Payment/WO/PO Requests</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="border border-border p-2 font-semibold">HR</td>
                <td className="border border-border p-2">Attendance</td>
                <td className="border border-border p-2">Employee attendance attestation, issue tracking</td>
              </tr>
              <tr>
                <td className="border border-border p-2 font-semibold">Admin</td>
                <td className="border border-border p-2">Operations</td>
                <td className="border border-border p-2">First-level approval for all requests, user management</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="border border-border p-2 font-semibold">CEO/GM</td>
                <td className="border border-border p-2">Decision</td>
                <td className="border border-border p-2">Final approval authority, intelligence dashboard</td>
              </tr>
              <tr>
                <td className="border border-border p-2 font-semibold">Accounts</td>
                <td className="border border-border p-2">Execution</td>
                <td className="border border-border p-2">Payment execution only (no approval power)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Time Governance */}
        <section className="mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">⏱️ Time Governance</h2>

          <h3 className="text-lg font-semibold mt-4 mb-2">1. Morning Login (Day Start)</h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong>Location Zone Selection:</strong> Office / Site A-D / Client Location / Other</li>
            <li><strong>Day Plan:</strong> What you will accomplish today</li>
            <li><strong>Deadline:</strong> Must submit before 10:15 AM</li>
            <li><strong>Late Penalty:</strong> Score deduction after grace period</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">2. Hourly Reporting (8 Locked Slots)</h3>
          <table className="w-full border-collapse border border-border mb-4">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border p-2">Slot</th>
                <th className="border border-border p-2">Time</th>
                <th className="border border-border p-2">Grace Period</th>
                <th className="border border-border p-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                { slot: 1, time: "09:00 - 10:00", grace: "+15 min", note: "" },
                { slot: 2, time: "10:00 - 11:00", grace: "+15 min", note: "" },
                { slot: 3, time: "11:00 - 12:00", grace: "+15 min", note: "" },
                { slot: "—", time: "12:00 - 13:00", grace: "—", note: "LUNCH BREAK" },
                { slot: 5, time: "13:00 - 14:00", grace: "+15 min", note: "" },
                { slot: 6, time: "14:00 - 15:00", grace: "+15 min", note: "" },
                { slot: 7, time: "15:00 - 16:00", grace: "+15 min", note: "" },
                { slot: 8, time: "16:00 - 17:00", grace: "+15 min", note: "" },
                { slot: 9, time: "17:00 - 18:00", grace: "+15 min", note: "" },
              ].map((row, idx) => (
                <tr key={idx} className={row.note === "LUNCH BREAK" ? "bg-amber-100 dark:bg-amber-900/30" : idx % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="border border-border p-2 text-center font-semibold">{row.slot}</td>
                  <td className="border border-border p-2 text-center">{row.time}</td>
                  <td className="border border-border p-2 text-center">{row.grace}</td>
                  <td className="border border-border p-2 text-center font-semibold">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-destructive/10 border border-destructive/30 p-3 rounded">
            <p className="text-sm"><strong>⚠️ Rules:</strong> Late submissions require mandatory explanations. Missed slots are permanently flagged.</p>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-2">3. EOD Summary (End of Day)</h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Planned vs Completed work comparison</li>
            <li>Completion percentage</li>
            <li>Pending items for next day</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">4. Discipline Score (Auto-Calculated)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-3 rounded border">
              <p className="font-semibold">Login Score</p>
              <p className="text-sm text-muted-foreground">Punctuality at day start</p>
            </div>
            <div className="bg-muted/30 p-3 rounded border">
              <p className="font-semibold">Slot Compliance Score</p>
              <p className="text-sm text-muted-foreground">Timely hourly reports</p>
            </div>
            <div className="bg-muted/30 p-3 rounded border">
              <p className="font-semibold">EOD Score</p>
              <p className="text-sm text-muted-foreground">Summary submission</p>
            </div>
            <div className="bg-primary/10 p-3 rounded border border-primary">
              <p className="font-semibold">Total Score</p>
              <p className="text-sm text-muted-foreground">Average of all three</p>
            </div>
          </div>
        </section>

        {/* Money Governance */}
        <section className="mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">💰 Money Governance</h2>

          <h3 className="text-lg font-semibold mt-4 mb-2">Payment Request Flow</h3>
          <div className="flex flex-wrap items-center justify-center gap-2 p-4 bg-muted/30 rounded mb-4">
            {[
              "Employee Creates",
              "→",
              "Admin Validates",
              "→",
              "CEO Approves",
              "→",
              "Accounts Pays",
              "→",
              "Budget Updated"
            ].map((step, idx) => (
              <span key={idx} className={step === "→" ? "text-primary font-bold" : "bg-background px-3 py-1 rounded border font-medium"}>
                {step}
              </span>
            ))}
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-2">Request Types</h3>
          <table className="w-full border-collapse border border-border">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border p-2 text-left">Type</th>
                <th className="border border-border p-2 text-left">Purpose</th>
                <th className="border border-border p-2 text-left">Required Documents</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-2 font-semibold">Payment Request</td>
                <td className="border border-border p-2">Direct vendor payments</td>
                <td className="border border-border p-2">Proof Folder (Invoices, Photos, Videos)</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="border border-border p-2 font-semibold">Work Order (WO)</td>
                <td className="border border-border p-2">Project-linked work contracts</td>
                <td className="border border-border p-2">WO Document, Detailed Scope</td>
              </tr>
              <tr>
                <td className="border border-border p-2 font-semibold">Purchase Order (PO)</td>
                <td className="border border-border p-2">Material purchases</td>
                <td className="border border-border p-2">PO Document, Cost Comparison</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mt-6 mb-2">Payment Request Fields</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Vendor Name",
              "Bank Account / UPI",
              "IFSC Code",
              "Amount",
              "Purpose",
              "Urgency (Normal/Urgent/Emergency)",
              "Cutoff Date & Time",
              "Project Link (if applicable)",
              "WO Number (if applicable)",
              "Proof Folder",
              "Work Proof URL",
            ].map((field, idx) => (
              <div key={idx} className="bg-muted/30 px-3 py-2 rounded border text-sm">
                {field}
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-2">Approval Statuses</h3>
          <div className="space-y-2">
            {[
              { status: "pending", desc: "Awaiting Admin review", color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500" },
              { status: "admin_approved", desc: "Awaiting CEO approval", color: "bg-blue-100 dark:bg-blue-900/30 border-blue-500" },
              { status: "ceo_approved", desc: "Ready for payment execution", color: "bg-green-100 dark:bg-green-900/30 border-green-500" },
              { status: "ceo_hold", desc: "CEO needs clarification (can resubmit)", color: "bg-orange-100 dark:bg-orange-900/30 border-orange-500" },
              { status: "rejected", desc: "Denied by Admin (can resubmit)", color: "bg-red-100 dark:bg-red-900/30 border-red-500" },
              { status: "paid", desc: "Executed with UTR number", color: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500" },
            ].map((item, idx) => (
              <div key={idx} className={`flex items-center gap-4 p-2 rounded border-l-4 ${item.color}`}>
                <code className="font-mono font-semibold">{item.status}</code>
                <span className="text-muted-foreground">→ {item.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Project Management */}
        <section className="mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">📋 Project Management</h2>

          <h3 className="text-lg font-semibold mt-4 mb-2">Project Structure</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { field: "Project ID", example: "PRJ-YYYY-XXX format" },
              { field: "Client Info", example: "Name & Contact" },
              { field: "Location", example: "City, State" },
              { field: "Category", example: "DIRECT / JV" },
              { field: "Vertical", example: "Business category" },
              { field: "Hand Over Date", example: "Project delivery date" },
              { field: "Assigned Team", example: "Manager + Engineer" },
            ].map((item, idx) => (
              <div key={idx} className="bg-muted/30 p-3 rounded border">
                <p className="font-semibold">{item.field}</p>
                <p className="text-sm text-muted-foreground">{item.example}</p>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-2">Project Lifecycle Features</h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Lifecycle stage tracking from Deal to Completion</li>
            <li>BOQ submission and approval workflow</li>
            <li>Team assignment and role management</li>
            <li>Project aging and timeline tracking</li>
          </ul>
        </section>

        {/* Audit System */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">🔍 Audit System (Forensic Grade)</h2>

          <p className="mb-4">Every action in the system is permanently logged with complete details:</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-muted/30 p-3 rounded border">
              <p className="font-semibold">WHO</p>
              <p className="text-sm text-muted-foreground">Performer name, role, ID</p>
            </div>
            <div className="bg-muted/30 p-3 rounded border">
              <p className="font-semibold">WHAT</p>
              <p className="text-sm text-muted-foreground">Action type performed</p>
            </div>
            <div className="bg-muted/30 p-3 rounded border">
              <p className="font-semibold">WHEN</p>
              <p className="text-sm text-muted-foreground">Exact timestamp</p>
            </div>
            <div className="bg-muted/30 p-3 rounded border">
              <p className="font-semibold">BEFORE/AFTER</p>
              <p className="text-sm text-muted-foreground">Full state snapshots</p>
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-4 mb-2">Tracked Actions</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              "PAYMENT_CREATED",
              "PAYMENT_ADMIN_APPROVED",
              "PAYMENT_CEO_APPROVED",
              "PAYMENT_REJECTED",
              "PAYMENT_CEO_HOLD",
              "PAYMENT_PAID",
              "PAYMENT_RESUBMITTED",
              "WO_CREATED",
              "WO_ADMIN_APPROVED",
              "WO_CEO_APPROVED",
              "PO_CREATED",
              "PO_ADMIN_APPROVED",
              "PROJECT_CREATED",
              "PROJECT_UPDATED",
              "PROFILE_UPDATED",
            ].map((action, idx) => (
              <code key={idx} className="bg-muted px-2 py-1 rounded text-xs font-mono">
                {action}
              </code>
            ))}
          </div>
        </section>

        {/* CEO Intelligence */}
        <section className="mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">📊 CEO Intelligence Layer</h2>

          <h3 className="text-lg font-semibold mt-4 mb-2">Dashboard Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { metric: "Today's Paid", desc: "Total amount paid today" },
              { metric: "Monthly Burn", desc: "Current month spending" },
              { metric: "Pending Approvals", desc: "Requests awaiting CEO" },
              { metric: "Admin Rejections", desc: "Rejected request count" },
            ].map((item, idx) => (
              <div key={idx} className="bg-primary/10 p-3 rounded border border-primary/30">
                <p className="font-semibold">{item.metric}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-2">Analytics Available</h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Daily spend trends (bar chart)</li>
            <li>Vendor concentration (pie chart)</li>
            <li>Department-wise spending</li>
            <li>Project budget utilization</li>
          </ul>
        </section>

        {/* Database Tables */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">🗄️ Database Structure</h2>

          <table className="w-full border-collapse border border-border text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border p-2 text-left">Table</th>
                <th className="border border-border p-2 text-left">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                { table: "profiles", purpose: "User information and roles" },
                { table: "day_starts", purpose: "Morning login records" },
                { table: "day_plans", purpose: "Daily task planning" },
                { table: "hourly_reports", purpose: "Slot-wise work reports" },
                { table: "hourly_plans", purpose: "Hourly work planning" },
                { table: "eod_reports", purpose: "End-of-day summaries" },
                { table: "discipline_scores", purpose: "Auto-calculated scores" },
                { table: "payment_requests", purpose: "Payment submissions" },
                { table: "work_orders", purpose: "Work order records" },
                { table: "purchase_orders", purpose: "Purchase order records" },
                { table: "projects", purpose: "Project master data" },
                { table: "audit_logs", purpose: "Complete activity trail" },
                { table: "notifications", purpose: "User notifications" },
                { table: "hr_attestations", purpose: "Attendance decisions" },
                { table: "admin_reviews", purpose: "Admin review records" },
                { table: "employee_issues", purpose: "Reported issues" },
                { table: "late_reasons", purpose: "Late submission explanations" },
              ].map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="border border-border p-2 font-mono font-semibold">{item.table}</td>
                  <td className="border border-border p-2">{item.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Security Features */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-4 border-b pb-2">🔐 Security Features</h2>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Row-Level Security (RLS)</strong> on all database tables</li>
            <li><strong>Role-based access control</strong> for all features</li>
            <li><strong>Complete audit trail</strong> for all changes</li>
            <li><strong>Secure file storage</strong> for documents</li>
            <li><strong>No edit after submission</strong> — immutable records</li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p className="font-semibold">IGO CHAIN ERP — Governance Engine</p>
          <p>© {new Date().getFullYear()} All Rights Reserved</p>
          <p className="mt-2 italic">"Constitutional operating system for serious companies"</p>
        </footer>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .page-break-before {
            page-break-before: always;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
};

export default SystemDocumentationPage;
