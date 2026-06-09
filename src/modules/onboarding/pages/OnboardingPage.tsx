import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Eye, ArrowLeft } from 'lucide-react';
import { getOnboardingByToken, submitOnboardingDocuments } from '../services/onboardingService';
import type { OnboardingRequest } from '../types/onboarding.types';
import { checkAndRedirectDomain } from '@/config/appConfig';

export default function OnboardingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for SSL/domain issues and redirect if needed
  useEffect(() => {
    // Check if we're on a problematic domain and redirect to safe domain
    const isRedirecting = checkAndRedirectDomain();
    if (isRedirecting) {
      return; // Page will redirect, stop further loading
    }
  }, []);

  // Personal details form state
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

  // Preview URLs
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    console.log('[OnboardingPage] Component mounted');
    console.log('[OnboardingPage] Current URL:', window.location.href);
    console.log('[OnboardingPage] Token from URL:', token);
    
    if (!token) {
      console.error('[OnboardingPage] No token provided in URL');
      setError('Invalid onboarding link. No token provided. Please check your email link or contact HR.');
      setLoading(false);
      return;
    }

    console.log('[OnboardingPage] Starting token validation...');
    validateToken();
  }, [token]);

  const validateToken = async () => {
    console.log('[OnboardingPage] validateToken() called with token:', token?.substring(0, 10) + '...');
    
    try {
      console.log('[OnboardingPage] Calling getOnboardingByToken...');
      const result = await getOnboardingByToken(token!);
      console.log('[OnboardingPage] getOnboardingByToken result:', result);

      if (result.success && result.data) {
        console.log('[OnboardingPage] Token valid, onboarding data:', {
          id: result.data.id,
          status: result.data.status,
          email: result.data.email,
          full_name: result.data.full_name,
        });
        
        setOnboarding(result.data);

        // Check if already submitted or completed
        const completedStatuses = ['documents_submitted', 'hr_verified', 'active', 'admin_completed'];
        if (completedStatuses.includes(result.data.status)) {
          console.log('[OnboardingPage] Onboarding already completed with status:', result.data.status);
          setError('Your onboarding has already been submitted. Please contact HR if you need to make changes.');
        }
      } else {
        console.error('[OnboardingPage] Token validation failed:', result.error);
        setError(result.error || 'Invalid or expired onboarding link. Please contact HR for assistance.');
      }
    } catch (err) {
      console.error('[OnboardingPage] Unexpected error in validateToken:', err);
      setError('An unexpected error occurred. Please try again later or contact HR.');
    } finally {
      console.log('[OnboardingPage] Token validation complete, setting loading to false');
      setLoading(false);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File | null>>,
    fieldName: string
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

      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrls(prev => ({ ...prev, [fieldName]: url }));
      }
    }
  };

  const validateForm = (): boolean => {
    // Personal details validation
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

    // Documents validation
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

    // Acknowledgements validation
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
    console.log('[OnboardingPage] Form submission started');

    if (!validateForm()) {
      console.log('[OnboardingPage] Form validation failed');
      return;
    }
    
    if (!onboarding || !token) {
      console.error('[OnboardingPage] Missing onboarding data or token');
      toast({
        title: 'Error',
        description: 'Missing required information. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }

    console.log('[OnboardingPage] Preparing documents for submission...');
    setSubmitting(true);

    try {
      const documents: any = {
        contactNumber,
        emergencyContactNumber: emergencyContact,
        parentsNumber,
        permanentAddress,
        currentAddress: currentAddress || permanentAddress,
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

      console.log('[OnboardingPage] Calling submitOnboardingDocuments...');
      const result = await submitOnboardingDocuments(token, documents);
      console.log('[OnboardingPage] Submission result:', result);

      if (result.success) {
        console.log('[OnboardingPage] Submission successful');
        toast({
          title: 'Submitted Successfully',
          description: 'Your onboarding details have been submitted for HR verification.',
        });
        setOnboarding({ ...onboarding, status: 'documents_submitted' });
      } else {
        console.error('[OnboardingPage] Submission failed:', result.error);
        toast({
          title: 'Submission Failed',
          description: result.error || 'Failed to submit details. Please try again or contact HR.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('[OnboardingPage] Unexpected error during submission:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again or contact HR.',
        variant: 'destructive',
      });
    } finally {
      console.log('[OnboardingPage] Submission complete, setting submitting to false');
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
            <h2 className="text-xl font-semibold text-white mb-2">Link Expired or Invalid</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              Please contact HR to request a new onboarding link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!onboarding) return null;

  // Show success message if already submitted
  if (onboarding.status === 'documents_submitted' || onboarding.status === 'hr_verified' || onboarding.status === 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <Card className="bg-[#1a1a1a] border-gray-800 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Onboarding Submitted</h2>
            <p className="text-gray-400 mb-4">
              {onboarding.status === 'documents_submitted'
                ? 'Your details have been submitted and are under HR verification.'
                : 'Your onboarding has been verified. You can now login to the system.'}
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
                  placeholder="Your current address (if different from permanent)"
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
                { id: 'aadhaar', label: 'Aadhaar Card *', file: aadhaarFile, setter: setAadhaarFile, required: true, existing: onboarding.aadhaar_url },
                { id: 'passbook', label: 'Passbook *', file: passbookFile, setter: setPassbookFile, required: true, existing: onboarding.passbook_url },
                { id: 'marksheet10', label: '10th Marksheet', file: marksheet10File, setter: setMarksheet10File, required: false, existing: onboarding.marksheet_10_url },
                { id: 'marksheet12', label: '12th Marksheet', file: marksheet12File, setter: setMarksheet12File, required: false, existing: onboarding.marksheet_12_url },
                { id: 'degree', label: 'Degree Marksheet', file: degreeFile, setter: setDegreeFile, required: false, existing: onboarding.degree_marksheet_url },
                { id: 'resume', label: 'Resume/CV', file: resumeFile, setter: setResumeFile, required: false, existing: onboarding.resume_url },
                { id: 'photo', label: 'Passport Photo *', file: photoFile, setter: setPhotoFile, required: true, existing: onboarding.photo_url },
                { id: 'hrPolicy', label: 'HR Policy (Signed)', file: hrPolicyFile, setter: setHrPolicyFile, required: false, existing: onboarding.hr_policy_url },
                { id: 'offerLetter', label: 'Offer Letter (Signed)', file: offerLetterFile, setter: setOfferLetterFile, required: false, existing: onboarding.offer_letter_url },
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
                        {doc.file?.name || (doc.existing ? 'File attached' : 'Choose file...')}
                      </span>
                    </Label>
                    <input
                      id={doc.id}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange(e, doc.setter, doc.id)}
                      className="hidden"
                    />
                    {doc.file && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {doc.existing && !doc.file && (
                      <Eye className="w-4 h-4 text-blue-500 cursor-pointer" onClick={() => window.open(doc.existing!, '_blank')} />
                    )}
                  </div>
                  {previewUrls[doc.id] && (
                    <img src={previewUrls[doc.id]} alt="Preview" className="w-16 h-16 object-cover rounded mt-2" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Acknowledgements */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Acknowledgements</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="hrPolicyAccepted"
                    checked={hrPolicyAccepted}
                    onCheckedChange={(checked) => setHrPolicyAccepted(checked as boolean)}
                  />
                  <div>
                    <Label htmlFor="hrPolicyAccepted" className="text-sm text-gray-300 cursor-pointer">
                      I have read and agree to the HR Policy <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      By checking this box, you acknowledge that you have read, understood, and agree to comply with all HR policies and procedures.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="offerLetterAccepted"
                    checked={offerLetterAccepted}
                    onCheckedChange={(checked) => setOfferLetterAccepted(checked as boolean)}
                  />
                  <div>
                    <Label htmlFor="offerLetterAccepted" className="text-sm text-gray-300 cursor-pointer">
                      I have read and accept the Offer Letter <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      By checking this box, you acknowledge that you have received, read, understood, and accept the terms of your offer letter.
                    </p>
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
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
