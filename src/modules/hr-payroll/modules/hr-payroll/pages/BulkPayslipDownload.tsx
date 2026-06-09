import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";

export default function BulkPayslipDownload() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Download className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Bulk Payslip Download</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Download All Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Select a finalized payroll run to download all payslips as a ZIP file.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
