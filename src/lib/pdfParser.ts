import * as pdfjsLib from 'pdfjs-dist';
import { BankStatementRow } from './kotakBankExport';

// Initialize worker
// Use unpkg for the worker as it's often more reliable for specific versions than cdnjs
const PDFJS_VERSION = pdfjsLib.version;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

// Common UTR patterns
const UTR_PATTERNS = [
    /\b([A-Z]{4}[0-9A-Z]{16})\b/i, // NEFT/RTGS UTR pattern (e.g. KKBKH12345678901)
    /\bUTR[:\s]*([A-Z0-9\-]+)\b/i,  // Support hyphens in UTR
    /\bRef[:\s]*([A-Z0-9\-]+)\b/i,  // Support hyphens in Ref
    /\b([A-Z0-9]{10,25})\b/i,       // Generic long alphanumeric (covers FCM-260206L4OLJI)
    /\bIMPS[\/-]([0-9]{12})\b/i,
    /\bUPI[\/-]([0-9]{12})\b/i
];

export async function parsePDFStatement(file: File): Promise<BankStatementRow[]> {
    console.log(`Starting PDF parse for: ${file.name} (Size: ${file.size} bytes)`);
    try {
        const arrayBuffer = await file.arrayBuffer();
        console.log("ArrayBuffer loaded, initializing PDF.js...");

        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            useWorkerFetch: true,
            isEvalSupported: false
        });

        const pdf = await loadingTask.promise;
        console.log(`PDF loaded. Pages: ${pdf.numPages}`);

        const rows: BankStatementRow[] = [];

        // Iterate through all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Parsing Page ${i}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const textItems: any[] = textContent.items;

            console.log(`Page ${i} has ${textItems.length} text items.`);

            // Group items by Y coordinate (row)
            const lineGroups: Record<string, any[]> = {};
            const tolerance = 5; // Reduced tolerance for better line grouping

            textItems.forEach(item => {
                const y = Math.round(item.transform[5]);
                const existingY = Object.keys(lineGroups).find(key => Math.abs(parseInt(key) - y) < tolerance);

                if (existingY) {
                    lineGroups[existingY].push(item);
                } else {
                    lineGroups[y] = [item];
                }
            });

            const sortedYs = Object.keys(lineGroups).sort((a, b) => parseInt(b) - parseInt(a));

            for (const y of sortedYs) {
                const items = lineGroups[y];
                items.sort((a, b) => a.transform[4] - b.transform[4]);

                const lineText = items.map(item => item.str).join(' ').trim();
                if (!lineText) continue;

                // Regex for Date (DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY, DD-MMM-YY, etc.)
                const dateMatch = lineText.match(/(\d{1,2}[\/\-\s](?:\d{1,2}|[A-Za-z]{3})[\/\-\s]\d{2,4})/);

                if (dateMatch) {
                    // Extract UTR
                    let matchedUTR = undefined;
                    for (const pattern of UTR_PATTERNS) {
                        const match = lineText.match(pattern);
                        if (match) {
                            matchedUTR = match[1];
                            break;
                        }
                    }

                    // Extract Numbers (Amounts)
                    const textNoDate = lineText.replace(dateMatch[0], '');
                    // Match numbers with optional leading minus and optional decimals
                    const numberMatches = textNoDate.match(/-?[\d,]+\.\d{2}/g) || textNoDate.match(/-?\b[\d,]{3,}\b/g);

                    if (numberMatches && numberMatches.length > 0) {
                        const rawNumbers = numberMatches.map(n => n.replace(/,/g, ''));
                        const numbers = rawNumbers.map(n => Math.abs(parseFloat(n)));

                        // Heuristic for Debit: 
                        // 1. Explicit labels: "Dr", "Debit", "Wdl", "Withdrawal"
                        // 2. Negative sign: If the number extracted had a leading "-"
                        // 3. Fallback: If we have a UTR or matches date+amount, allow it for matching
                        const hasNegativeSign = rawNumbers.some(n => n.startsWith('-'));
                        const isDebitLine = hasNegativeSign ||
                            lineText.toLowerCase().includes('dr') ||
                            lineText.toLowerCase().includes('debit') ||
                            lineText.toLowerCase().includes('neft') ||
                            lineText.toLowerCase().includes('cms') ||
                            matchedUTR !== undefined;

                        if (isDebitLine) {
                            rows.push({
                                date: dateMatch[0],
                                description: lineText,
                                debit: numbers[0], // Use the absolute value for matching
                                credit: 0,
                                balance: numbers[numbers.length - 1] || 0,
                                utr: matchedUTR
                            });
                        }
                    }
                }
            }
        }

        console.log(`PDF parse complete. Found ${rows.length} rows.`);
        return rows;
    } catch (error) {
        console.error('CRITICAL: Error parsing PDF statement:', error);
        throw new Error(`PDF Parsing Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
