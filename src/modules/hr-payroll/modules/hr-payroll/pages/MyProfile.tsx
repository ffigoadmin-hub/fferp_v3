import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle } from "lucide-react";

export default function MyProfile() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCircle className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your profile details will appear here. Salary information is not displayed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
