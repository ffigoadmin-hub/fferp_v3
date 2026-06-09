import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";

export default function MySalaryHistory() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">My Salary History</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Monthly Salary Records</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your monthly earned, deductions, and net pay will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
