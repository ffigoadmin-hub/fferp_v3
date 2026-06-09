import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval } from 'date-fns';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { TIME_SLOTS } from '@/types/igo-chain';

export interface ActivityReportMember {
    id: string;
    name: string;
    employee_id: string;
    department: string;
    role: string;
}

export interface GranularActivityRow {
    date: string;
    employee_name: string;
    employee_id: string;
    department: string;
    login_time: string;
    late_login_mins: string;
    location: string;
    [key: string]: string; // For dynamic slot columns
}

export function useActivityReport() {
    const [isLoading, setIsLoading] = useState(false);

    const fetchMembers = useCallback(async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, office_number, department, role')
            .eq('is_active', true)
            .not('role', 'ilike', '%ceo%')
            .not('role', 'ilike', '%auditor%')
            .order('name');

        if (error) throw error;
        return data.map(m => ({
            id: m.id,
            name: m.name,
            employee_id: m.office_number || `EMP-${m.id.slice(0, 6).toUpperCase()}`,
            department: m.department || 'N/A',
            role: m.role || 'N/A'
        }));
    }, []);

    const downloadFullActivityReport = async (
        startDate: Date,
        endDate: Date,
        filterType: 'all' | 'department' | 'person',
        filterValue?: string
    ) => {
        setIsLoading(true);
        try {
            const dateStrStart = format(startDate, 'yyyy-MM-dd');
            const dateStrEnd = format(endDate, 'yyyy-MM-dd');

            // 1. Fetch Profiles
            let profileQuery = supabase
                .from('profiles')
                .select('*')
                .eq('is_active', true)
                .not('role', 'ilike', '%ceo%')
                .not('role', 'ilike', '%auditor%');

            if (filterType === 'department' && filterValue) {
                profileQuery = profileQuery.eq('department', filterValue);
            } else if (filterType === 'person' && filterValue) {
                profileQuery = profileQuery.eq('id', filterValue);
            }

            const { data: profiles, error: pError } = await profileQuery;
            if (pError) throw pError;
            if (!profiles || profiles.length === 0) {
                toast.info('No employees found for the selected filter');
                return;
            }

            const userIds = profiles.map(p => p.id);

            // 2. Fetch all activity data for the range
            const [
                dayStarts,
                dayPlans,
                hourlyPlans,
                hourlyReports,
                eodReports,
                selfies
            ] = await Promise.all([
                supabase.from('day_starts').select('*').in('user_id', userIds).gte('date', dateStrStart).lte('date', dateStrEnd),
                supabase.from('day_plans').select('*').in('user_id', userIds).gte('date', dateStrStart).lte('date', dateStrEnd),
                supabase.from('hourly_plans').select('*').in('user_id', userIds).gte('date', dateStrStart).lte('date', dateStrEnd),
                supabase.from('hourly_reports').select('*').in('user_id', userIds).gte('date', dateStrStart).lte('date', dateStrEnd),
                supabase.from('eod_reports').select('*').in('user_id', userIds).gte('date', dateStrStart).lte('date', dateStrEnd),
                supabase.from('selfie_records').select('*').in('user_id', userIds).gte('date', dateStrStart).lte('date', dateStrEnd)
            ]);

            // Helper to format slot content
            const formatSlotContent = (text: string, dayPlanTasks: string[] | null | undefined): string => {
                if (!text) return 'N/A';
                if (text === 'N/A') return 'N/A';

                try {
                    let parsed: any;
                    try {
                        parsed = JSON.parse(text);
                    } catch (e) {
                        // Not JSON, return plain text
                        return text;
                    }

                    // Handle double-stringified JSON (common issue)
                    if (typeof parsed === 'string') {
                        try {
                            parsed = JSON.parse(parsed);
                        } catch {
                            // If second parse fails, it might be just a normal string that looked like JSON? 
                            // Or just return the first string.
                            return parsed;
                        }
                    }

                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        const parts: string[] = [];

                        // Handle tasks array
                        if (Array.isArray(parsed.tasks)) {
                            if (parsed.tasks.length > 0) {
                                // Check if we have task indices
                                const areIndices = parsed.tasks.every((t: any) => typeof t === 'number');

                                if (areIndices) {
                                    if (dayPlanTasks && dayPlanTasks.length > 0) {
                                        const taskNames = parsed.tasks
                                            .map((idx: number) => dayPlanTasks[idx])
                                            .filter(Boolean);

                                        if (taskNames.length > 0) {
                                            parts.push(`Tasks: ${taskNames.join(', ')}`);
                                        } else {
                                            // Indices exist but no matching names in day plan
                                            parts.push(`Tasks: [IDs: ${parsed.tasks.join(', ')}]`);
                                        }
                                    } else {
                                        // Indices exist but no day plan provided
                                        parts.push(`Tasks: [IDs: ${parsed.tasks.join(', ')}]`);
                                    }
                                } else {
                                    // Tasks are strings (legacy or free-text)
                                    parts.push(`Tasks: ${parsed.tasks.join(', ')}`);
                                }
                            } else {
                                // Empty task array
                                // parts.push("Tasks: None"); // Optional: skip if empty
                            }
                        }

                        if (parsed.notes) {
                            const cleanNotes = String(parsed.notes).replace(/^"|"$/g, '');
                            if (cleanNotes.trim()) parts.push(`Notes: ${cleanNotes}`);
                        }

                        // Handle generic key-values if not using standard structure and we haven't found standard fields
                        if (parts.length === 0) {
                            Object.entries(parsed).forEach(([k, v]) => {
                                if (k !== 'tasks' && k !== 'notes' && typeof v === 'string') {
                                    parts.push(`${k}: ${v}`);
                                }
                            });
                        }

                        // If we successfully extracted standard parts, return them joined
                        if (parts.length > 0) {
                            return parts.join('\n');
                        }

                        // If object but empty or weird structure, fallback to formatted JSON or original
                        return JSON.stringify(parsed);
                    }
                } catch {
                    // Overall catch
                }
                return text;
            };

            // 3. Process data into rows
            const days = eachDayOfInterval({ start: startDate, end: endDate });
            const reportData: GranularActivityRow[] = [];

            const activeSlots = TIME_SLOTS.filter(s => !s.isLunchBreak);

            for (const day of days) {
                const dStr = format(day, 'yyyy-MM-dd');

                for (const profile of profiles) {
                    const ds = dayStarts.data?.find(d => d.user_id === profile.id && d.date === dStr);
                    const dp = dayPlans.data?.find(d => d.user_id === profile.id && d.date === dStr);
                    const morningSelfie = selfies.data?.find(s => s.user_id === profile.id && s.date === dStr && s.selfie_type === 'morning_login');
                    const loginTimestamp = morningSelfie?.captured_at || ds?.submitted_at;

                    // Calculate Late Login (IST Threshold: 10:15 AM)
                    let lateLoginMins = "0";
                    if (loginTimestamp) {
                        const loginDate = new Date(loginTimestamp);
                        if (!isNaN(loginDate.getTime())) {
                            // Convert to IST (UTC+5:30)
                            const istTime = new Date(loginDate.getTime() + (5.5 * 60 * 60 * 1000));
                            const hours = istTime.getUTCHours();
                            const minutes = istTime.getUTCMinutes();
                            const totalMins = hours * 60 + minutes;
                            const cutoffMins = 10 * 60 + 15;

                            if (totalMins > cutoffMins) {
                                lateLoginMins = (totalMins - cutoffMins).toString();
                            }
                        }
                    }

                    const plans = hourlyPlans.data?.filter(p => p.user_id === profile.id && p.date === dStr) || [];
                    const reports = hourlyReports.data?.filter(r => r.user_id === profile.id && r.date === dStr) || [];
                    const eod = eodReports.data?.find(e => e.user_id === profile.id && e.date === dStr);

                    const row: GranularActivityRow = {
                        date: dStr,
                        employee_name: profile.name,
                        employee_id: profile.office_number || 'N/A',
                        department: profile.department || 'N/A',
                        login_time: loginTimestamp ? format(new Date(loginTimestamp), 'HH:mm:ss') : 'N/A',
                        late_login_mins: lateLoginMins,
                        location: ds?.location_zone || 'N/A',
                        eod_status: eod ? `YES (${eod.completion_percentage}%)` : 'NO'
                    };

                    // Fill slot details
                    activeSlots.forEach(slot => {
                        const plan = plans.find(p => p.time_slot === slot.id);
                        const report = reports.find(r => r.time_slot === slot.id);

                        const label = `${slot.startTime} - ${slot.endTime}`;

                        // Use helper to format content
                        row[`Plan_${label}`] = formatSlotContent(plan?.plan_text, dp?.tasks);
                        row[`Report_${label}`] = formatSlotContent(report?.report_text, dp?.tasks);
                        row[`Late_${label}`] = report?.is_late ? `${report.delay_minutes}m` : '0m';
                    });

                    reportData.push(row);
                }
            }

            // 4. Export
            const csvHeaders: { key: string, label: string }[] = [
                { key: 'date', label: 'Date' },
                { key: 'employee_name', label: 'Name' },
                { key: 'employee_id', label: 'ID' },
                { key: 'department', label: 'Department' },
                { key: 'login_time', label: 'Login' },
                { key: 'late_login_mins', label: 'Late Login (m)' },
                { key: 'location', label: 'Location' },
                { key: 'eod_status', label: 'EOD Status' },
            ];

            activeSlots.forEach(slot => {
                const label = `${slot.startTime} - ${slot.endTime}`;
                csvHeaders.push({ key: `Plan_${label}`, label: `Plan ${label}` });
                csvHeaders.push({ key: `Report_${label}`, label: `Report ${label}` });
                csvHeaders.push({ key: `Late_${label}`, label: `Late ${label}` });
            });

            exportToExcel(reportData, `activity-report-${dateStrStart}-to-${dateStrEnd}`, csvHeaders as any);
            toast.success('Activity report downloaded');

        } catch (error: any) {
            console.error('Error generating report:', error);
            toast.error('Failed to generate report: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadLOPMasterReport = async (startDate: Date, endDate: Date) => {
        setIsLoading(true);
        try {
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            // Fetch all data with pagination
            while (hasMore) {
                const { data, error } = await supabase
                    .from('lop_entries')
                    .select(`
                        *,
                        profiles:employee_id (name, office_number, department, email)
                    `)
                    .neq('status', 'rejected')
                    .gte('lop_date', format(startDate, 'yyyy-MM-dd'))
                    .lte('lop_date', format(endDate, 'yyyy-MM-dd'))
                    .order('lop_date', { ascending: false })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
            }

            if (allData.length === 0) {
                toast.info('No LOP entries found for the selected range');
                return;
            }

            const exportData = allData.map(item => ({
                date: item.lop_date,
                name: (item.profiles as any)?.name || 'N/A',
                emp_id: (item.profiles as any)?.office_number || 'N/A',
                department: (item.profiles as any)?.department || 'N/A',
                type: item.lop_type,
                reason: item.reason,
                auto_reason: item.auto_reason || '',
                source: item.source,
                status: item.status,
                evidence: item.evidence_url || ''
            }));

            const headers: { key: string; label: string }[] = [
                { key: 'date', label: 'Date' },
                { key: 'name', label: 'Employee Name' },
                { key: 'emp_id', label: 'Employee ID' },
                { key: 'department', label: 'Department' },
                { key: 'type', label: 'LOP Type' },
                { key: 'status', label: 'Status' },
                { key: 'source', label: 'Source' },
                { key: 'reason', label: 'Reason' },
                { key: 'auto_reason', label: 'Auto Reason Detail' },
                { key: 'evidence', label: 'Evidence Link' },
            ];

            exportToExcel(exportData, `lop-master-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}`, headers as any);
            toast.success(`LOP Master report downloaded (${allData.length} entries)`);

        } catch (error: any) {
            console.error('Error generating LOP report:', error);
            toast.error('Failed to generate LOP report: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadLOPAuditReport = async (startDate: Date, endDate: Date) => {
        setIsLoading(true);
        try {
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            // Fetch all LOP entries with pagination
            while (hasMore) {
                const { data, error } = await supabase
                    .from('lop_entries')
                    .select(`
                        *,
                        profiles:employee_id (name, office_number, department, email)
                    `)
                    .neq('status', 'rejected')
                    .gte('lop_date', format(startDate, 'yyyy-MM-dd'))
                    .lte('lop_date', format(endDate, 'yyyy-MM-dd'))
                    .order('employee_id')
                    .order('lop_date', { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
                    hasMore = data.length === pageSize;
                    page++;
                }
            }

            if (allData.length === 0) {
                toast.info('No LOP entries found for the selected range');
                return;
            }

            // Group by employee and calculate totals
            const employeeMap = new Map<string, any>();
            const getLOPValue = (type: string): number => {
                if (type === '0.1_day' || type.includes('0.1')) return 0.1;
                if (type.includes('1') || type === '1_day') return 1;
                if (type.includes('0.5') || type === '0.5_day') return 0.5;
                if (type.includes('0.25') || type === '0.25_day') return 0.25;
                return 0;
            };

            for (const entry of allData) {
                const empId = (entry.profiles as any)?.office_number || 'N/A';
                const empName = (entry.profiles as any)?.name || 'Unknown';
                const lopValue = getLOPValue(entry.lop_type);

                if (!employeeMap.has(empId)) {
                    employeeMap.set(empId, {
                        employee_id: empId,
                        employee_name: empName,
                        department: (entry.profiles as any)?.department || 'N/A',
                        email: (entry.profiles as any)?.email || '',
                        lop_entries: [],
                        total_lop_days: 0,
                    });
                }

                const employee = employeeMap.get(empId);
                employee.lop_entries.push({
                    date: entry.lop_date,
                    type: entry.lop_type,
                    days: lopValue,
                    reason: entry.reason || entry.auto_reason || '',
                    status: entry.status,
                    source: entry.source,
                });
                employee.total_lop_days += lopValue;
            }

            // Build Excel data (handle both ESM and CJS module shapes)
            const xlsxModule: any = await import('xlsx');
            const XLSX: any = xlsxModule?.utils ? xlsxModule : xlsxModule?.default;
            if (!XLSX?.utils) {
                throw new Error('XLSX library failed to load');
            }
            const workbook = XLSX.utils.book_new();

            // Sheet 1: Summary (User Name, Total Days, Entry Count)
            const summaryData = Array.from(employeeMap.values()).map(emp => ({
                'Employee Name': emp.employee_name,
                'Employee ID': emp.employee_id,
                'Department': emp.department,
                'Email': emp.email,
                'Total LOP Days': emp.total_lop_days,
                'LOP Entry Count': emp.lop_entries.length,
            }));

            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            summarySheet['!cols'] = [
                { wch: 25 }, // Employee Name
                { wch: 15 }, // Employee ID
                { wch: 20 }, // Department
                { wch: 30 }, // Email
                { wch: 16 }, // Total LOP Days
                { wch: 16 }, // LOP Entry Count
            ];
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

            // Sheet 2: Detailed LOP List
            const detailData: any[] = [];
            for (const emp of Array.from(employeeMap.values())) {
                for (const entry of emp.lop_entries) {
                    detailData.push({
                        'Employee Name': emp.employee_name,
                        'Employee ID': emp.employee_id,
                        'Department': emp.department,
                        'LOP Date': entry.date,
                        'LOP Type': entry.type,
                        'LOP Days': entry.days,
                        'Reason': entry.reason,
                        'Status': entry.status,
                        'Source': entry.source,
                    });
                }
            }

            const detailSheet = XLSX.utils.json_to_sheet(detailData);
            detailSheet['!cols'] = [
                { wch: 25 }, // Employee Name
                { wch: 15 }, // Employee ID
                { wch: 20 }, // Department
                { wch: 12 }, // LOP Date
                { wch: 12 }, // LOP Type
                { wch: 12 }, // LOP Days
                { wch: 40 }, // Reason
                { wch: 15 }, // Status
                { wch: 12 }, // Source
            ];
            XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detailed List');

            const filename = `LOP_Audit_${format(startDate, 'ddMMMyyyy')}_to_${format(endDate, 'ddMMMyyyy')}.xlsx`;
            XLSX.writeFile(workbook, filename);

            toast.success(`✅ LOP Audit Report downloaded (${employeeMap.size} employees, ${allData.length} entries)`);

        } catch (error: any) {
            console.error('Error generating LOP audit report:', error);
            toast.error('Failed to generate LOP audit report: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        fetchMembers,
        downloadFullActivityReport,
        downloadLOPMasterReport,
        downloadLOPAuditReport
    };
}
