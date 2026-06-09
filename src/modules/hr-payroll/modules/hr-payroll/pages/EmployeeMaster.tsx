import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function EmployeeMaster() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Employee Master</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Connect your Supabase project to enable employee CRUD operations.
            This page will display a searchable, filterable data table of all employees.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
