import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function PayrollManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Payroll Management</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Connect your Supabase project to manage payroll runs.
            Select month/year to generate, edit, finalize, or unlock payroll.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
