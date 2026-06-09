import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function MyPayslips() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">My Payslips</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Available Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Download your individual payslip PDFs from here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
