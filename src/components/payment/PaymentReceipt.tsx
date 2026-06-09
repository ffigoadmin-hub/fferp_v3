import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, IndianRupee, Printer, Download, X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import igoLogo from '@/assets/igo-logo.png';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface PaymentReceiptProps {
    isOpen: boolean;
    onClose: () => void;
    payment: {
        id: string;
        payment_number: number;
        vendor_name: string;
        amount: number;
        purpose: string;
        created_at: string;
        paid_at: string;
        utr_number?: string;
        requester_name: string;
        department: string;
        is_split_payment?: boolean;
        splits?: any[];
        bank_name?: string | null;
        account_number?: string | null;
        ifsc_code?: string | null;
    };
}

export function PaymentReceipt({ isOpen, onClose, payment }: PaymentReceiptProps) {
    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById('receipt-content');
        if (!element) return;
        const { default: html2pdf } = await import('html2pdf.js');

        // Custom options for html2pdf to ensure high quality and perfect alignment
        const opt: any = {
            margin: [0, 0],
            filename: `IGO_Voucher_${payment.payment_number || '00000'}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: {
                scale: 4, // Increased scale for maximum sharpness
                useCORS: true,
                letterRendering: false, // Turned off to prevent font artifacts
                logging: false,
                windowWidth: 1000, // Fixed width for consistent rendering
                onclone: (documentClone: any) => {
                    // Force Light Mode for the PDF to ensure clean white background and dark text
                    // This is the most reliable way to prevent dark mode artifacts in prints
                    documentClone.documentElement.classList.remove('dark');

                    // Standardize dimensions for capture
                    const receiptContent = documentClone.getElementById('receipt-content');
                    if (receiptContent) {
                        receiptContent.style.width = '1000px';
                        receiptContent.style.padding = '40px';
                        receiptContent.style.backgroundColor = '#ffffff';
                    }

                    // Enforce basic clean border for Receipt Ref Box
                    const receiptRefBox = documentClone.querySelector('.receipt-ref-box');
                    if (receiptRefBox) {
                        receiptRefBox.style.setProperty('border', '2px solid #000000', 'important');
                    }

                    // Standardize watermark for PDF
                    const watermark = documentClone.querySelector('.status-watermark');
                    if (watermark) {
                        watermark.style.opacity = '0.04';
                        watermark.style.transform = 'translate(-50%, -50%) rotate(-35deg) scale(0.9)';
                    }
                }
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            }
        };

        // Standard html2pdf execution
        (html2pdf() as any).from(element).set(opt).save();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none bg-white dark:bg-slate-950 shadow-2xl">
                <div className="p-8 md:p-12 relative" id="receipt-content">
                    {/* Print Preview Header (Hidden in Print) */}
                    <div className="flex justify-between items-center mb-8 print:hidden">
                        <DialogTitle className="text-xl font-black flex items-center gap-3 text-slate-900 dark:text-slate-100 uppercase tracking-tighter">
                            <div className="bg-emerald-500 p-1.5 rounded-lg text-white">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            Official Payment Voucher
                        </DialogTitle>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* The Actual Receipt Card */}
                    <div className="bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl relative print:border-none print:shadow-none min-h-[600px] flex flex-col">

                        {/* Status Watermark */}
                        <div className="status-watermark absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none rotate-[-35deg] select-none z-0">
                            <h2 className="text-[180px] font-black uppercase text-emerald-900 dark:text-emerald-100 tracking-widest">PAID</h2>
                        </div>

                        {/* Top Accent Bar */}
                        <div className="h-2.5 bg-gradient-to-r from-emerald-400 via-emerald-600 to-emerald-800" />

                        <div className="p-10 space-y-10 flex-1 relative z-10">
                            {/* Header Section */}
                            <div className="flex justify-between items-start gap-6">
                                <div className="flex items-center gap-5">
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                                        <img src={igoLogo} alt="IGO GROUP" className="h-16 w-auto object-contain" />
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">IGO GROUP</h2>
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] font-black">
                                            India's Leading Farming Conglomerate
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="receipt-ref-box bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl shadow-sm inline-block border-2 border-slate-900 dark:border-emerald-500">
                                        <p className="text-[10px] text-slate-500 dark:text-emerald-400 uppercase font-black tracking-widest mb-1">Receipt Ref</p>
                                        <p className="text-xl font-mono font-black text-slate-900 dark:text-white">
                                            #{String(payment.payment_number || 0).padStart(5, '0')}
                                        </p>
                                    </div>
                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-3 uppercase font-black tracking-tighter whitespace-nowrap">
                                        Timestamp: {format(new Date(), 'PPpp')}
                                    </p>
                                </div>
                            </div>

                            {/* Main Transaction Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-10 border-y-2 border-slate-50 dark:border-slate-800/50 border-dashed">
                                <div className="space-y-8">
                                    <div className="space-y-1.5">
                                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Beneficiary Name</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{payment.vendor_name}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Purpose of Disbursement</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-bold uppercase tracking-tight italic">"{payment.purpose}"</p>
                                    </div>
                                    <div className="flex gap-12 pt-2">
                                        <div className="space-y-1.5 flex-1">
                                            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bank Details</p>
                                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                                {payment.bank_name || 'N/A'}
                                            </p>
                                            <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                                A/C: {payment.account_number || 'XXXXXXXXXXXX'} | IFSC: {payment.ifsc_code || 'XXXX0000000'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-12 pt-2">
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Transaction UTR</p>
                                            <p className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                {payment.utr_number || 'STLD-INTERNAL-TX'}
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Value Date</p>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">
                                                {format(new Date(payment.paid_at || payment.created_at), 'dd MMM yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-8 rounded-[32px] flex flex-col justify-center items-center text-center border-2 border-emerald-100 dark:border-emerald-800 shadow-inner relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-50" />
                                    <div className="bg-white dark:bg-emerald-500 p-4 rounded-2xl shadow-xl mb-6 relative z-10 transform group-hover:scale-110 transition-transform duration-300">
                                        <IndianRupee className="w-10 h-10 text-emerald-600 dark:text-emerald-950" />
                                    </div>
                                    <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.2em] mb-2 relative z-10">Total Net Amount</p>
                                    <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter relative z-10">
                                        ₹{payment.amount.toLocaleString('en-IN')}
                                    </p>
                                    <div className="mt-6 px-5 py-2 bg-emerald-600 text-white text-[11px] font-black rounded-xl uppercase tracking-tighter shadow-lg shadow-emerald-500/20 relative z-10">
                                        {payment.is_split_payment ? `Batch of ${payment.splits?.length || 0} Splits` : 'Tx Success • Confirmed'}
                                    </div>
                                </div>
                            </div>

                            {/* NEW: Split Beneficiary Breakdown */}
                            {payment.is_split_payment && payment.splits && payment.splits.length > 0 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="flex items-center gap-3 border-b-2 border-slate-100 dark:border-slate-800 pb-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                                            <Layers className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Beneficiary Breakdown (Batch Split)</h4>
                                    </div>
                                    <div className="rounded-2xl border-2 border-slate-50 dark:border-slate-800 overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-[10px]">
                                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                <tr>
                                                    <th className="px-4 py-2.5 font-black uppercase text-slate-500 tracking-wider">#</th>
                                                    <th className="px-4 py-2.5 font-black uppercase text-slate-500 tracking-wider">Purpose / Split Title</th>
                                                    <th className="px-4 py-2.5 font-black uppercase text-slate-500 tracking-wider">Payee Name</th>
                                                    <th className="px-4 py-2.5 font-black uppercase text-slate-500 tracking-wider text-right">Amount</th>
                                                    <th className="px-4 py-2.5 font-black uppercase text-slate-500 tracking-wider text-right">UTR / Ref</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-slate-50 dark:divide-slate-800/50">
                                                {payment.splits.map((s, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                                        <td className="px-4 py-3 font-mono text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                                                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight italic">"{s.split_title}"</td>
                                                        <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{s.payee_name}</td>
                                                        <td className="px-4 py-3 font-black text-slate-900 dark:text-white text-right">₹{Number(s.amount).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">{s.utr_number || 'STLD-BAT'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Footer/Signatures */}
                            <div className="grid grid-cols-2 gap-16 pt-4">
                                <div className="space-y-4">
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase font-black border-b-2 border-slate-50 dark:border-slate-800/50 pb-2 tracking-widest">Verification Status</p>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center border-2 border-emerald-200/50 dark:border-emerald-800/50">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">Audit Division</p>
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tighter italic">Secured & Digitally Verified</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4 text-right">
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase font-black border-b-2 border-slate-50 dark:border-slate-800/50 pb-2 tracking-widest">Issuing Department</p>
                                    <div className="space-y-1 pt-1">
                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">CEO BACK OFFICE</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">IGO GROUPS</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Legal/Notes */}
                            <div className="pt-10 text-center border-t-2 border-slate-50 dark:border-slate-800/50 mt-auto">
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-widest font-bold px-4">
                                        This is an official computer-generated transaction record for IGO Group of Companies.
                                        No digital or wet signature is required for validity.
                                    </p>
                                    <p className="text-[9px] text-emerald-600 dark:text-emerald-500 mt-2 uppercase font-black tracking-widest">
                                        17, 2nd Main Rd, Kovalan street, Uthandi, Kanathur, Chennai, Tamil Nadu 600119
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-6 print:hidden">
                    <Button
                        className="flex-1 h-14 text-base font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.97] uppercase tracking-tighter"
                        onClick={handleDownloadPDF}
                    >
                        <Download className="w-5 h-5 mr-3" /> Download Voucher
                    </Button>
                </div>

                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
                    
                    #receipt-content {
                        font-family: 'Space Grotesk', sans-serif;
                    }

                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #receipt-content, #receipt-content * {
                            visibility: visible;
                        }
                        #receipt-content {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        .print\\:hidden {
                            display: none !important;
                        }
                        .print\\:border-none {
                            border: none !important;
                        }
                        .print\\:shadow-none {
                            box-shadow: none !important;
                        }
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
}
