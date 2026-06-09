import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

export const generateSiteVisitDocx = async (req: any, dailyReports: any[], sessionReports: any[]) => {
  // Helper to fetch image and convert to Uint8Array/ArrayBuffer
  const fetchImage = async (url: string): Promise<Uint8Array | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (e) {
      console.error('Failed to fetch image for docx:', url, e);
      return null;
    }
  };

  const children: any[] = [
    new Paragraph({
      text: "SITE EVALUATION REPORT",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `REPORT ID: ${req.request_number}`,
          bold: true,
          size: 20,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),

    // Project Info
    new Paragraph({
      text: "1. STRATEGIC PROJECT INFORMATION",
      heading: HeadingLevel.HEADING_2,
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CLIENT NAME", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph(req.client_name || 'N/A')], width: { size: 70, type: WidthType.PERCENTAGE } }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "LOCATION / CITY", bold: true })] })] }),
            new TableCell({ children: [new Paragraph(`${req.location_city || 'N/A'}, ${req.location_state || 'N/A'}`)] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CATEGORY", bold: true })] })] }),
            new TableCell({ children: [new Paragraph(req.visit_category || 'N/A')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "OBJECTIVE", bold: true })] })] }),
            new TableCell({ children: [new Paragraph(req.purpose_description || req.visit_purpose || 'N/A')] }),
          ],
        }),
      ],
    }),

    new Paragraph({ text: "", spacing: { before: 300 } }),

    // Field Activity Summary
    new Paragraph({
      text: "2. OPERATIONAL FIELD TIMELINE",
      heading: HeadingLevel.HEADING_2,
    }),
  ];

  // Add daily reports
  if (dailyReports.length > 0) {
    dailyReports.forEach(report => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `DAY ${report.visit_day_number} [${format(new Date(report.report_date), 'PPP')}]: `, bold: true, color: "111827" }),
          new TextRun({ text: report.work_summary }),
        ],
        spacing: { before: 100, after: 100 },
        bullet: { level: 0 }
      }));
    });
  } else {
    children.push(new Paragraph({ 
      children: [new TextRun({ text: "No daily field logs recorded for this mission.", italics: true })] 
    }));
  }

  children.push(new Paragraph({ text: "", spacing: { before: 300 } }));
  children.push(new Paragraph({
    text: "3. DETAILED SESSION OBSERVATIONS & ARTIFACTS",
    heading: HeadingLevel.HEADING_2,
  }));

  // Adding session reports dynamically
  for (const session of sessionReports) {
    const sessionTitle = `${session.session_type.toUpperCase()} SESSION - ${format(new Date(session.report_date), 'PPP')}`;
    
    children.push(new Paragraph({
      children: [
        new TextRun({ text: sessionTitle, bold: true, color: "2563EB", size: 22 }),
      ],
      spacing: { before: 200, after: 100 },
    }));
    
    children.push(new Paragraph({
      children: [new TextRun({ text: session.work_summary })],
      spacing: { after: 100 },
    }));

    if (session.observations) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Observations: ", italics: true, bold: true }),
          new TextRun({ text: session.observations, italics: true }),
        ],
        spacing: { after: 60 }
      }));
    }

    if (session.challenges) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Field Challenges: ", italics: true, bold: true, color: "B91C1C" }),
          new TextRun({ text: session.challenges, italics: true }),
        ],
        spacing: { after: 100 }
      }));
    }

    // Handle Images with proper sizing and fallback
    if (session.photo_urls && session.photo_urls.length > 0) {
      children.push(new Paragraph({ 
        children: [new TextRun({ text: "Mission Photographs:", bold: true, size: 18 })], 
        spacing: { before: 150, after: 100 } 
      }));
      
      for (const url of session.photo_urls) {
        const imgBuffer = await fetchImage(url);
        if (imgBuffer) {
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: {
                  width: 500,
                  height: 350,
                },
              } as any),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }));
        }
      }
    }
    
    children.push(new Paragraph({ text: "", spacing: { after: 200 }, border: { bottom: { color: "E5E7EB", size: 1, space: 1, style: "single" } } }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  // Generate and save
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Site_Visit_Report_${req.request_number}.docx`);
};
