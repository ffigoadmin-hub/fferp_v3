export interface ProjectVariation {
    id: string;
    project_id: string;
    type: 'addition' | 'deduction';
    amount: number;
    category: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    approved_at?: string;
}

export interface ProjectFinancialSummary {
    base_contract_value: number;
    total_variations: number;
    net_contract_value: number;
    total_collected: number;
    total_outstanding: number;
}
