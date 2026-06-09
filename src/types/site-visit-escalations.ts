export type SiteVisitEscalationStatus = 'pending' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
export type SiteVisitEscalationLayer = 'layer_1' | 'layer_2' | 'layer_3' | 'boi';

export interface SiteVisitEscalation {
    id: string;
    escalation_number: number;

    // Creation
    raised_by_rsh_id: string;
    site_visit_target_id?: string;
    issue_description: string;
    issue_proof_url: string;
    raised_at: string;

    // Metadata links (joined)
    raised_by?: {
        name: string;
        email: string;
        role: string;
    };
    site_visit_target?: {
        name: string;
        email: string;
    };

    // Layer Assignment
    current_layer: SiteVisitEscalationLayer;
    assigned_layer_1_id?: string; // Person
    assigned_layer_2_id?: string; // GM
    assigned_layer_3_id?: string; // CEO
    assigned_by_boi_id?: string;
    assigned_at?: string;

    // Layer Solvers (joined)
    assigned_layer_1?: { name: string; email: string };
    assigned_layer_2?: { name: string; email: string };
    assigned_layer_3?: { name: string; email: string };
    assigned_by_boi?: { name: string; email: string };

    // Resolution
    resolution_text?: string;
    resolution_proof_url?: string;
    resolved_by?: string;
    resolved_at?: string;
    resolved_by_user?: { name: string; email: string };

    // Timestamps
    layer_1_resolved_at?: string;
    layer_2_resolved_at?: string;
    layer_3_resolved_at?: string;

    // Status
    status: SiteVisitEscalationStatus;
    closed_by_admin_id?: string;
    closure_verified_at?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateSiteVisitEscalationInput {
    site_visit_target_id?: string;
    issue_description: string;
    issue_proof_url: string;
}
