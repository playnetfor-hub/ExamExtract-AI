import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { DocType } from '../types';

// PDF.js Initialization - Robust handling for ESM environments
let getDocument: any = null;

try {
  // Try to resolve the library in various ways to support different bundlers/ESM environments
  const lib = pdfjsLib as any;
  getDocument = lib.getDocument || lib.default?.getDocument;
  
  const version = lib.version || lib.default?.version || '4.8.69';
  const GlobalWorkerOptions = lib.GlobalWorkerOptions || lib.default?.GlobalWorkerOptions;

  if (GlobalWorkerOptions) {
    // Explicitly set the worker source to the same version
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.error("Critical: PDF.js failed to initialize.", e);
}

export const detectFileType = (file: File): DocType => {
  if (file.type === 'application/pdf') return DocType.PDF;
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return DocType.DOCX;
  return DocType.UNKNOWN;
};

// Helper: Process array in batches
async function batchProcess<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// Converts a PDF file into an array of Base64 Image strings
export const processPdfToImages = async (file: File): Promise<string[]> => {
  if (!getDocument) {
    throw new Error("PDF processing engine failed to load. Please refresh the page.");
  }

  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const pageIndices = Array.from({ length: numPages }, (_, i) => i + 1);

    const renderPage = async (pageNum: number): Promise<string> => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); 
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return '';

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Extract image data
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      return base64;
    };

    const images = await batchProcess(pageIndices, 4, renderPage);
    return images.filter(img => img.length > 0);
  } catch (err: any) {
    console.error("PDF Render Error:", err);
    throw new Error(`Failed to process PDF: ${err.message}`);
  }
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
  
  if (currentChunk.length > 0) chunks.push(currentChunk);
  
  return chunks;
};

// Converts DOCX to an array of base64 encoded HTML chunks
export const processDocxToHtml = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Ensure global Buffer is available (polyfilled in index.html)
  // Mammoth requires 'Buffer' to be present globally or on window
  const win = window as any;
  if (typeof win.Buffer === 'undefined' && typeof win.buffer !== 'undefined') {
     win.Buffer = win.buffer.Buffer;
  }
  
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const rawHtml = result.value;
  const chunks = chunkHtmlContent(rawHtml);
  return chunks.map(chunk => btoa(unescape(encodeURIComponent(chunk))));
};