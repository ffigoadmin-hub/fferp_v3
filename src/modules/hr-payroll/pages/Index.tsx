import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-8 text-4xl font-bold">HR & Payroll Module</h1>
        <div className="space-y-4">
          <Link 
            to="/hr/employee-master" 
            className="block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Employee Master
          </Link>
          <Link 
            to="/hr/payroll" 
            className="block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Payroll Management
          </Link>
          <Link 
            to="/hr/sheet" 
            className="block px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Salary Sheet
          </Link>
          <Link 
            to="/hr/approval" 
            className="block px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Salary Approval
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
