import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function RoleManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Role Management</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>User Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Assign admin, hr, or employee roles to registered users.
            Connect your Supabase project to manage roles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
