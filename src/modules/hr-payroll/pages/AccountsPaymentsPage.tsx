import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AccountsPaymentsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Accounts Payments</h1>
        <p className="text-muted-foreground">Process and manage payroll payments</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Process Payroll</CardTitle>
            <CardDescription>Execute monthly payroll processing</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Process Now</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>View all processed payments</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View History</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Bank Reconciliation</CardTitle>
            <CardDescription>Reconcile bank transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full">Reconcile</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
