import React from 'react';
import { McqData } from '../types';
import * as XLSX from 'xlsx';
import { Download, Table as TableIcon, Trash2 } from 'lucide-react';

interface ResultsTableProps {
  data: McqData[];
  onUpdate: (id: string, field: keyof McqData, value: string) => void;
  onDelete: (id: string) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data, onUpdate, onDelete }) => {
  if (data.length === 0) return null;

  const handleDownload = () => {
    const headers = [
      'Question',
      'Choice A',
      'Choice B',
      'Choice C',
      'Choice D',
      'Correct Answer',
      'Passage'
    ];

    const rows = data.map(item => [
      item.question,
      item.choiceA,
      item.choiceB,
      item.choiceC,
      item.choiceD,
      item.correctAnswer,
      item.passage || ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    const wscols = [
      { wch: 60 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 40 },
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MCQs");
    XLSX.writeFile(workbook, "extracted_mcqs.xlsx");
  };

  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <TableIcon className="text-indigo-600" size={24} />
          Extracted Results ({data.length})
        </h2>
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                💡 Tip: You can edit cells directly before downloading
            </span>
            <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
            >
            <Download size={18} />
            Download Excel
            </button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold w-12 text-center">#</th>
                <th className="p-4 font-semibold min-w-[250px]">Question</th>
                <th className="p-4 font-semibold min-w-[300px]">Options (A, B, C, D)</th>
                <th className="p-4 font-semibold w-24">Answer</th>
                <th className="p-4 font-semibold min-w-[200px]">Passage</th>
                <th className="p-4 font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4 text-slate-500 align-top text-center font-medium">{index + 1}</td>
                  
                  {/* Question Input */}
                  <td className="p-2 align-top">
                    <textarea
                      className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg p-2 text-slate-900 font-medium resize-y min-h-[80px] transition-all"
                      value={item.question}
                      onChange={(e) => onUpdate(item.id, 'question', e.target.value)}
                      placeholder="Question text..."
                    />
                  </td>

                  {/* Options Inputs */}
                  <td className="p-2 align-top">
                    <div className="space-y-2">
                        {['A', 'B', 'C', 'D'].map((opt) => (
                            <div key={opt} className="flex items-start gap-2">
                                <span className={`text-xs font-bold mt-2 w-4 ${item.correctAnswer === opt ? 'text-green-600' : 'text-slate-400'}`}>
                                    {opt}:
                                </span>
                                <input
                                    type="text"
                                    className={`w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white rounded-lg p-1.5 text-slate-700 text-sm transition-all ${item.correctAnswer === opt ? 'font-semibold text-green-700 bg-green-50/30' : ''}`}
                                    value={item[`choice${opt}` as keyof McqData] as string}
                                    onChange={(e) => onUpdate(item.id, `choice${opt}` as keyof McqData, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                  </td>

                  {/* Correct Answer Select */}
                  <td className="p-4 align-top">
                    <select
                        value={item.correctAnswer}
                        onChange={(e) => onUpdate(item.id, 'correctAnswer', e.target.value)}
                        className={`w-full p-2 rounded-lg font-bold text-center border cursor-pointer transition-all
                            ${item.correctAnswer ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200 hover:border-slate-300'}
                        `}
                    >
                        <option value="">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                    </select>
                  </td>

                  {/* Passage Input */}
                  <td className="p-2 align-top">
                    <textarea
                      className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg p-2 text-slate-500 text-xs resize-y min-h-[80px] transition-all italic"
                      value={item.passage || ''}
                      onChange={(e) => onUpdate(item.id, 'passage', e.target.value)}
                      placeholder="Passage context..."
                    />
                  </td>

                  {/* Delete Action */}
                  <td className="p-4 align-middle text-center">
                    <button
                        onClick={() => onDelete(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                        title="Delete Question"
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