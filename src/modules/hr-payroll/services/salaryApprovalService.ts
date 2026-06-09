import { supabase } from '@/integrations/supabase/client';

export interface SalaryApproval {
  id?: string;
  payroll_id: string;
  month: number;
  year: number;
  from_day: number;
  to_day: number;
  file_path: string;
  file_name: string;
  uploaded_by: string;
  status: 'pending' | 'auditor_audited' | 'auditor_rejected' | 'director_audited' | 'director_rejected' | 'ceo_approved' | 'ceo_rejected' | 'account_executed';
  auditor_comment?: string;
  audited_by_auditor?: string;
  director_comment?: string;
  audited_by_director?: string;
  ceo_comment?: string;
  account_comment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalaryApprovalWithDetails extends SalaryApproval {
  uploader_name?: string;
  auditor_name?: string;
  director_name?: string;
  ceo_name?: string;
  account_name?: string;
}

// Upload salary CSV for approval
export const uploadSalaryForApproval = async (file: File, payrollData: {
  month: number;
  year: number;
  fromDay: number;
  toDay: number;
  totalEmployees: number;
  totalAmount: number;
}) => {
  try {
    // Upload file to storage
    const fileName = `salary_${payrollData.month}_${payrollData.year}_days_${payrollData.fromDay}-${payrollData.toDay}_${Date.now()}.csv`;
    const { data: fileData, error: fileError } = await supabase.storage
      .from('salary-approvals')
      .upload(fileName, file);

    if (fileError) throw fileError;

    // Create approval record
    const { data, error } = await supabase
      .from('salary_approvals')
      .insert({
        payroll_id: `payroll_${payrollData.month}_${payrollData.year}_days_${payrollData.fromDay}-${payrollData.toDay}`,
        month: payrollData.month,
        year: payrollData.year,
        from_day: payrollData.fromDay,
        to_day: payrollData.toDay,
        file_path: fileData.path,
        file_name: fileName,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error uploading salary for approval:', error);
    throw error;
  }
};

// Get all salary approvals
export const getSalaryApprovals = async () => {
  try {
    const { data, error } = await supabase
      .from('salary_approvals')
      .select(`
        *,
        uploader:profiles!salary_approvals_uploaded_by_fkey(name),
        auditor:profiles!salary_approvals_audited_by_auditor_fkey(name),
        director:profiles!salary_approvals_audited_by_director_fkey(name),
        ceo:profiles!salary_approvals_ceo_approved_by_fkey(name),
        account:profiles!salary_approvals_account_approved_by_fkey(name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as SalaryApprovalWithDetails[];
  } catch (error) {
    console.error('Error fetching salary approvals:', error);
    throw error;
  }
};

// CEO approval/rejection
export const updateSalaryApprovalByCEO = async (id: string, status: 'ceo_approved' | 'ceo_rejected', comment?: string) => {
  try {
    const { data, error } = await supabase
      .from('salary_approvals')
      .update({
        status,
        ceo_comment: comment,
        ceo_approved_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating salary approval by CEO:', error);
    throw error;
  }
};

// Auditor approval
export const auditSalaryByAuditor = async (id: string, status: 'auditor_audited' | 'auditor_rejected', comment?: string) => {
  try {
    const { data, error } = await supabase
      .from('salary_approvals')
      .update({
        status,
        auditor_comment: comment,
        audited_by_auditor: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error auditing salary by auditor:', error);
    throw error;
  }
};

// Director approval
export const auditSalaryByDirector = async (id: string, status: 'director_audited' | 'director_rejected', comment?: string) => {
  try {
    const { data, error } = await supabase
      .from('salary_approvals')
      .update({
        status,
        director_comment: comment,
        audited_by_director: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error auditing salary by director:', error);
    throw error;
  }
};

// Accounts approval
export const executeSalaryByAccounts = async (id: string, comment?: string) => {
  try {
    const { data, error } = await supabase
      .from('salary_approvals')
      .update({
        status: 'account_executed',
        account_comment: comment,
        account_approved_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error executing salary by accounts:', error);
    throw error;
  }
};

// Get download URL for file
export const getSalaryFileUrl = async (filePath: string) => {
  try {
    const { data } = await supabase.storage
      .from('salary-approvals')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    return data?.signedUrl;
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
};
