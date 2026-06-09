import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PayrollManagementPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Payroll Management</h1>
        <p className="text-muted-foreground">Manage payroll processing and calculations</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Run Payroll</CardTitle>
            <CardDescription>Process monthly payroll for all employees</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Run Payroll</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Payroll Settings</CardTitle>
            <CardDescription>Configure payroll parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Settings</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Payroll History</CardTitle>
            <CardDescription>View previous payroll runs</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full">View History</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
