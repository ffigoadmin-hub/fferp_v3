import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { WorkOrderTemplate, WorkOrderData } from '@/components/engineering/WorkOrderTemplate';

export async function generateWorkOrderPDF(data: WorkOrderData): Promise<Blob> {
    // Create a hidden container for rendering
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.background = '#ffffff';
    document.body.appendChild(container);

    // Render the template
    const root = createRoot(container);
    await new Promise<void>((resolve) => {
        root.render(
            React.createElement(WorkOrderTemplate, { data })
        );
        // Allow time for rendering + image loading
        setTimeout(resolve, 500);
    });

    try {
        // Capture as canvas
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 794,
            windowWidth: 794,
        });

        // Create PDF (A4 dimensions)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const imgData = canvas.toDataURL('image/png');

        // Handle multi-page if content is long
        if (imgHeight <= pageHeight) {
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        } else {
            let position = 0;
            let remaining = imgHeight;
            let page = 0;
            while (remaining > 0) {
                if (page > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
                position += pageHeight;
                remaining -= pageHeight;
                page++;
            }
        }

        return pdf.output('blob');
    } finally {
        root.unmount();
        document.body.removeChild(container);
    }
}

export async function downloadWorkOrderPDF(data: WorkOrderData): Promise<void> {
    const blob = await generateWorkOrderPDF(data);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WO-${String(data.woNumber).padStart(4, '0')}-${data.vendorName.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
