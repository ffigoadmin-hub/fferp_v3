# Payroll Management System

A comprehensive payroll management system built with Supabase (PostgreSQL) that handles employee salaries, LOP (Loss of Pay) deductions, and automated payroll calculations.

## 📋 Table of Contents

- [Features](#features)
- [Database Schema](#database-schema)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Calculation Logic](#calculation-logic)
- [Security](#security)
- [Performance](#performance)

## ✨ Features

### Core Functionality
- ✅ **Employee Management**: Fetch employees from existing profiles table
- ✅ **Salary Management**: Manual input for basic salary, increment, and incentive
- ✅ **LOP Tracking**: Automatic LOP days fetching and calculation
- ✅ **Automated Calculations**: TDS, LOP amount, and final salary
- ✅ **Department-wise Filtering**: Filter and analyze by department
- ✅ **Real-time Statistics**: Dashboard with key payroll metrics
- ✅ **Export Functionality**: Export payroll data to CSV

### Technical Features
- ✅ **TypeScript Support**: Full type safety with interfaces
- ✅ **React Query Integration**: Optimized data fetching and caching
- ✅ **Responsive UI**: Built with Shadcn UI components
- ✅ **Error Handling**: Comprehensive error handling and validation
- ✅ **Performance Optimized**: Indexed queries and optimized joins
- ✅ **Row Level Security**: Proper RLS policies for data protection

## 🗄️ Database Schema

### Tables

#### 1. `profiles` (Existing)
```sql
- id (uuid, primary key)
- name (text)
- department (text)
```

#### 2. `employee_master`
```sql
- id (uuid, primary key)
- employee_id (uuid, foreign key → profiles.id)
- basic_salary (decimal, not null)
- increment (decimal, default 0)
- incentive (decimal, default 0)
- tds_percent (decimal, default 1.0)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### 3. `lop_entries`
```sql
- id (uuid, primary key)
- employee_id (uuid, foreign key → profiles.id)
- lop_days (decimal, not null)
- reason (text, optional)
- lop_date (date, not null)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Views

#### `payroll_summary`
A comprehensive view that joins all tables and calculates:
- Daily salary
- LOP amount
- Gross salary
- TDS amount
- Final salary
- Aggregated LOP days per employee

## 🚀 Installation

### 1. Database Setup

Run the SQL scripts in order:

```bash
# 1. Create tables and RLS policies
psql -d your_database -f 01_create_payroll_tables.sql

# 2. Create payroll summary view
psql -d your_database -f 02_create_payroll_view.sql
```

### 2. Environment Setup

Ensure your Supabase client is configured:

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### 3. Component Integration

Add the payroll system to your React app:

```tsx
import PayrollSystemPage from './src/modules/hr-payroll/pages/PayrollSystemPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/payroll" element={<PayrollSystemPage />} />
        {/* other routes */}
      </Routes>
    </Router>
  );
}
```

## 📖 Usage

### Basic Usage

```sql
-- Get complete payroll summary
SELECT * FROM payroll_summary ORDER BY name;

-- Get department-wise payroll
SELECT * FROM payroll_summary WHERE department = 'IT' ORDER BY name;

-- Get employees with LOP deductions
SELECT * FROM payroll_summary WHERE lop_days > 0 ORDER BY lop_days DESC;
```

### TypeScript Usage

```typescript
import { 
  fetchPayrollSummary, 
  upsertEmployeeMaster,
  formatCurrency 
} from '../services/payrollSystemService';

// Fetch payroll data
const payrollData = await fetchPayrollSummary();

// Update employee salary
await upsertEmployeeMaster({
  employee_id: 'employee-uuid',
  basic_salary: 50000,
  increment: 2000,
  incentive: 1000,
  tds_percent: 1.0
});

// Format currency
const formatted = formatCurrency(50000); // ₹50,000.00
```

## 🔧 API Reference

### Main Functions

#### `fetchPayrollSummary(): Promise<PayrollSummary[]>`
Fetches complete payroll data with all calculations.

#### `upsertEmployeeMaster(input: PayrollInput): Promise<EmployeeMaster>`
Creates or updates employee salary records.

#### `fetchProfiles(): Promise<Profile[]>`
Fetches all employee profiles.

#### `getPayrollStatistics(): Promise<PayrollStatistics>`
Returns aggregated payroll statistics.

### Types

```typescript
interface PayrollSummary {
  employee_uuid: string;
  id: string;
  name: string;
  department: string;
  basic_salary: number;
  increment: number;
  incentive: number;
  lop_days: number;
  daily_salary: number;
  lop_amount: number;
  gross_salary: number;
  salary_after_lop: number;
  tds_percent: number;
  tds_amount: number;
  final_salary: number;
  has_salary_record: boolean;
}

interface PayrollInput {
  employee_id: string;
  basic_salary: number;
  increment?: number;
  incentive?: number;
  tds_percent?: number;
}
```

## 🧮 Calculation Logic

### Salary Calculations

```typescript
// 1. Daily Salary
daily_salary = basic_salary / 30

// 2. LOP Amount
lop_amount = daily_salary * lop_days

// 3. Gross Salary
gross_salary = basic_salary + increment + incentive

// 4. Salary After LOP
salary_after_lop = gross_salary - lop_amount

// 5. TDS Amount
tds_amount = salary_after_lop * (tds_percent / 100)

// 6. Final Salary
final_salary = salary_after_lop - tds_amount
```

### Example Calculation

```
Basic Salary: ₹50,000
Increment: ₹2,000
Incentive: ₹1,000
LOP Days: 1.5
TDS %: 1%

Daily Salary = 50,000 / 30 = ₹1,666.67
LOP Amount = 1,666.67 × 1.5 = ₹2,500.00
Gross Salary = 50,000 + 2,000 + 1,000 = ₹53,000.00
Salary After LOP = 53,000 - 2,500 = ₹50,500.00
TDS Amount = 50,500 × 0.01 = ₹505.00
Final Salary = 50,500 - 505 = ₹49,995.00
```

## 🔒 Security

### Row Level Security (RLS)

The system implements comprehensive RLS policies:

#### Employee Master Table
- **Users**: Can view records for their department
- **HR/Admin**: Can insert, update, and view all records

#### LOP Entries Table
- **Users**: Can view their own LOP entries
- **HR/Admin**: Full CRUD access to all LOP entries

#### Payroll Summary View
- **Authenticated Users**: Read access to summary data

### Security Best Practices
- ✅ All tables have RLS enabled
- ✅ Foreign key constraints enforced
- ✅ Input validation on all numeric fields
- ✅ SQL injection prevention with parameterized queries
- ✅ Proper error handling without exposing sensitive data

## ⚡ Performance

### Database Indexes

```sql
-- Employee Master
CREATE INDEX idx_employee_master_employee_id ON employee_master(employee_id);

-- LOP Entries
CREATE INDEX idx_lop_entries_employee_id ON lop_entries(employee_id);
CREATE INDEX idx_lop_entries_date ON lop_entries(lop_date);
```

### Query Optimization

- **Joins**: Optimized with proper foreign key relationships
- **Aggregations**: Pre-calculated in the payroll_summary view
- **Filtering**: Indexed on frequently filtered columns
- **Caching**: React Query provides client-side caching

### Performance Tips

1. **Use the payroll_summary view** for most queries instead of manual joins
2. **Filter by department** for faster results on large datasets
3. **Use React Query caching** to reduce database load
4. **Consider materialized views** for very large datasets (>100k employees)

## 📊 Monitoring & Analytics

### Built-in Statistics

The system provides real-time statistics:
- Total employees
- Employees with salary records
- Total basic salary
- Total final salary
- Average final salary
- Total LOP deductions
- Total TDS amount

### Custom Queries

Use the example queries in `03_example_queries.sql` for:
- Department-wise analysis
- Salary range distribution
- LOP trends
- Top earners analysis
- Data validation

## 🛠️ Maintenance

### Regular Tasks

1. **Data Validation**: Run validation queries weekly
2. **Performance Monitoring**: Check query performance monthly
3. **Backup**: Regular database backups
4. **Audit Trail**: Monitor changes to salary records

### Troubleshooting

#### Common Issues

1. **Missing Salary Records**
   ```sql
   -- Check employees without salary records
   SELECT * FROM payroll_summary WHERE NOT has_salary_record;
   ```

2. **Incorrect Calculations**
   ```sql
   -- Validate payroll calculations
   SELECT * FROM payroll_validation_query;
   ```

3. **Performance Issues**
   ```sql
   -- Analyze query performance
   EXPLAIN ANALYZE SELECT * FROM payroll_summary WHERE department = 'IT';
   ```

## 📝 Changelog

### v1.0.0
- Initial release
- Basic payroll functionality
- LOP calculations
- Employee salary management
- Department-wise filtering
- Export functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
1. Check the example queries file
2. Review the calculation logic documentation
3. Validate data integrity using provided queries
4. Check browser console for TypeScript errors

---

**Note**: This system is designed to work with an existing `profiles` table in Supabase. Ensure the profiles table exists before setting up the payroll system.
