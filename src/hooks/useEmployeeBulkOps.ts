import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export interface EmployeeImportRow {
    id: string; // UUID from Supabase
    name: string;
    email: string; // For reference/matching if ID is missing (dev choice: enforce ID for safety)
    role: string;
    department: string;
    office_number: string; // This is the "Employee ID" visible to users
    is_active: boolean | string; // Boolean or string 'TRUE'/'FALSE'
}

export function useEmployeeBulkOps() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const exportEmployeesTemplate = async () => {
        setIsProcessing(true);
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, name, email, role, department, office_number, is_active')
                .order('name');

            if (error) throw error;

            // Transform data for Excel
            const exportData = profiles.map(p => ({
                'System ID (DO NOT CHANGE)': p.id,
                'Name': p.name,
                'Email': p.email,
                'Role': p.role,
                'Department': p.department,
                'Employee ID': p.office_number || '', // This maps to office_number
                'Active Status': p.is_active ? 'TRUE' : 'FALSE'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Employees");

            // Generate filename with date
            const date = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `employee_bulk_update_template_${date}.xlsx`);

            toast.success("Template downloaded successfully");
        } catch (error: any) {
            console.error('Export error:', error);
            toast.error('Failed to download template: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const processImportedFile = async (file: File): Promise<EmployeeImportRow[] | null> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    const parsedRows: EmployeeImportRow[] = jsonData.map((row: any) => ({
                        id: row['System ID (DO NOT CHANGE)'],
                        name: row['Name'],
                        email: row['Email'],
                        role: row['Role'],
                        department: row['Department'],
                        office_number: row['Employee ID'],
                        is_active: row['Active Status'] === true || String(row['Active Status']).toUpperCase() === 'TRUE'
                    }));

                    resolve(parsedRows);
                } catch (error) {
                    console.error('Parse error:', error);
                    toast.error('Failed to parse file. Please ensure it matches the template format.');
                    resolve(null);
                }
            };

            reader.onerror = (error) => {
                console.error('File read error:', error);
                toast.error('Failed to read file');
                resolve(null);
            };

            reader.readAsArrayBuffer(file);
        });
    };

    const bulkUpdateEmployees = async (data: EmployeeImportRow[]) => {
        setIsProcessing(true);
        setProgress(0);
        let successCount = 0;
        let failCount = 0;

        try {
            const total = data.length;

            // Process in batches of 5 to avoid overwhelming the connection/UI
            const BATCH_SIZE = 5;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async (row) => {
                    if (!row.id) {
                        console.warn('Skipping row without ID:', row);
                        failCount++; // Or handle creating new users? (Out of scope for "Update")
                        return;
                    }

                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            name: row.name,
                            role: row.role, // Be careful with role validation!
                            department: row.department,
                            office_number: row.office_number, // Updating Employee ID (office_number)
                            is_active: Boolean(row.is_active)
                        })
                        .eq('id', row.id);

                    if (error) {
                        console.error(`Failed to update ${row.name} (${row.id}):`, error);
                        failCount++;
                    } else {
                        successCount++;
                    }
                }));

                setProgress(Math.min(100, Math.round(((i + BATCH_SIZE) / total) * 100)));
            }

            toast.success(`Bulk update completed: ${successCount} updated, ${failCount} failed`);
            return { success: true, successCount, failCount };
        } catch (error: any) {
            console.error('Bulk update fatal error:', error);
            toast.error('Bulk update failed: ' + error.message);
            return { success: false, error };
        } finally {
            setIsProcessing(false);
            setProgress(0);
        }
    };

    return {
        isProcessing,
        progress,
        exportEmployeesTemplate,
        processImportedFile,
        bulkUpdateEmployees
    };
}
