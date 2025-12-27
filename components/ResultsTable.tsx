import React, { useState } from 'react';
import { McqData } from '../types';
import * as XLSX from 'xlsx';
import { Download, Table as TableIcon, Trash2, Edit3, ClipboardCheck, Copy, Check } from 'lucide-react';

interface ResultsTableProps {
  data: McqData[];
  onUpdate: (id: string, field: keyof McqData, value: string) => void;
  onDelete: (id: string) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data, onUpdate, onDelete }) => {
  const [copied, setCopied] = useState(false);

  if (data.length === 0) {
      return (
          <div className="text-center py-12 text-slate-400">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck size={40} className="text-slate-300" />
              </div>
              <p className="font-medium">No results yet. Upload a document to start extraction.</p>
          </div>
      );
  }

  const handleDownload = () => {
    const headers = ['Question', 'Choice A', 'Choice B', 'Choice C', 'Choice D', 'Correct Answer', 'Passage'];
    const rows = data.map(item => [
      item.question, item.choiceA, item.choiceB, item.choiceC, item.choiceD, item.correctAnswer, item.passage || ''
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wscols = [{ wch: 60 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 40 }];
    worksheet['!cols'] = wscols;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MCQs");
    XLSX.writeFile(workbook, "extracted_mcqs.xlsx");
  };

  const handleCopy = () => {
    const text = data.map(item => 
      `${item.question}\nA) ${item.choiceA}\nB) ${item.choiceB}\nC) ${item.choiceC}\nD) ${item.choiceD}\nAnswer: ${item.correctAnswer}\n`
    ).join('\n---\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
             <TableIcon size={24} />
          </div>
          Extracted Results 
          <span className="text-sm font-medium text-slate-500 ml-2 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {data.length} items
          </span>
        </h2>
        
        <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-white text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-4 py-2.5 rounded-xl font-semibold transition-all shadow-sm"
            >
              {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
            <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-95"
            >
            <Download size={18} />
            Download Excel
            </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xl shadow-slate-200/50 bg-white flex flex-col max-h-[800px]">
        <div className="overflow-auto custom-scrollbar">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-4 font-bold text-center w-14 bg-slate-50">#</th>
                <th className="p-4 font-bold min-w-[280px] bg-slate-50">Question</th>
                <th className="p-4 font-bold min-w-[320px] bg-slate-50">Choices (A-D)</th>
                <th className="p-4 font-bold w-28 bg-slate-50 text-center">Answer</th>
                <th className="p-4 font-bold min-w-[200px] bg-slate-50">Passage</th>
                <th className="p-4 font-bold w-16 bg-slate-50"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item, index) => (
                <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="p-4 text-slate-400 align-top text-center font-semibold pt-6">{index + 1}</td>
                  <td className="p-3 align-top">
                    <textarea
                      className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-lg p-3 text-slate-900 font-medium resize-y min-h-[100px] transition-all text-base leading-relaxed"
                      value={item.question}
                      onChange={(e) => onUpdate(item.id, 'question', e.target.value)}
                      placeholder="Question..."
                    />
                  </td>
                  <td className="p-3 align-top">
                    <div className="space-y-2.5">
                        {['A', 'B', 'C', 'D'].map((opt) => (
                            <div key={opt} className="flex items-start gap-2 relative group/choice">
                                <span className={`text-xs font-bold mt-2.5 w-5 ${item.correctAnswer === opt ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {opt}
                                </span>
                                <input
                                    type="text"
                                    className={`w-full border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-md p-2 text-slate-700 text-sm transition-all 
                                    ${item.correctAnswer === opt ? 'font-semibold text-emerald-800 bg-emerald-50/50 border-emerald-200' : 'bg-transparent'}`}
                                    value={item[`choice${opt}` as keyof McqData] as string}
                                    onChange={(e) => onUpdate(item.id, `choice${opt}` as keyof McqData, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                  </td>
                  <td className="p-3 align-top text-center">
                    <div className="mt-2">
                        <select
                            value={item.correctAnswer}
                            onChange={(e) => onUpdate(item.id, 'correctAnswer', e.target.value)}
                            className={`w-full p-2.5 rounded-lg font-bold text-center border cursor-pointer transition-all outline-none focus:ring-2
                                ${item.correctAnswer 
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 focus:ring-emerald-500/20 shadow-sm' 
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300 focus:ring-indigo-500/20'}
                            `}
                        >
                            <option value="">?</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="E">E</option>
                        </select>
                    </div>
                  </td>
                  <td className="p-3 align-top">
                    <textarea
                      className="w-full bg-slate-50/50 border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-lg p-3 text-slate-600 text-xs resize-y min-h-[100px] transition-all italic leading-relaxed"
                      value={item.passage || ''}
                      onChange={(e) => onUpdate(item.id, 'passage', e.target.value)}
                      placeholder="Passage..."
                    />
                  </td>
                  <td className="p-3 align-middle text-center">
                    <button
                        onClick={() => onDelete(item.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete Row"
                    >
                        <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};