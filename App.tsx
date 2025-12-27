import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { McqData, ProcessingStatus, AppLanguage, DocType } from './types';
import { processPdfToImages, processDocxToHtml, detectFileType } from './services/documentProcessor';
import { analyzeDocumentContent } from './services/geminiService';
import { Loader2, Zap, LayoutTemplate, Globe } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(AppLanguage.AUTO);
  const [results, setResults] = useState<McqData[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ total: 0, current: 0, status: 'idle' });

  const handleProcess = async () => {
    if (!file) return;

    setStatus({ total: 0, current: 0, status: 'analyzing' });
    setResults([]);

    try {
      const type = detectFileType(file);
      let extractedData: McqData[] = [];

      if (type === DocType.PDF) {
        setStatus({ total: 0, current: 0, status: 'analyzing', message: 'Converting PDF to images...' });
        // Process PDF
        const images = await processPdfToImages(file);
        
        setStatus({ total: images.length, current: 0, status: 'extracting', message: 'AI Analyzing pages...' });
        
        // Process sequentially to update progress
        for (let i = 0; i < images.length; i++) {
          setStatus(prev => ({ ...prev, current: i + 1, message: `Analyzing page ${i + 1} of ${images.length}...` }));
          
          try {
            const pageData = await analyzeDocumentContent(images[i], 'image/jpeg', language);
            if (pageData && pageData.length > 0) {
                extractedData = [...extractedData, ...pageData];
                // Update results in real-time
                setResults(prev => [...prev, ...pageData]);
            }
          } catch (e: any) {
              console.error(`Error on page ${i + 1}:`, e);
              // If it's a critical error (like Auth), stop immediately
              if (e.message.includes('API Key') || e.message.includes('Model not found')) {
                  throw e;
              }
              // Otherwise continue to next page
          }
        }

      } else if (type === DocType.DOCX) {
        setStatus({ total: 1, current: 0, status: 'analyzing', message: 'Reading document...' });
        const htmlChunks = await processDocxToHtml(file);
        
        setStatus({ total: htmlChunks.length, current: 0, status: 'extracting', message: 'AI Analyzing content...' });
        
        for (let i = 0; i < htmlChunks.length; i++) {
           setStatus(prev => ({ 
             ...prev, 
             current: i + 1, 
             message: `Analyzing part ${i + 1} of ${htmlChunks.length}...` 
           }));

           try {
            const chunkData = await analyzeDocumentContent(htmlChunks[i], 'text/html', language);
            if (chunkData && chunkData.length > 0) {
                extractedData = [...extractedData, ...chunkData];
                setResults(prev => [...prev, ...chunkData]);
            }
           } catch (e: any) {
             console.error(`Error on chunk ${i + 1}:`, e);
             if (e.message.includes('API Key') || e.message.includes('Model not found')) {
                 throw e;
             }
           }
        }
      }

      setStatus({ total: 0, current: 0, status: 'complete', message: 'Done!' });

    } catch (error: any) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'An error occurred during processing.';
      setStatus({ total: 0, current: 0, status: 'error', message: msg });
    }
  };

  const handleClear = () => {
    setFile(null);
    setResults([]);
    setStatus({ total: 0, current: 0, status: 'idle' });
  };

  const handleUpdateResult = (id: string, field: keyof McqData, value: string) => {
    setResults(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleDeleteResult = (id: string) => {
    setResults(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 bg-opacity-80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Zap className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-500">
              ExamExtract AI
            </span>
          </div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">v1.1 (Beta)</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Convert Exams to Excel <br className="hidden sm:block" />
            <span className="text-indigo-600">in Seconds with AI</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Upload your PDF or Word documents. Edit the results directly before exporting to Excel.
          </p>
        </div>

        {/* Configuration Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Upload Document</label>
            <FileUpload 
              onFileSelect={setFile} 
              selectedFile={file} 
              onClear={handleClear}
              disabled={status.status === 'analyzing' || status.status === 'extracting'}
            />
          </div>
          
          <div className="space-y-6">
             {/* Language Selection */}
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Globe size={16} /> Language
              </label>
              <div className="relative">
                <select 
                  className="w-full appearance-none bg-white border border-slate-300 text-slate-700 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 transition-shadow shadow-sm cursor-pointer"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                  disabled={status.status !== 'idle' && status.status !== 'complete' && status.status !== 'error'}
                >
                  <option value={AppLanguage.AUTO}>Auto Detect</option>
                  <option value={AppLanguage.ENGLISH}>English</option>
                  <option value={AppLanguage.ARABIC}>Arabic</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <LayoutTemplate size={16} /> Question Type
              </label>
              <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 py-3 px-4 rounded-xl shadow-sm flex justify-between items-center cursor-not-allowed">
                <span>Multiple Choice (MCQ)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center justify-center mb-10">
          <button
            onClick={handleProcess}
            disabled={!file || (status.status !== 'idle' && status.status !== 'complete' && status.status !== 'error')}
            className={`
              relative overflow-hidden group w-full max-w-sm py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:-translate-y-0.5
              ${!file ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'}
            `}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {status.status === 'analyzing' || status.status === 'extracting' ? (
                <>
                   <Loader2 className="animate-spin" /> Processing...
                </>
              ) : (
                'Convert to Excel'
              )}
            </span>
          </button>
          
          {/* Progress Status */}
          {(status.status === 'analyzing' || status.status === 'extracting') && (
            <div className="w-full max-w-sm mt-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>{status.message}</span>
                {status.total > 0 && <span>{Math.round((status.current / status.total) * 100)}%</span>}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${status.total > 0 ? (status.current / status.total) * 100 : 5}%` }}
                ></div>
              </div>
            </div>
          )}

          {status.status === 'error' && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2 animate-in fade-in">
              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
              {status.message}
            </div>
          )}
        </div>

        {/* Results Area */}
        <ResultsTable 
          data={results} 
          onUpdate={handleUpdateResult}
          onDelete={handleDeleteResult}
        />
      </main>
    </div>
  );
};

export default App;