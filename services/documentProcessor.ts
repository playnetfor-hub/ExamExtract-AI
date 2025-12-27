import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { DocType } from '../types';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const detectFileType = (file: File): DocType => {
  if (file.type === 'application/pdf') return DocType.PDF;
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return DocType.DOCX;
  return DocType.UNKNOWN;
};

// Converts a PDF file into an array of Base64 Image strings (one per page)
export const processPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const images: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Increase scale to 3.0 for better OCR accuracy, especially for Arabic and Math symbols
    const viewport = page.getViewport({ scale: 3.0 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // IMPORTANT: Set white background. PDF transparency can turn black in JPEGs, ruining OCR.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // High quality JPEG (0.95) to minimize artifacts while keeping payload reasonable
    const base64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    images.push(base64);
  }

  return images;
};

// Chunking helper for HTML content
const chunkHtmlContent = (html: string, maxChunkSize: number = 30000): string[] => {
  if (html.length <= maxChunkSize) return [html];

  const chunks: string[] = [];
  // Split by paragraph end tag to preserve basic structure
  const parts = html.split('</p>');
  
  let currentChunk = '';
  
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    
    // Re-attach the closing tag if it wasn't the very last empty split
    if (i < parts.length - 1) {
      part += '</p>';
    }

    // If adding this paragraph exceeds the limit
    if (currentChunk.length + part.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        // Start new chunk with this part
        currentChunk = part;
      } else {
        // Edge case: A single paragraph is larger than maxChunkSize. 
        // We must push it anyway to avoid losing data.
        chunks.push(part);
        currentChunk = '';
      }
    } else {
      currentChunk += part;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

// Converts DOCX to an array of base64 encoded HTML chunks
export const processDocxToHtml = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Convert with standard options. Mammoth is good for text/bold/italics.
  // Note: Mammoth strips colors by default. Bold/Italic are our best bets for "Correct Answer" in DOCX.
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const rawHtml = result.value;
  
  const chunks = chunkHtmlContent(rawHtml);
  
  // Return base64 encoded chunks
  return chunks.map(chunk => btoa(unescape(encodeURIComponent(chunk))));
};