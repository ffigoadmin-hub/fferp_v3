export const PROJECT_CATEGORIES = [
  { value: 'DIRECT', label: 'Direct Project', description: 'Direct Implementation', color: 'green' },
  { value: 'AMC', label: 'AMC', description: 'Annual Maintenance Contract', color: 'orange' },
  { value: 'BUY_BACK', label: 'Buy Back', description: 'Buy Back Agreement', color: 'purple' },
  { value: 'JV', label: 'Joint Venture', description: 'Internal Farming Projects', color: 'blue' },
] as const;

export const LIFECYCLE_STAGES = [
  { value: 'new_deal', label: 'New Deal', order: 1, icon: 'Inbox' },
  { value: 'engineering_assigned', label: 'Team Assigned', order: 2, icon: 'Users' },
  { value: 'boq_draft', label: 'BOQ Draft', order: 3, icon: 'FileEdit' },
  { value: 'boq_submitted_smo', label: 'L1 Approval (SMO)', order: 4, icon: 'Send' },
  { value: 'boq_submitted_gmo', label: 'L2 Approval (GMO)', order: 5, icon: 'ShieldCheck' },
  { value: 'boq_approved', label: 'BOQ Approved', order: 6, icon: 'CheckCircle' },
  { value: 'sourcing', label: 'Sourcing', order: 7, icon: 'ShoppingCart' },
  { value: 'execution', label: 'Execution', order: 8, icon: 'Hammer' },
  { value: 'completed', label: 'Completed', order: 9, icon: 'Flag' },
] as const;

export const AGING_THRESHOLDS = {
  new_deal: { warning: 2, critical: 5 },
  engineering_assigned: { warning: 3, critical: 7 },
  boq_pending: { warning: 2, critical: 4 },
  sourcing: { warning: 7, critical: 14 },
  execution: { warning: 30, critical: 60 },
} as const;

export const BOQ_CATEGORIES = [
  { value: 'material', label: 'Material' },
  { value: 'labour', label: 'Labour' },
  { value: 'equipment', label: 'Equipment' },
] as const;

export const BOQ_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'sourced', label: 'Sourced', color: 'blue' },
  { value: 'ordered', label: 'Ordered', color: 'indigo' },
  { value: 'delivered', label: 'Delivered', color: 'green' },
  { value: 'completed', label: 'Completed', color: 'emerald' },
] as const;

export type ProjectCategory = typeof PROJECT_CATEGORIES[number]['value'];
export type LifecycleStage = typeof LIFECYCLE_STAGES[number]['value'];
export type BOQCategory = typeof BOQ_CATEGORIES[number]['value'];
export type BOQStatus = typeof BOQ_STATUSES[number]['value'];
