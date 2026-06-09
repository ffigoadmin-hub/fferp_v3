import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SalarySlipsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Salary Slips</h1>
        <p className="text-muted-foreground">Generate and manage salary slips</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Generate Salary Slips</CardTitle>
            <CardDescription>Create salary slips for current month</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Generate Now</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Bulk Generation</CardTitle>
            <CardDescription>Generate for multiple employees</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Bulk Generate</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>View Generated</CardTitle>
            <CardDescription>View all generated salary slips</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full">View All</Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Download Reports</CardTitle>
            <CardDescription>Export salary slip reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Download Report</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
