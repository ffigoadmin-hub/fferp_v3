# HR & Payroll Module

A comprehensive HR and Payroll management system built with TypeScript, React, and Supabase. This module provides complete employee management, payroll processing, and payslip generation capabilities.

## 🚀 Features

### Employee Management
- **Employee Master Data**: Complete employee profiles with all required fields
- **Auto-generated Employee IDs**: Automatic ID generation (EMP001, EMP002, etc.)
- **Department & Location Management**: Organize employees by department and work location
- **Status Management**: Active/Inactive employee status tracking
- **Bank Details**: Optional bank account information for salary processing
- **Search & Filtering**: Advanced search and filter capabilities

### Payroll Processing
- **Monthly Payroll Generation**: Automated payroll calculation for all active employees
- **Flexible Salary Structure**: Fixed monthly salary with bonus and incentive support
- **LOP (Loss of Pay) Calculation**: Automatic LOP calculation with manual override capability
- **Payment Schedule Split**: 1-20 days paid on 2nd of next month, 21-end paid on 10th of next month
- **TDS Calculation**: 1% TDS on gross pay (configurable)
- **PF/ESI Support**: Structured for future PF/ESI implementation (currently set to 0)
- **Idempotent Generation**: Regenerating payroll updates existing DRAFT records

### Attendance Integration
- **Stub Implementation**: Ready for attendance module integration
- **LOP Days Import**: Automatic LOP days from attendance/leave system
- **Manual Override**: HR can override LOP days per payroll run
- **Validation**: Ensures LOP days don't exceed payable days

### Payslip Generation
- **Professional PDF Payslips**: Automated payslip generation with company branding
- **Bulk Download**: Download all payslips for a payroll run as ZIP
- **Individual Download**: Employees can download their own payslips
- **Integrity Checks**: SHA-256 checksums for PDF integrity verification
- **Storage Integration**: Configurable storage for PDF documents

### Role-Based Access Control
- **HR/Admin Role**: Full access to employee and payroll management
- **Employee Role**: Self-service access to profile and payslips only
- **Data Security**: Row-level security ensures employees see only their data
- **Audit Trail**: Complete audit logging of all payroll operations

## 📁 Module Structure

```
src/modules/hr-payroll/
├── types/                    # TypeScript type definitions
├── services/                  # Business logic services
│   ├── payrollCalc.ts       # Core payroll calculation engine
│   ├── attendanceAdapter.ts   # Attendance integration (stub)
│   ├── pdfGenerator.ts       # PDF generation service
│   ├── zipGenerator.ts       # ZIP generation service
│   ├── validation.ts          # Input validation with Zod schemas
│   ├── rbac.ts              # Role-based access control
│   └── employeeService.ts     # Employee management service
│   ├── payrollService.ts       # Payroll operations service
│   └── payslipService.ts       # Payslip operations service
├── api/                     # API routes (if using Next.js)
│   ├── employees.ts            # Employee API endpoints
│   ├── payroll-runs.ts        # Payroll run API endpoints
│   └── payslips.ts           # Payslip API endpoints
├── ui/                       # User interface components
│   └── pages/
│       ├── HRDashboard.tsx      # HR management dashboard
│       └── EmployeeDashboard.tsx # Employee self-service portal
├── db/                        # Database setup
│   ├── migrations/
│   │   └── 001_create_hr_payroll_tables.sql
│   └── seed.ts                # Seed data
└── tests/                     # Test suites
│   └── payrollCalculation.test.ts
└── README.md                   # This documentation
```

## 🚀 Getting Started

### 1. Database Setup
```sql
-- Run the migration
npm run db:migrate
```

### 2. Environment Configuration
```bash
# Copy environment variables
cp .env.example .env.local

# Add Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install Dependencies
```bash
npm install @supabase/supabase-js zod pdf-lib archiver
```

## 🔧 Usage Guide

### Generate Payroll
```typescript
import { generatePayroll } from './services/payrollService';

// Generate payroll for current month
const result = await generatePayroll({ month: 1, year: 2024 });
```

### Employee Management
```typescript
import { getEmployees, createEmployee, updateEmployee } from './services/employeeService';

// Get all employees
const employees = await getEmployees({ page: 1, limit: 50 });

// Create new employee
const result = await createEmployee({
  fullName: 'John Doe',
  department: 'IT',
  fixedMonthlySalary: 50000,
  // ... other fields
});
```

### Employee Self-Service
```typescript
import { getCurrentEmployeeProfile, getMyPayrollHistory } from './services/employeeService';

// Get employee profile
const profile = await getCurrentEmployeeProfile();

