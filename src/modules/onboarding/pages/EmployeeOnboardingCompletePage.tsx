import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { getOnboardingByToken, submitEmployeeOnboardingDetails } from '../services/prejoiningOnboardingService';
import type { EmployeeOnboardingRequest, EmployeeOnboardingFormData } from '../types/prejoining.types';

export default function EmployeeOnboardingCompletePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [onboarding, setOnboarding] = useState<EmployeeOnboardingRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [contactNumber, setContactNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [parentsNumber, setParentsNumber] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  
  // Document files
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [passbookFile, setPassbookFile] = useState<File | null>(null);
  const [marksheet10File, setMarksheet10File] = useState<File | null>(null);
  const [marksheet12File, setMarksheet12File] = useState<File | null>(null);
  const [degreeFile, setDegreeFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [hrPolicyFile, setHrPolicyFile] = useState<File | null>(null);
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  
  // Acknowledgements
  const [hrPolicyAccepted, setHrPolicyAccepted] = useState(false);
  const [offerLetterAccepted, setOfferLetterAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid onboarding link. No token provided.');
      setLoading(false);
      return;
    }

    loadOnboarding();
  }, [token]);

  const loadOnboarding = async () => {
    try {
      const result = await getOnboardingByToken(token!);
      
      if (result.success && result.data) {
        setOnboarding(result.data);
      } else {
        setError(result.error || 'Failed to load onboarding details');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File | null>>
  ) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive',
        });
        return;
      }
      setter(file);
    }
  };

  const validateForm = (): boolean => {
    if (!contactNumber.trim()) {
      toast({ title: 'Missing Field', description: 'Contact number is required', variant: 'destructive' });
      return false;
    }
    if (!emergencyContact.trim()) {
      toast({ title: 'Missing Field', description: 'Emergency contact number is required', variant: 'destructive' });
      return false;
    }
    if (!parentsNumber.trim()) {
      toast({ title: 'Missing Field', description: 'Parents number is required', variant: 'destructive' });
      return false;
    }
    if (!permanentAddress.trim()) {
      toast({ title: 'Missing Field', description: 'Permanent address is required', variant: 'destructive' });
      return false;
    }
    if (!aadhaarFile && !onboarding?.aadhaar_url) {
      toast({ title: 'Missing Document', description: 'Aadhaar card is required', variant: 'destructive' });
      return false;
    }
    if (!passbookFile && !onboarding?.passbook_url) {
      toast({ title: 'Missing Document', description: 'Passbook is required', variant: 'destructive' });
      return false;
    }
    if (!photoFile && !onboarding?.photo_url) {
      toast({ title: 'Missing Document', description: 'Photo is required', variant: 'destructive' });
      return false;
    }
    if (!hrPolicyAccepted) {
      toast({ title: 'Acknowledgement Required', description: 'Please acknowledge HR Policy', variant: 'destructive' });
      return false;
    }
    if (!offerLetterAccepted) {
      toast({ title: 'Acknowledgement Required', description: 'Please acknowledge Offer Letter', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!onboarding) return;

    setSubmitting(true);

    try {
      const formData: EmployeeOnboardingFormData = {
        fullName: onboarding.full_name,
        email: onboarding.email,
        department: onboarding.department,
        contactNumber,
        emergencyContactNumber: emergencyContact,
        parentsNumber,
        permanentAddress,
        currentAddress,
        aadhaarFile,
        passbookFile,
        marksheet10File,
        marksheet12File,
        degreeMarksheetFile: degreeFile,
        resumeFile,
        photoFile,
        hrPolicyFile,
        offerLetterFile,
        hrPolicyAccepted,
        offerLetterAccepted,
      };

      const result = await submitEmployeeOnboardingDetails(token!, formData);

      if (result.success) {
        toast({
          title: 'Submitted Successfully',
          description: 'Your onboarding details have been submitted for HR verification.',
        });
        setOnboarding({ ...onboarding, status: 'details_submitted' });
      } else {
        toast({
          title: 'Submission Failed',
          description: result.error || 'Failed to submit details',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <Card className="bg-[#1a1a1a] border-gray-800 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
            <p className="text-gray-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!onboarding) return null;

  // Show success message if already submitted
  if (onboarding.status === 'details_submitted' || onboarding.status === 'hr_verified' || onboarding.status === 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <Card className="bg-[#1a1a1a] border-gray-800 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Onboarding Submitted</h2>
            <p className="text-gray-400 mb-4">
              {onboarding.status === 'details_submitted' 
                ? 'Your details have been submitted and are under HR verification.'
                : onboarding.status === 'hr_verified' || onboarding.status === 'active'
                ? 'Your onboarding has been verified. You can now login to ERP.'
                : ''}
            </p>
            {onboarding.generated_username && (
              <div className="bg-[#0f0f0f] rounded p-3 text-left">
                <p className="text-sm text-gray-400">Your Username:</p>
                <p className="text-green-400 font-mono">{onboarding.generated_username}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Complete Your Onboarding</h1>
          <p className="text-gray-400">Please fill all required details and upload documents</p>
        </div>

        {/* Basic Info Card */}
        <Card className="bg-[#1a1a1a] border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Basic Information</CardTitle>
            <CardDescription className="text-gray-400">Read-only details from your invitation</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-400 text-sm">Full Name</Label>
              <p className="text-white font-medium">{onboarding.full_name}</p>
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Email</Label>
              <p className="text-white font-medium">{onboarding.email}</p>
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Department</Label>
              <p className="text-white font-medium">{onboarding.department}</p>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Details */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-gray-300">
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactNumber"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="Your phone number"
                  className="bg-[#0f0f0f] border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContact" className="text-gray-300">
                  Emergency Contact <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="emergencyContact"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Emergency contact number"
                  className="bg-[#0f0f0f] border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentsNumber" className="text-gray-300">
                  Parents Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="parentsNumber"
                  value={parentsNumber}
                  onChange={(e) => setParentsNumber(e.target.value)}
                  placeholder="Parents phone number"
                  className="bg-[#0f0f0f] border-gray-700 text-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Address Details */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Address Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="permanentAddress" className="text-gray-300">
                  Permanent Address <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="permanentAddress"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="Your permanent address"
                  rows={3}
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentAddress" className="text-gray-300">
                  Current Address
                </Label>
                <textarea
                  id="currentAddress"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  placeholder="Your current address (if different)"
                  rows={3}
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Document Uploads */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Document Uploads</CardTitle>
              <CardDescription className="text-gray-400">
                Upload clear scanned copies (PDF, JPG, PNG - max 10MB each)
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { id: 'aadhaar', label: 'Aadhaar Card *', file: aadhaarFile, setter: setAadhaarFile, required: true },
                { id: 'passbook', label: 'Passbook *', file: passbookFile, setter: setPassbookFile, required: true },
                { id: 'marksheet10', label: '10th Marksheet', file: marksheet10File, setter: setMarksheet10File, required: false },
                { id: 'marksheet12', label: '12th Marksheet', file: marksheet12File, setter: setMarksheet12File, required: false },
                { id: 'degree', label: 'Degree Marksheet', file: degreeFile, setter: setDegreeFile, required: false },
                { id: 'resume', label: 'Resume/CV', file: resumeFile, setter: setResumeFile, required: false },
                { id: 'photo', label: 'Passport Photo *', file: photoFile, setter: setPhotoFile, required: true },
              ].map((doc) => (
                <div key={doc.id} className="space-y-2">
                  <Label className="text-gray-300 text-sm">{doc.label}</Label>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={doc.id}
                      className="flex-1 flex items-center gap-2 px-3 py-2 bg-[#0f0f0f] border border-gray-700 rounded cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400 truncate">
                        {doc.file?.name || onboarding[`${doc.id}_url` as keyof EmployeeOnboardingRequest] 
                          ? 'File attached' 
                          : 'Choose file...'}
                      </span>
                    </Label>
                    <input
                      id={doc.id}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange(e, doc.setter)}
                      className="hidden"
                    />
                    {doc.file && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* HR Policy & Offer Letter */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">HR Policy & Offer Letter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">HR Policy Document</Label>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="hrPolicy"
                      className="flex-1 flex items-center gap-2 px-3 py-2 bg-[#0f0f0f] border border-gray-700 rounded cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400 truncate">
                        {hrPolicyFile?.name || 'Upload HR Policy...'}
                      </span>
                    </Label>
                    <input
                      id="hrPolicy"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, setHrPolicyFile)}
                      className="hidden"
                    />
                  </div>
                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox
                      id="hrPolicyAccepted"
                      checked={hrPolicyAccepted}
                      onCheckedChange={(checked) => setHrPolicyAccepted(checked as boolean)}
                    />
                    <Label htmlFor="hrPolicyAccepted" className="text-sm text-gray-400 cursor-pointer">
                      I have read and agree to the HR Policy *
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm">Offer Letter</Label>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="offerLetter"
                      className="flex-1 flex items-center gap-2 px-3 py-2 bg-[#0f0f0f] border border-gray-700 rounded cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400 truncate">
                        {offerLetterFile?.name || 'Upload Offer Letter...'}
                      </span>
                    </Label>
                    <input
                      id="offerLetter"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, setOfferLetterFile)}
                      className="hidden"
                    />
                  </div>
                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox
                      id="offerLetterAccepted"
                      checked={offerLetterAccepted}
                      onCheckedChange={(checked) => setOfferLetterAccepted(checked as boolean)}
                    />
                    <Label htmlFor="offerLetterAccepted" className="text-sm text-gray-400 cursor-pointer">
                      I have read and accept the Offer Letter *
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Onboarding Details
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
