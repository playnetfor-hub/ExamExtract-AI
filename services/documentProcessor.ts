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

// Helper: Process array in batches to avoid memory spikes while maintaining speed
async function batchProcess<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// Converts a PDF file into an array of Base64 Image strings (optimized parallel rendering)
export const processPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  
  // Create an array of page numbers [1, 2, 3, ...]
  const pageIndices = Array.from({ length: numPages }, (_, i) => i + 1);

  // Render pages in parallel batches of 4.
  // This is significantly faster than sequential rendering.
  const renderPage = async (pageNum: number): Promise<string> => {
    const page = await pdf.getPage(pageNum);
    
    // SCALE: 1.5 is the sweet spot for Gemini Flash (readable text, low token count)
    const viewport = page.getViewport({ scale: 1.5 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return '';

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // White background is crucial for transparency handling
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // Quality 0.8 is visually sufficient for OCR but reduces payload size by ~40%
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    return base64;
  };

  // Process 4 pages at a time
  const images = await batchProcess(pageIndices, 4, renderPage);
  return images.filter(img => img.length > 0);
};

// Chunking helper for HTML content
const chunkHtmlContent = (html: string, maxChunkSize: number = 30000): string[] => {
  if (html.length <= maxChunkSize) return [html];

  const chunks: string[] = [];
  const parts = html.split('</p>');
  
  let currentChunk = '';
  
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (i < parts.length - 1) part += '</p>';

    if (currentChunk.length + part.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = part;
      } else {
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
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const rawHtml = result.value;
  const chunks = chunkHtmlContent(rawHtml);
  return chunks.map(chunk => btoa(unescape(encodeURIComponent(chunk))));
};