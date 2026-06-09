import * as XLSX from 'xlsx';

export interface ExcelRow {
  employee_id: string;
  full_name: string;
  joining_date: string;
  phone_number: string;
  dob: string;
  emergency_contact_number: string;
  address: string;
  department: string;
  location_type: 'HEAD_OFFICE' | 'BACK_OFFICE' | 'OTHER';
  location_name?: string;
  status: 'ACTIVE' | 'INACTIVE';
  fixed_monthly_salary: number;
  bonus?: number;
  increment_amount?: number;
  incentive?: number;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value: any;
}

export interface ExcelImportResult {
  success: boolean;
  data: ExcelRow[];
  errors: ImportError[];
  totalRows: number;
  successCount: number;
  errorCount: number;
}

/**
 * Parse Excel file and validate data
 */
export async function parseExcelFile(file: File): Promise<ExcelImportResult> {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      throw new Error('Excel file must contain at least a header row and one data row');
    }

    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1) as any[][];
    const errors: ImportError[] = [];
    const validData: ExcelRow[] = [];

    // Validate headers
    const requiredHeaders = [
      'employee_id', 'full_name', 'joining_date', 'phone_number', 
      'dob', 'emergency_contact_number', 'address', 'department',
      'location_type', 'status', 'fixed_monthly_salary'
    ];

    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    // Process each row
    rows.forEach((row, index) => {
      const rowNum = index + 2; // Excel row numbers start at 1, plus header
      const rowData: any = {};
      
      headers.forEach((header, colIndex) => {
        rowData[header] = row[colIndex];
      });

      // Validate required fields
      const rowErrors: ImportError[] = [];

      if (!rowData.employee_id) {
        rowErrors.push({
          row: rowNum,
          field: 'employee_id',
          message: 'Employee ID is required',
          value: rowData.employee_id
        });
      }

      if (!rowData.full_name) {
        rowErrors.push({
          row: rowNum,
          field: 'full_name',
          message: 'Full name is required',
          value: rowData.full_name
        });
      }

      if (!rowData.phone_number) {
        rowErrors.push({
          row: rowNum,
          field: 'phone_number',
          message: 'Phone number is required',
          value: rowData.phone_number
        });
      }

      if (!rowData.department) {
        rowErrors.push({
          row: rowNum,
          field: 'department',
          message: 'Department is required',
          value: rowData.department
        });
      }

      if (!rowData.status || !['ACTIVE', 'INACTIVE'].includes(rowData.status)) {
        rowErrors.push({
          row: rowNum,
          field: 'status',
          message: 'Status must be ACTIVE or INACTIVE',
          value: rowData.status
        });
      }

      const salary = parseFloat(rowData.fixed_monthly_salary);
      if (isNaN(salary) || salary < 0) {
        rowErrors.push({
          row: rowNum,
          field: 'fixed_monthly_salary',
          message: 'Fixed monthly salary must be a valid positive number',
          value: rowData.fixed_monthly_salary
        });
      }

      // Validate location_type
      if (!['HEAD_OFFICE', 'BACK_OFFICE', 'OTHER'].includes(rowData.location_type)) {
        rowErrors.push({
          row: rowNum,
          field: 'location_type',
          message: 'Location type must be HEAD_OFFICE, BACK_OFFICE, or OTHER',
          value: rowData.location_type
        });
      }

      // Validate dates
      if (rowData.joining_date && !isValidDate(rowData.joining_date)) {
        rowErrors.push({
          row: rowNum,
          field: 'joining_date',
          message: 'Joining date must be a valid date (YYYY-MM-DD)',
          value: rowData.joining_date
        });
      }

      if (rowData.dob && !isValidDate(rowData.dob)) {
        rowErrors.push({
          row: rowNum,
          field: 'dob',
          message: 'Date of birth must be a valid date (YYYY-MM-DD)',
          value: rowData.dob
        });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        // Convert to proper ExcelRow format
        const excelRow: ExcelRow = {
          employee_id: String(rowData.employee_id),
          full_name: String(rowData.full_name),
          joining_date: rowData.joining_date,
          phone_number: String(rowData.phone_number),
          dob: rowData.dob,
          emergency_contact_number: String(rowData.emergency_contact_number || ''),
          address: String(rowData.address || ''),
          department: String(rowData.department),
          location_type: rowData.location_type as 'HEAD_OFFICE' | 'BACK_OFFICE' | 'OTHER',
          location_name: rowData.location_name || undefined,
          status: rowData.status as 'ACTIVE' | 'INACTIVE',
          fixed_monthly_salary: salary,
          bonus: parseFloat(rowData.bonus) || 0,
          increment_amount: parseFloat(rowData.increment_amount) || 0,
          incentive: parseFloat(rowData.incentive) || 0,
          bank_account_name: rowData.bank_account_name || undefined,
          bank_account_number: rowData.bank_account_number || undefined,
          bank_ifsc: rowData.bank_ifsc || undefined,
          bank_name: rowData.bank_name || undefined
        };

        validData.push(excelRow);
      }
    });

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      totalRows: rows.length,
      successCount: validData.length,
      errorCount: errors.length
    };

  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate date format
 */
function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  
  // Try YYYY-MM-DD format
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/) !== null;
}

/**
 * Export employees to Excel
 */
export function exportToExcel(data: any[], filename: string = 'employees.xlsx'): void {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error(`Failed to export to Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create Excel template for import
 */
export function createImportTemplate(): void {
  try {
    const templateData: Partial<ExcelRow>[] = [
      {
        employee_id: 'EMP001',
        full_name: 'John Doe',
        joining_date: '2024-01-01',
        phone_number: '+1234567890',
        dob: '1990-01-01',
        emergency_contact_number: '+1234567891',
        address: '123 Main St, City, State',
        department: 'IT',
        location_type: 'HEAD_OFFICE',
        location_name: 'Head Office',
        status: 'ACTIVE',
        fixed_monthly_salary: 50000,
        bonus: 1000,
        increment_amount: 500,
        incentive: 200,
        bank_account_name: 'John Doe',
        bank_account_number: '1234567890',
        bank_ifsc: 'BANK0001234',
        bank_name: 'Example Bank'
      }
    ];

    exportToExcel(templateData, 'employee_import_template.xlsx');
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
}
