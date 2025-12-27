import React, { useCallback } from 'react';
import { Upload, FileText, File as FileIcon, X } from 'lucide-react';
import { DocType } from '../types';
import { detectFileType } from '../services/documentProcessor';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile, onClear, disabled }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    
    const file = e.dataTransfer.files[0];
    if (file) validateAndSet(file);
  }, [disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const file = e.target.files?.[0];
    if (file) validateAndSet(file);
  };

  const validateAndSet = (file: File) => {
    const type = detectFileType(file);
    if (type !== DocType.UNKNOWN) {
      onFileSelect(file);
    } else {
      alert("Please upload a PDF or DOCX file.");
    }
  };

  if (selectedFile) {
    return (
      <div className="w-full p-6 border-2 border-indigo-100 bg-indigo-50/50 rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
            {detectFileType(selectedFile) === DocType.PDF ? <FileIcon size={24} /> : <FileText size={24} />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{selectedFile.name}</h3>
            <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
        {!disabled && (
          <button 
            onClick={onClear}
            className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500"
          >
            <X size={20} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group
        ${disabled ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30'}`}
    >
      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-indigo-500">
          <Upload size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Click to upload or drag & drop</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
          Supports PDF and Word (.docx).<br/>
          Files are processed securely in your browser.
        </p>
        <input 
          type="file" 
          className="hidden" 
          accept=".pdf,.docx" 
          onChange={handleChange}
          disabled={disabled}
        />
      </label>
    </div>
  );
};