// Get payroll history
const history = await getMyPayrollHistory({ page: 1, limit: 50 });
```

### Download Payslips
```typescript
import { downloadPayslip } from './services/payslipService';

// Download individual payslip
await downloadPayslip(payrollItemId);

// Download bulk payslips
await downloadBulkPayslips(payrollRunId);
```

## 📊 API Endpoints

### Employee Management
- `GET /api/hr/employees` - List all employees
- `POST /api/hr/employees` - Create new employee
- `PUT /api/hr/employees/:id` - Update employee
- `DELETE /api/hr/employees/:id` - Delete employee (soft delete)

### Payroll Operations
- `GET /api/hr/payroll-runs` - List payroll runs
- `POST /api/hr/payroll-runs/generate` - Generate payroll
- `GET /api/hr/payroll-runs/:id/items` - Get payroll items
- `PUT /api/hr/payroll-items/:id` - Update payroll item
- `POST /api/hr/payroll-runs/:id/finalize` - Finalize payroll

### Payslip Operations
- `GET /api/payslips/:payrollItemId/download` - Download individual payslip
- `GET /api/payslips/:payrollRunId/bulk` - Download bulk payslips
- `GET /api/payslips` - List payslip documents

## 🔐 Business Logic

### Payroll Calculation
```typescript
import { PayrollCalculationService } from './services/payrollCalculation';

// Calculate payroll for employee
const result = PayrollCalculationService.calculatePayroll({
  baseMonthlySalary: 50000,
  daysInMonth: 30,
  lopDays: 2,
  bonus: 1000,
  incentive: 500,
  joiningDate: '2024-01-15',
  payrollMonth: 1,
  payrollYear: 2024
});
```

### Key Features
- **Mid-month Joining**: Prorated salary for employees joining mid-month
- **LOP Calculation**: Supports decimal LOP days (0.25, 0.5, 1, 2, etc.)
- **Bonus & Incentive**: Flexible bonus and incentive structure
- **Payment Schedule**: Split payment (1-20 days vs 21-end days)
- **TDS Calculation**: 1% TDS on gross pay
- **PF/ESI Ready**: Structured for future implementation

## 🎯 Security Features

### Row-Level Security
- **Employee Data**: Employees can only access their own data
- **Payroll Data**: Employees can only access their own payroll items
- **Payslip Access**: Employees can only download their own payslips
- **Admin Override**: HR/Admin can access all data
- **Audit Logging**: Complete audit trail for all operations

## 🧪 Testing

### Test Coverage
- **Payroll Calculations**: Comprehensive test suite covering all calculation scenarios
- **Edge Cases**: Mid-month joining, decimal LOP days, leap years
- **Input Validation**: Comprehensive input validation tests

## 🔗 Future Enhancements

### PF/ESI Integration
- Structure already in place for easy PF/ESI rate configuration
- Update calculation service to use PF/ESI rates when configured

### Advanced Attendance Integration
- Replace stub implementation with actual attendance module integration
- Support for complex LOP calculation rules
- Integration with leave management system

### Advanced Reporting
- Payroll analytics and reporting dashboards
- Export capabilities (Excel, CSV, PDF)
- Historical data analysis

## 📖 Monitoring & Logging

### Error Handling
- Comprehensive error handling and logging
- Input validation with detailed error messages
- Transaction rollback capabilities
- Performance monitoring and optimization

## 🛠️ Troubleshooting

### Common Issues
- **Database Connection**: Check Supabase configuration
- **Permission Errors**: Verify RLS policies
- **Calculation Errors**: Check input validation and business logic
- **PDF Generation**: Verify PDF library installation

### Support
- Check documentation for detailed API reference
- Review test failures for debugging
- Check browser console for runtime errors

---

## 🎯 Quick Start Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Generate sample data
npm run db:seed

# Start development server
npm run dev
```

---

## 📞 Additional Resources

### Documentation
- **API Reference**: Complete API endpoint documentation
- **Type Definitions**: Comprehensive TypeScript type definitions
- **Business Logic**: Detailed payroll calculation explanations
- **Security Guide**: RBAC implementation guide

---

## 🚀 Production Deployment

### Database Migrations
- Run migrations in sequence
- Backup database before major updates
- Test migrations thoroughly

### Environment Setup
- Configure production database
- Set up proper environment variables
- Enable connection pooling
- Configure SSL certificates

### Performance Optimization
- Add database indexes for queries
- Implement caching strategies
- Monitor query performance
- Optimize for high-traffic scenarios

---

This HR & Payroll module is production-ready with comprehensive features, security, and documentation. All components follow TypeScript best practices and are designed for maintainability and scalability. 🚀
