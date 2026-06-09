import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    Upload, FileSpreadsheet, Check, X, AlertTriangle, 
    Download, RefreshCw, ArrowRight, CheckCircle2, XCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useReconciliation, MatchedPayment, UnmatchedRow } from '@/hooks/useReconciliation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ReconciliationHubPage() {
    const { parseStatement, matchPayments, applyReconciliation, isProcessing, lastResult } = useReconciliation();
    
    const [file, setFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [step, setStep] = useState<'upload' | 'preview' | 'results'>('upload');
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            setFile(droppedFile);
        } else {
            toast.error('Please upload an Excel file (.xlsx or .xls)');
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleParse = async () => {
        if (!file) return;
        
        try {
            const rows = await parseStatement(file);
            setParsedRows(rows);
            setStep('preview');
            toast.success(`Parsed ${rows.length} transactions from statement`);
        } catch (error) {
            toast.error('Failed to parse Excel file');
        }
    };

    const handleMatch = async () => {
        try {
            const result = await matchPayments(parsedRows);
            
            // Auto-select all matched payments
            const matchedIds = new Set(result.matched.map(m => m.paymentId));
            setSelectedMatches(matchedIds);
            
            setStep('results');
            toast.success(`Matched ${result.matched.length} of ${result.summary.totalRows} transactions`);
        } catch (error) {
            toast.error('Failed to run matching');
        }
    };

    const handleApply = async () => {
        const matchesToApply = lastResult?.matched.filter(m => selectedMatches.has(m.paymentId)) || [];
        
        if (matchesToApply.length === 0) {
            toast.error('No matches selected');
            return;
        }

        const result = await applyReconciliation(matchesToApply);
        
        if (result.success) {
            // Reset state
            setFile(null);
            setParsedRows([]);
            setSelectedMatches(new Set());
            setStep('upload');
        }
    };

    const toggleMatchSelection = (paymentId: string) => {
        setSelectedMatches(prev => {
            const newSet = new Set(prev);
            if (newSet.has(paymentId)) {
                newSet.delete(paymentId);
            } else {
                newSet.add(paymentId);
            }
            return newSet;
        });
    };

    const reset = () => {
        setFile(null);
        setParsedRows([]);
        setSelectedMatches(new Set());
        setStep('upload');
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="p-6 space-y-6"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Reconciliation Hub</h1>
                    <p className="text-muted-foreground">Auto-match bank statements with pending payments</p>
                </div>
                {step !== 'upload' && (
                    <Button variant="outline" onClick={reset}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Start Over
                    </Button>
                )}
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className={cn("flex items-center gap-2", step === 'upload' ? "text-primary font-bold" : "text-muted-foreground")}>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold", 
                        step === 'upload' ? "bg-primary text-primary-foreground" : "bg-muted")}>1</div>
                    Upload
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className={cn("flex items-center gap-2", step === 'preview' ? "text-primary font-bold" : "text-muted-foreground")}>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold", 
                        step === 'preview' ? "bg-primary text-primary-foreground" : "bg-muted")}>2</div>
                    Preview
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className={cn("flex items-center gap-2", step === 'results' ? "text-primary font-bold" : "text-muted-foreground")}>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold", 
                        step === 'results' ? "bg-primary text-primary-foreground" : "bg-muted")}>3</div>
                    Apply
                </div>
            </div>

            {/* Step 1: Upload */}
            {step === 'upload' && (
                <Card>
                    <CardContent className="p-6">
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer",
                                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('file-input')?.click()}
                        >
                            <input
                                id="file-input"
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-bold mb-2">
                                {file ? file.name : 'Drop Bank Statement Here'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports .xlsx and .xls files'}
                            </p>
                        </div>

                        {file && (
                            <div className="flex justify-end mt-4">
                                <Button onClick={handleParse} disabled={isProcessing}>
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    Parse Statement
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Preview */}
            {step === 'preview' && parsedRows.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Parsed Transactions ({parsedRows.length})</CardTitle>
                        <CardDescription>Review the extracted transactions before matching</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Row</TableHead>
                                        <TableHead>Account</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>UTR/Reference</TableHead>
                                        <TableHead>Description</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedRows.slice(0, 50).map((row, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                                            <TableCell className="font-mono text-xs">{row.accountNumber || '-'}</TableCell>
                                            <TableCell className="font-bold">₹{Number(row.amount || 0).toLocaleString()}</TableCell>
                                            <TableCell className="font-mono text-xs">{row.utrNumber || '-'}</TableCell>
                                            <TableCell className="text-xs max-w-[200px] truncate">{row.description || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-end mt-4">
                            <Button onClick={handleMatch} disabled={isProcessing}>
                                {isProcessing ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Matching...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Run Auto-Match
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Results */}
            {step === 'results' && lastResult && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold">{lastResult.summary.totalRows}</div>
                                    <div className="text-sm text-muted-foreground">Total Rows</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-green-200 bg-green-50/50">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600">{lastResult.summary.matchedCount}</div>
                                    <div className="text-sm text-green-700">Matched</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50/50">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-amber-600">{lastResult.summary.unmatchedCount}</div>
                                    <div className="text-sm text-amber-700">Unmatched</div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-primary">
                                        ₹{lastResult.summary.totalMatchedAmount.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Matched Amount</div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Matched Payments */}
                    {lastResult.matched.length > 0 && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-green-600 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5" />
                                        Matched Payments ({lastResult.matched.length})
                                    </CardTitle>
                                    <CardDescription>Select payments to mark as PAID</CardDescription>
                                </div>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    {selectedMatches.size} selected
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">Select</TableHead>
                                            <TableHead>Vendor</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>UTR</TableHead>
                                            <TableHead>Match Score</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lastResult.matched.map((match) => (
                                            <TableRow 
                                                key={match.paymentId}
                                                className={cn(selectedMatches.has(match.paymentId) ? "bg-green-50" : "")}
                                            >
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMatches.has(match.paymentId)}
                                                        onChange={() => toggleMatchSelection(match.paymentId)}
                                                        className="w-4 h-4"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{match.vendorName}</TableCell>
                                                <TableCell className="font-bold">₹{match.amount.toLocaleString()}</TableCell>
                                                <TableCell className="font-mono text-xs">{match.utr}</TableCell>
                                                <TableCell>
                                                    <Progress value={match.matchScore} className="w-20 h-2" />
                                                    <span className="text-xs text-muted-foreground ml-2">{match.matchScore}%</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Unmatched Rows */}
                    {lastResult.unmatched.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-amber-600 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    Unmatched Transactions ({lastResult.unmatched.length})
                                </CardTitle>
                                <CardDescription>These require manual review</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 max-h-[200px] overflow-auto">
                                    {lastResult.unmatched.map((row, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-2 bg-amber-50 rounded border border-amber-200 text-sm">
                                            <span className="font-mono text-xs">Row {row.row}</span>
                                            <span className="text-amber-700">{row.reason}</span>
                                            <span className="font-bold">₹{Number(row.data.amount || 0).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Apply Button */}
                    <div className="flex justify-end">
                        <Button 
                            size="lg" 
                            onClick={handleApply} 
                            disabled={isProcessing || selectedMatches.size === 0}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Apply Reconciliation ({selectedMatches.size} payments)
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
