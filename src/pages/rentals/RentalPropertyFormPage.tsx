import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Building, MapPin, CalendarDays, Wallet, BadgeIndianRupee, Users, Calculator, Plus, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RentalFormSection } from '@/components/rental/RentalFormSection';
import { RentalField } from '@/components/rental/RentalField';
import { useRentalAccess } from '@/hooks/useRentalAccess';
import { RentalRemarksDialog } from '@/components/rental/RentalRemarksDialog';
import { addYears, format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export default function RentalPropertyFormPage() {
    const { user } = useAuth();
    const { id } = useParams();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { access, isLoading: accessLoading } = useRentalAccess();

    const form = useForm({
        defaultValues: {
            title: '',
            location: '',
            category_id: '',
            agreement_sign_date: '',
            agreement_start_date: '', // Renamed to "Agreement Enforce Date" in UI
            agreement_expiry_date: '',
            monthly_base_rent: '',
            rent_due_day: '5',
            google_map_link: '',
            google_drive_folder_link: '',
            area: '',

            // Bank Details (Main Owner)
            holder_name: '',
            bank_name: '',
            branch_name: '',
            account_number: '',
            confirm_account_number: '',
            ifsc_code: '',
            account_type: 'Savings',
            upi_id: '',

            // Partners (Split Payment)
            partner_details: [] as { name: string; bank_name: string; account_number: string; ifsc: string; share_percent: number }[],

            // Commercial (Unified)
            owner_name: '',
            farm_name: '',
            phone_number: '',
            advance_amount: '',
            advance_paid_on: '',
            moratorium_period: '',
            quotation_amount: '',
            deduction_percentage: '',
            rent_starts_from: '',
            agreement_copy_link: '',
            rent_hike_enabled: false,
            rent_hike_percentage: '',
            rent_hike_interval_years: '1'
        }
    });

    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = form;
    const { fields, append, remove } = useFieldArray({
        control,
        name: "partner_details"
    });

    const watchedStartDate = watch('agreement_start_date');
    const watchedQuotation = watch('quotation_amount');
    const watchedDeductionPercent = watch('deduction_percentage');
    const watchedBaseRent = watch('monthly_base_rent');
    const watchedCategoryId = watch('category_id');

    // Auto-calculate Expiry Date (6 years)
    useEffect(() => {
        if (watchedStartDate) {
            const startDate = new Date(watchedStartDate);
            if (!isNaN(startDate.getTime())) {
                const expiryDate = addYears(startDate, 6);
                setValue('agreement_expiry_date', format(expiryDate, 'yyyy-MM-dd'));
            }
        }
    }, [watchedStartDate, setValue]);

    const { data: categories } = useQuery({
        queryKey: ['rental-categories-options'],
        queryFn: async () => {
            const { data, error } = await supabase.from('rental_categories').select('*').eq('status', 'Active');
            if (error) throw error;
            return data || [];
        }
    });

    // Determine if selected category is a JV Polyhouse
    const selectedCategoryName = categories?.find(c => c.id === watchedCategoryId)?.name || '';
    const isJvPolyhouse = selectedCategoryName.toLowerCase().includes('jv polyhouse');

    // Fetch existing property
    const { data: property } = useQuery({
        queryKey: ['rental-property', id],
        enabled: isEditMode,
        queryFn: async () => {
            const { data } = await supabase.from('rental_properties').select('*').eq('id', id).single();
            return data;
        }
    });

    useEffect(() => {
        if (property) {
            const formattedData = Object.assign({}, property) as any;
            // Format numbers/dates
            ['monthly_base_rent', 'advance_amount', 'quotation_amount', 'deduction_percentage', 'moratorium_period', 'rent_hike_percentage', 'rent_hike_interval_years'].forEach(key => {
                if (formattedData[key] !== null) formattedData[key] = String(formattedData[key]);
            });
            // Ensure boolean
            if (formattedData.rent_hike_enabled === null || formattedData.rent_hike_enabled === undefined) {
                formattedData.rent_hike_enabled = false;
            }

            // Handle Partner Details JSON
            if (!formattedData.partner_details || !Array.isArray(formattedData.partner_details)) {
                formattedData.partner_details = [];
            }

            form.reset(formattedData);
        }
    }, [property, form]);

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const formData = data as Record<string, any>;

            // Validate required UUID field
            if (!formData.category_id || formData.category_id === '') {
                throw new Error('Category is required. Please select a category.');
            }

            // Validate Partner Share Total
            const partners = formData.partner_details || [];
            if (partners.length > 0) {
                const shareSum = partners.reduce((sum: number, p: any) => sum + Number(p.share_percent), 0);
                // Assuming main owner takes the rest, or strictly validated?
                // Plan says: "Manual Split". The logic implies we just store details.
            }

            const payload = {
                ...formData,
                monthly_base_rent: Number(formData.monthly_base_rent),
                advance_amount: formData.advance_amount ? Number(formData.advance_amount) : 0,
                quotation_amount: formData.quotation_amount ? Number(formData.quotation_amount) : 0,
                deduction_percentage: formData.deduction_percentage ? Number(formData.deduction_percentage) : 0,
                moratorium_period: formData.moratorium_period ? Number(formData.moratorium_period) : 0,
                rent_due_day: Number(formData.rent_due_day),
                rent_hike_enabled: Boolean(formData.rent_hike_enabled),
                rent_hike_percentage: formData.rent_hike_percentage ? Number(formData.rent_hike_percentage) : 0,
                rent_hike_interval_years: formData.rent_hike_interval_years ? Number(formData.rent_hike_interval_years) : 1,
                advance_paid_on: formData.advance_paid_on || null,
                rent_starts_from: formData.rent_starts_from || null,
                // Ensure partner_details is a valid JSON array
                partner_details: formData.partner_details,
                agreement_sign_date: formData.agreement_sign_date || null,
                // Ensure category_id is valid UUID
                category_id: formData.category_id || null,
                created_by: user?.id || null, // Capture creator id
            };

            // Remove validation fields
            delete (payload as any).confirm_account_number;

            // Check for case-insensitive duplicate titles (excluding self in edit mode)
            const { data: existingProps, error: fetchError } = await (supabase as any)
                .from('rental_properties')
                .select('id, title');

            if (!fetchError && existingProps) {
                const isDuplicate = existingProps.some((p: any) =>
                    p.title?.trim()?.toLowerCase() === formData.title?.trim()?.toLowerCase() &&
                    p.id !== id
                );
                if (isDuplicate) {
                    throw new Error(`A property with the name "${formData.title}" already exists.`);
                }
            }

            if (isEditMode) {
                // Prevent overwriting the original creator during property updates
                delete (payload as any).created_by;
                const { error } = await (supabase as any).from('rental_properties').update(payload).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any).from('rental_properties').insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-properties'] });
            toast.success(isEditMode ? 'Property Updated' : 'Property Created');
            navigate(-1);
        },
        onError: (err) => toast.error(err.message)
    });

    const onSubmit = (data: any) => mutation.mutate(data);

    // Calculate Repayment details for display
    const calculateRepayment = () => {
        const rent = Number(watchedBaseRent) || 0;
        const quote = Number(watchedQuotation) || 0;
        const percent = Number(watchedDeductionPercent) || 0;
        if (!rent || !quote || !percent) return null;

        const monthlyDeduction = (rent * percent) / 100;
        const netPayable = rent - monthlyDeduction;
        const monthsToRepay = Math.ceil(quote / monthlyDeduction);

        return { monthlyDeduction, netPayable, monthsToRepay };
    };

    const repaymentInfo = calculateRepayment();

    if (accessLoading) return <div>Loading...</div>;

    // UNIFIED ACCESS: Show extended details for HR, RSH, Admin
    const showExtendedDetails = access?.isRSH || access?.isHR || access?.isAdmin;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="flex items-center justify-between sticky top-0 md:static bg-background/95 backdrop-blur z-10 py-4 border-b md:border-0">
                <div className="flex items-center gap-4">
                    <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">{isEditMode ? 'Edit Property' : 'New Rental Property'}</h1>
                        <p className="text-sm text-muted-foreground">Manage rental agreements, partners, and commercial details</p>
                    </div>
                </div>
                {/* Remarks Button */}
                {isEditMode && id && (
                    <div className="mr-2">
                        <RentalRemarksDialog propertyId={id} propertyTitle={watch('title')} />
                    </div>
                )}
                {!access?.isAdmin && isEditMode && property && !(property as any).edit_access_enabled ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-md border border-amber-200">
                        <span className="font-bold text-sm">Valid Editing Access Required</span>
                    </div>
                ) : (
                    <Button type="submit" size="lg" className="font-bold shadow-lg shadow-primary/20" disabled={mutation.isPending}>
                        <Save className="w-4 h-4 mr-2" /> {mutation.isPending ? 'Saving...' : 'Save Property'}
                    </Button>
                )}
            </div>

            {
                !access?.isAdmin && isEditMode && property && !(property as any).edit_access_enabled && (
                    <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg mb-6 text-destructive flex items-center justify-center font-bold">
                        This property is locked for editing. Please contact Admin/CEO to request changes.
                    </div>
                )
            }

            <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${(!access?.isAdmin && isEditMode && property && !(property as any).edit_access_enabled) ? 'pointer-events-none opacity-60' : ''}`}>

                {/* SECTION A: Basic Details */}
                <RentalFormSection title="Section A: Basic Details" icon={Building} className="xl:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <RentalField label="Category" required error={errors.category_id?.message as string}>
                            <Select
                                value={watch('category_id')}
                                onValueChange={(val) => setValue('category_id', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories?.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </RentalField>

                        <RentalField label="Property Title" required error={errors.title?.message as string}>
                            <Input placeholder="e.g. Polyhouse Agara" {...register('title', { required: 'Title is required' })} />
                        </RentalField>

                        <RentalField label="Google Map Link" className="md:col-span-1">
                            <Input placeholder="https://maps.google.com/..." {...register('google_map_link')} />
                        </RentalField>

                        <RentalField label="Location (City/Area)" required className="md:col-span-3" error={errors.location?.message as string}>
                            <Input placeholder="e.g. Agara, Bangalore" {...register('location', { required: 'Location is required' })} />
                        </RentalField>

                        <RentalField label="Agreement Sign Date" required error={errors.agreement_sign_date?.message as string}>
                            <Input type="date" {...register('agreement_sign_date', { required: 'Sign Date is required' })} />
                        </RentalField>

                        <RentalField label="Agreement Enforce Date (Start)" required error={errors.agreement_start_date?.message as string}>
                            <Input type="date" {...register('agreement_start_date', { required: 'Start Date is required' })} title="Date from which the agreement is legally enforceable" />
                        </RentalField>

                        <RentalField label="Agreement Expiry Date (Auto)" required>
                            <Input type="date" {...register('agreement_expiry_date', { required: 'Required' })} title="Auto-calculated (6 years)" readOnly className="bg-muted" />
                        </RentalField>

                        <RentalField label="Monthly Base Rent (₹)" required error={errors.monthly_base_rent?.message as string}>
                            <Input type="number" {...register('monthly_base_rent', { required: 'Required', min: 1 })} />
                        </RentalField>

                        <RentalField label="Rent Due Date" required>
                            <Select
                                value={String(watch('rent_due_day'))}
                                onValueChange={(val) => setValue('rent_due_day', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                        <SelectItem key={day} value={String(day)}>{day} of every month</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </RentalField>

                        <RentalField label="Drive Folder Link (Optional)" className="md:col-span-2">
                            <Input placeholder="https://drive.google.com/..." {...register('google_drive_folder_link')} />
                        </RentalField>
                    </div>
                </RentalFormSection>

                {/* SECTION B: Property Area (UNIFIED) */}
                {isJvPolyhouse && (
                    <RentalFormSection title="Section B: Property Area" icon={MapPin}>
                        <RentalField label="Area Size" required error={errors.area?.message as string}>
                            <Input placeholder="e.g. 2000 sq.ft or 45 Acres" {...register('area', { required: 'Required for JV Polyhouse' })} />
                        </RentalField>
                    </RentalFormSection>
                )}

                {/* SECTION C: Bank / Payee Details */}
                <RentalFormSection title="Section C: Bank Details (Main)" icon={Wallet}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <RentalField label="Account Holder Name" required error={errors.holder_name?.message as string}>
                            <Input placeholder="Name as per Bank" {...register('holder_name', { required: 'Required' })} />
                        </RentalField>
                        <RentalField label="Bank Name" required error={errors.bank_name?.message as string}>
                            <Input placeholder="Bank Name" {...register('bank_name', { required: 'Required' })} />
                        </RentalField>
                        <RentalField label="Account Number" required error={errors.account_number?.message as string}>
                            <Input placeholder="Account No" {...register('account_number', { required: 'Required' })} autoComplete="off" />
                        </RentalField>
                        <RentalField label="Confirm Account Number" required error={errors.confirm_account_number?.message as string}>
                            <Input placeholder="Re-enter Account No" {...register('confirm_account_number', {
                                required: 'Required',
                                validate: (val) => val === watch('account_number') || 'Account numbers do not match'
                            })} autoComplete="off" />
                        </RentalField>
                        <RentalField label="IFSC Code" required error={errors.ifsc_code?.message as string}>
                            <Input 
                                placeholder="e.g. SBIN0001234" 
                                className="uppercase" 
                                {...register('ifsc_code', { 
                                    required: 'IFSC Code is required',
                                    pattern: {
                                        value: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                                        message: 'Invalid IFSC format. Must be 4 letters + 0 + 6 alphanumeric (e.g. SBIN0001234)'
                                    },
                                    setValueAs: (v: string) => v?.toUpperCase()?.trim()
                                })} 
                            />
                        </RentalField>
                    </div>
                </RentalFormSection>

                {/* PARTNERS (Split Payment) */}
                <RentalFormSection title={`Split Payments (${fields.length} Partners)`} icon={Users} className="xl:col-span-2">
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/20 relative">
                                <div className="md:col-span-1">
                                    <Input placeholder="Partner Name" {...register(`partner_details.${index}.name` as const, { required: true })} />
                                </div>
                                <div className="md:col-span-1">
                                    <Input placeholder="Bank Name" {...register(`partner_details.${index}.bank_name` as const, { required: true })} />
                                </div>
                                <div className="md:col-span-1">
                                    <Input placeholder="Account No" {...register(`partner_details.${index}.account_number` as const, { required: true })} />
                                </div>
                                <div className="md:col-span-1">
                                    <Input placeholder="IFSC (e.g. SBIN0001234)" className="uppercase" {...register(`partner_details.${index}.ifsc` as const, { 
                                        required: true,
                                        pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                                        setValueAs: (v: string) => v?.toUpperCase()?.trim()
                                    })} />
                                </div>
                                <div className="md:col-span-1 flex items-center gap-2">
                                    <Input type="number" placeholder="Share %" {...register(`partner_details.${index}.share_percent` as const, { required: true, min: 1, max: 100 })} />
                                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button type="button" variant="outline" onClick={() => append({ name: '', bank_name: '', account_number: '', ifsc: '', share_percent: 0 })}>
                            <Plus className="w-4 h-4 mr-2" /> Add Partner
                        </Button>
                    </div>
                </RentalFormSection>

                {/* SECTION D: Commercial / Quotation (Unified) */}
                {showExtendedDetails && (
                    <RentalFormSection title="Section D: Commercial Details" icon={BadgeIndianRupee} className="xl:col-span-2 bg-gradient-to-br from-card to-emerald-500/5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <RentalField label="Owner Name" required error={errors.owner_name?.message as string}>
                                <Input {...register('owner_name', { required: 'Required' })} />
                            </RentalField>

                            <RentalField label="Farm Name" required error={errors.farm_name?.message as string}>
                                <Input {...register('farm_name', { required: 'Required' })} />
                            </RentalField>

                            <RentalField label="Phone Number" required error={errors.phone_number?.message as string}>
                                <Input type="tel" {...register('phone_number', { required: 'Required' })} />
                            </RentalField>

                            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 border border-dashed border-emerald-500/30 rounded-lg bg-emerald-50/10">
                                <div className="md:col-span-4 flex items-center gap-2 text-emerald-600 font-semibold border-b pb-2">
                                    <Calculator className="w-4 h-4" /> Quotation Repayment Calculator
                                </div>

                                <RentalField label="Quotation Amount (₹)">
                                    <Input type="number" {...register('quotation_amount')} placeholder="e.g. 3000000" />
                                </RentalField>

                                <RentalField label="Rent Deduction %">
                                    <Input type="number" {...register('deduction_percentage')} placeholder="e.g. 50" max="100" />
                                </RentalField>

                                {/* Live Calc Display */}
                                {repaymentInfo && (
                                    <div className="md:col-span-2 grid grid-cols-2 gap-4 text-sm bg-background p-3 rounded border">
                                        <div>
                                            <p className="text-muted-foreground">Monthly Deduction</p>
                                            <p className="font-bold text-destructive">₹{repaymentInfo.monthlyDeduction.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Net Pay to Owners</p>
                                            <p className="font-bold text-emerald-600">₹{repaymentInfo.netPayable.toLocaleString()}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground">Est. Repayment Period</p>
                                            <p className="font-bold">{repaymentInfo.monthsToRepay} Months ({(repaymentInfo.monthsToRepay / 12).toFixed(1)} Years)</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <RentalField label="Advance Amount (₹)">
                                <Input type="number" {...register('advance_amount')} />
                            </RentalField>

                            <RentalField label="Advance Paid On">
                                <Input type="date" {...register('advance_paid_on')} />
                            </RentalField>

                            <RentalField label="Moratorium Period (Months)">
                                <Input type="number" {...register('moratorium_period')} placeholder="e.g. 3" min="0" />
                            </RentalField>

                            <RentalField label="Rent Starts From" required error={errors.rent_starts_from?.message as string}>
                                <Input type="date" {...register('rent_starts_from', { required: 'Required' })} />
                            </RentalField>

                            <RentalField label="Agreement Copy Link" required className="md:col-span-3" error={errors.agreement_copy_link?.message as string}>
                                <Input placeholder="Link to Agreement PDF" {...register('agreement_copy_link', { required: 'Required' })} />
                            </RentalField>

                            <div className="md:col-span-3 border-t pt-4 mt-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex items-center space-x-2">
                                        <Input
                                            type="checkbox"
                                            id="rent_hike_enabled"
                                            className="w-4 h-4"
                                            {...register('rent_hike_enabled')}
                                        />
                                        <label
                                            htmlFor="rent_hike_enabled"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            Enable Periodic Rent Hike
                                        </label>
                                    </div>
                                </div>

                                {watch('rent_hike_enabled') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <RentalField label="Hike Percentage (%)">
                                            <Input type="number" {...register('rent_hike_percentage')} placeholder="e.g. 5" />
                                        </RentalField>
                                        <RentalField label="Hike Interval (Years)">
                                            <Input type="number" {...register('rent_hike_interval_years')} placeholder="e.g. 1" />
                                        </RentalField>
                                    </div>
                                )}
                            </div>
                        </div>
                    </RentalFormSection>
                )}

            </div>
        </form >
    );
}
