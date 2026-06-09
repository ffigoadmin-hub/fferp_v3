import { differenceInDays, parseISO } from 'date-fns';

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Safe';

export interface RiskAnalysis {
    score: number; // 0-100
    level: RiskLevel;
    factors: string[];
    lastUpdateDays: number;
}

export const calculateProjectRisk = (project: any): RiskAnalysis => {
    let score = 0;
    const factors: string[] = [];

    // 1. Financial Risk (Weighted: 40%)
    const totalValue = Number(project.total_project_value) || 0;
    const pendingPayments = Number(project.pending_payments) || 0;

    if (totalValue > 0) {
        const duePercentage = (pendingPayments / totalValue) * 100;
        if (duePercentage > 50) {
            score += 40;
            factors.push(`Critical Dues: ${duePercentage.toFixed(0)}% of output pending`);
        } else if (duePercentage > 30) {
            score += 25;
            factors.push(`High Dues: ${duePercentage.toFixed(0)}% pending`);
        } else if (duePercentage > 10) {
            score += 10;
        }
    }

    // 2. Stagnation Risk (Weighted: 30%)
    // Assuming 'updated_at' exists, otherwise fallback to 'created_at'
    const lastActivityDate = project.updated_at ? parseISO(project.updated_at) : parseISO(project.created_at);
    const daysSinceUpdate = differenceInDays(new Date(), lastActivityDate);

    if (project.lifecycle_stage === 'execution') {
        if (daysSinceUpdate > 14) {
            score += 30;
            factors.push(`Stagnant: No updates for ${daysSinceUpdate} days`);
        } else if (daysSinceUpdate > 7) {
            score += 15;
            factors.push(`Slow Progress: No updates for ${daysSinceUpdate} days`);
        }
    }

    // 3. Process Bottleneck Risk (Weighted: 30%)
    const stageDate = project.stage_changed_at ? parseISO(project.stage_changed_at) : parseISO(project.created_at);
    const daysInStage = differenceInDays(new Date(), stageDate);

    if (['boq_draft', 'boq_submitted'].includes(project.lifecycle_stage) && daysInStage > 10) {
        score += 30;
        factors.push(`Stuck in BOQ for ${daysInStage} days`);
    } else if (['sourcing'].includes(project.lifecycle_stage) && daysInStage > 15) {
        score += 20;
        factors.push(`Sourcing delay: ${daysInStage} days`);
    }

    // Determine Level
    let level: RiskLevel = 'Safe';
    if (score >= 80) level = 'Critical';
    else if (score >= 60) level = 'High';
    else if (score >= 40) level = 'Medium';
    else if (score > 0) level = 'Low';

    return {
        score: Math.min(score, 100),
        level,
        factors,
        lastUpdateDays: daysSinceUpdate
    };
};
