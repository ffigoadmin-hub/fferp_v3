/**
 * NewUserPage Component
 * 
 * HR page for submitting new employee onboarding requests
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, UserPlus, Loader2, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitNewUserRequest, validateResumeFile, isValidEmail, isValidFullName } from '../services/onboardingService';
import { DEPARTMENTS, type NewUserFormData, type Department } from '../types/onboarding.types';
import { DEPARTMENTS as ALL_DEPARTMENTS } from '@/constants/departments';

export function NewUserPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<NewUserFormData>({
    fullName: '',
    email: '',
    department: '' as Department,
    resume: null,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);

  const { data: dbDepartments = [] } = useQuery({
    queryKey: ['onboarding-new-user-departments'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('departments')
        .select('name, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.warn('Failed to load departments from DB, using fallback list:', error.message);
        return [] as string[];
      }

      return (data || []).map((d: any) => String(d.name));
    },
  });

  const fallbackDepartments = Array.from(
    new Set([...DEPARTMENTS, ...ALL_DEPARTMENTS.map((d) => d.value)])
  ).sort((a, b) => a.localeCompare(b));

  const departmentOptions = dbDepartments.length > 0 ? dbDepartments : fallbackDepartments;

  const handleInputChange = (field: keyof NewUserFormData, value: string | File | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (file) {
      const validation = validateResumeFile(file);
      if (!validation.valid) {
        toast({
          title: 'Invalid File',
          description: validation.error,
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }
      
      setResumeFileName(file.name);
      handleInputChange('resume', file);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      toast({ title: 'Error', description: 'Full name is required', variant: 'destructive' });
      return false;
    }
    
    if (!isValidFullName(formData.fullName)) {
      toast({ title: 'Error', description: 'Please enter a valid full name', variant: 'destructive' });
      return false;
    }
    
    if (!formData.email.trim()) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return false;
    }
    
    if (!isValidEmail(formData.email)) {
      toast({ title: 'Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return false;
    }
    
    if (!formData.department) {
      toast({ title: 'Error', description: 'Department is required', variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const result = await submitNewUserRequest(formData);
      
      if (result.success) {
        toast({
          title: 'Success!',
          description: `Onboarding request for ${formData.fullName} has been submitted for CEO review.`,
        });
        
        // Reset form
        setFormData({ fullName: '', email: '', department: '' as Department, resume: null });
        setResumeFileName(null);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>New Employee Onboarding</CardTitle>
              <CardDescription>
                Submit a new employee for CEO review and approval
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="Enter candidate's full name"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="candidate@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value) => handleInputChange('department', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent className="max-h-72 overflow-y-auto z-[120]">
                  {departmentOptions.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resume Upload */}
            <div className="space-y-2">
              <Label htmlFor="resume">
                Resume / CV <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-4">
                <Label
                  htmlFor="resume"
                  className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {resumeFileName || 'Choose file...'}
                </Label>
                <input
                  id="resume"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="hidden"
                />
                {resumeFileName && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>File ready</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, DOC, DOCX, JPG, PNG (max 5MB)
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Submit for CEO Review
                  </>
                )}
              </Button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">Workflow:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>HR submits candidate details</li>
                <li>CEO reviews and selects/rejects</li>
                <li>Admin generates credentials and sends email</li>
                <li>Candidate receives login credentials</li>
              </ol>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default NewUserPage;
