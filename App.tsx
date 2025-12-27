import React, { useState, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { McqData, ProcessingStatus, AppLanguage, DocType } from './types';
import { processPdfToImages, processDocxToHtml, detectFileType } from './services/documentProcessor';
import { analyzeDocumentContent } from './services/geminiService';
import { Loader2, Zap, LayoutTemplate, Globe, FileCheck, AlertCircle, StopCircle } from 'lucide-react';

const PAGES_PER_CONTEXT = 4;
const CONCURRENT_REQUESTS = 3;

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(AppLanguage.AUTO);
  const [results, setResults] = useState<McqData[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ total: 0, current: 0, status: 'idle' });
  
  // Use a ref to track cancellation without re-rendering issues
  const abortRef = useRef<boolean>(false);

  const chunkArray = (array: string[], size: number) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  const processGroups = async (groups: string[][], mimeType: string) => {
    let completedGroups = 0;
    
    for (let i = 0; i < groups.length; i += CONCURRENT_REQUESTS) {
        if (abortRef.current) break;

        const batch = groups.slice(i, i + CONCURRENT_REQUESTS);
        
        setStatus(prev => ({ 
            ...prev, 
            message: `Analyzing batch ${Math.ceil((completedGroups + 1) / CONCURRENT_REQUESTS) + 1}...` 
        }));

        const promises = batch.map(group => analyzeDocumentContent(group, mimeType, language));
        const batchResults = await Promise.all(promises);

        if (abortRef.current) break;

        const flatResults = batchResults.flat();
        if (flatResults.length > 0) {
            setResults(prev => [...prev, ...flatResults]);
        }
        
        completedGroups += batch.length;
        setStatus(prev => ({ ...prev, current: completedGroups }));
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    abortRef.current = false;
    setStatus({ total: 0, current: 0, status: 'analyzing' });
    setResults([]);

    try {
      const type = detectFileType(file);
      let contentGroups: string[][] = [];
      let mimeType = '';

      if (type === DocType.PDF) {
        setStatus({ total: 100, current: 0, status: 'analyzing', message: 'Optimizing PDF (Parallel Processing)...' });
        // Small delay to allow UI to update before heavy work starts
        await new Promise(r => setTimeout(r, 100));
        
        const images = await processPdfToImages(file);
        if (abortRef.current) return;

        contentGroups = chunkArray(images, PAGES_PER_CONTEXT);
        mimeType = 'image/jpeg';

      } else if (type === DocType.DOCX) {
        setStatus({ total: 100, current: 10, status: 'analyzing', message: 'Reading Word Document...' });
        const htmlChunks = await processDocxToHtml(file);
        contentGroups = chunkArray(htmlChunks, PAGES_PER_CONTEXT);
        mimeType = 'text/html';
      }

      if (abortRef.current) {
         setStatus({ total: 0, current: 0, status: 'idle' });
         return;
      }

      setStatus({ 
        total: contentGroups.length, 
        current: 0, 
        status: 'extracting', 
        message: 'AI Extraction in Progress...' 
      });
      
      await processGroups(contentGroups, mimeType);

      if (abortRef.current) {
        setStatus({ total: 0, current: 0, status: 'idle', message: 'Cancelled' });
      } else {
        setStatus({ total: 0, current: 0, status: 'complete', message: 'Extraction Complete!' });
      }

    } catch (error: any) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Processing failed.';
      setStatus({ total: 0, current: 0, status: 'error', message: msg });
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    setStatus({ total: 0, current: 0, status: 'idle', message: 'Stopping...' });
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

  const progressPercentage = status.total > 0 ? Math.min(100, Math.round((status.current / status.total) * 100)) : 0;
  const isProcessing = status.status === 'analyzing' || status.status === 'extracting';

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 selection:bg-indigo-100 selection:text-indigo-800">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-sm supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-indigo-500 p-2 rounded-lg shadow-indigo-200 shadow-md">
              <Zap className="text-white" size={20} fill="currentColor" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              ExamExtract<span className="text-indigo-600">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
             <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                <FileCheck size={14} /> Ready
             </span>
             <span className="text-xs font-medium text-slate-500">v3.1 Optimized</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
            Transform Documents into <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600">
              Structured Data Instantly
            </span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Fast, accurate MCQ extraction with automatic passage detection.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <label className="block text-sm font-semibold text-slate-800 mb-3 ml-1">Document Upload</label>
              <FileUpload 
                onFileSelect={setFile} 
                selectedFile={file} 
                onClear={handleClear}
                disabled={isProcessing}
              />
            </div>
            
            <div className="lg:col-span-4 space-y-6">
               <div>
                <label className="block text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Globe size={16} className="text-indigo-500" /> Language Model
                </label>
                <div className="relative group">
                  <select 
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-3.5 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium cursor-pointer hover:border-indigo-300"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                    disabled={status.status !== 'idle' && status.status !== 'complete' && status.status !== 'error'}
                  >
                    <option value={AppLanguage.AUTO}>Auto Detect (Smart)</option>
                    <option value={AppLanguage.ENGLISH}>English (Standard)</option>
                    <option value={AppLanguage.ARABIC}>Arabic (RTL Optimized)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 group-hover:text-indigo-500 transition-colors">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <LayoutTemplate size={16} className="text-indigo-500" /> Output Format
                </label>
                <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 py-3.5 px-4 rounded-xl flex justify-between items-center cursor-not-allowed opacity-75">
                  <span className="font-medium">Multiple Choice (MCQ)</span>
                  <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">Fixed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center justify-center">
            
            {!isProcessing ? (
              <button
                onClick={handleProcess}
                disabled={!file}
                className={`
                  relative overflow-hidden group w-full max-w-md py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all duration-300 transform
                  ${!file ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-500/40'}
                `}
              >
                Extract to Excel
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="w-full max-w-md py-4 rounded-xl font-bold text-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700 transition-all flex items-center justify-center gap-2"
              >
                <StopCircle size={20} /> Cancel Processing
              </button>
            )}
            
            {isProcessing && (
              <div className="w-full max-w-md mt-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                  <span>{status.message}</span>
                  <span>{progressPercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden ring-1 ring-slate-200">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <div className="text-center mt-3 text-xs text-indigo-600 font-medium">
                  Found {results.length} questions so far...
                </div>
              </div>
            )}

            {status.status === 'error' && (
              <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3 w-full max-w-md animate-in fade-in">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <div className="text-sm font-medium">{status.message}</div>
              </div>
            )}
          </div>
        </div>

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