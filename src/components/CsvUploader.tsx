'use client';

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  AlertCircle,
  Sparkles,
  Hash,
  Database,
  ArrowRight,
  Code,
  Layers,
} from 'lucide-react';
import { CsvParseResult } from '@/types/automation';
import { parseCsv, parseFileBuffer, parseExcelBuffer, SAMPLE_CSV_DATASETS } from '@/lib/csv-parser';

interface CsvUploaderProps {
  parseResult: CsvParseResult | null;
  onCsvParsed: (result: CsvParseResult) => void;
  onVariableClick?: (varName: string) => void;
  onSelectRecipientColumn?: (column: string) => void;
}

export function CsvUploader({
  parseResult,
  onCsvParsed,
  onVariableClick,
  onSelectRecipientColumn,
}: CsvUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteText, setShowPasteText] = useState(false);
  const [pastedContent, setPastedContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const result = parseFileBuffer(buffer, file.name);
      onCsvParsed(result);
      setIsProcessing(false);
    };

    reader.onerror = () => {
      onCsvParsed({
        headers: [],
        recipientColumn: null,
        rows: [],
        totalRows: 0,
        validRowsCount: 0,
        errors: ['Failed to read file. Please check file permissions or formatting.'],
        filename: file.name,
      });
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSheetChange = (sheetName: string) => {
    if (!parseResult || !parseResult.rawBuffer || !parseResult.filename) return;
    setIsProcessing(true);
    const updated = parseFileBuffer(parseResult.rawBuffer, parseResult.filename, sheetName);
    onCsvParsed(updated);
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedContent.trim()) return;
    setIsProcessing(true);
    const result = parseCsv(pastedContent, 'pasted_data.csv');
    onCsvParsed(result);
    setIsProcessing(false);
    setShowPasteText(false);
  };

  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_CSV_DATASETS.find((s) => s.id === sampleId);
    if (sample) {
      setIsProcessing(true);
      const result = parseCsv(sample.csv, `${sample.id}.csv`);
      onCsvParsed(result);
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f05a28]/15 border border-[#f05a28]/35 flex items-center justify-center text-[#ff8c5a] font-bold shadow-inner">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Step 1: File Upload (CSV & XLSX)</span>
              {parseResult && parseResult.validRowsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] text-xs border border-[#10b981]/30 font-mono font-semibold">
                  {parseResult.validRowsCount} Rows ({parseResult.fileType ? parseResult.fileType.toUpperCase() : 'DATA'})
                </span>
              )}
            </h2>
            <p className="text-xs text-white/50">
              Upload a CSV or Excel (.xlsx / .xls) file to auto-detect column headers as dynamic variable tags.
            </p>
          </div>
        </div>

        {/* Preset Sample CSV Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/60 flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-[#ff8c5a]" />
            Quick Presets:
          </span>
          {SAMPLE_CSV_DATASETS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleLoadSample(sample.id)}
              className="px-2.5 py-1 text-xs rounded-lg bg-[#0d2530] hover:bg-[#f05a28]/20 hover:border-[#f05a28]/50 border border-white/10 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
              title={sample.description}
            >
              <Database className="w-3 h-3 text-[#ff8c5a]" />
              <span>{sample.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Upload Drop Zone / Raw Text Input */}
      {!showPasteText ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#f05a28] bg-[#f05a28]/10 scale-[1.005]'
              : 'border-white/10 hover:border-[#f05a28]/50 bg-[#081419]/70 hover:bg-[#081419]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#0d2530] flex items-center justify-center text-[#ff8c5a] group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Drag & drop your CSV or Excel (.xlsx / .xls) file here, or{' '}
                <span className="text-[#ff8c5a] underline underline-offset-4">browse files</span>
              </p>
              <p className="text-xs text-white/50 mt-1">
                Supports .csv, .xlsx, and .xls spreadsheets with column header rows
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPasteText(true);
                }}
                className="text-xs text-slate-300 hover:text-[#ff8c5a] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d2530] hover:bg-[#081419] border border-white/10 transition-colors"
              >
                <Code className="w-3.5 h-3.5 text-[#06b6d4]" />
                <span>Paste raw text data instead</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 bg-[#081419] p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-[#06b6d4]" />
              Paste CSV / Text Raw Data (First row must be headers):
            </label>
            <button
              onClick={() => setShowPasteText(false)}
              className="text-xs text-white/50 hover:text-white"
            >
              Cancel & Upload File
            </button>
          </div>
          <textarea
            value={pastedContent}
            onChange={(e) => setPastedContent(e.target.value)}
            rows={5}
            placeholder={`name,phone,result\nSarah,+12025550143,Passed\nMohamed,+201234567890,Passed`}
            className="w-full bg-[#0d2530] border border-white/10 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-[#f05a28]"
          />
          <div className="flex justify-end">
            <button
              onClick={handlePasteSubmit}
              disabled={!pastedContent.trim() || isProcessing}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#f05a28] hover:bg-[#e04d1e] text-white disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <span>Parse Content</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Excel Sheet Selector Dropdown (If uploaded XLSX has multiple sheets) */}
      {parseResult && parseResult.availableSheets && parseResult.availableSheets.length > 1 && (
        <div className="p-3.5 rounded-xl bg-[#081419] border border-[#06b6d4]/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-white">
            <Layers className="w-4 h-4 text-[#06b6d4] shrink-0" />
            <span className="font-semibold">Excel Workbook Multi-Sheet Support:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/50">Active Sheet:</span>
            <select
              value={parseResult.selectedSheet || parseResult.availableSheets[0]}
              onChange={(e) => handleSheetChange(e.target.value)}
              className="bg-[#0d2530] border border-white/10 text-[#06b6d4] font-bold text-xs rounded-lg px-3 py-1 font-mono focus:outline-none focus:border-[#06b6d4]"
            >
              {parseResult.availableSheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Validation Errors Box */}
      {parseResult && parseResult.errors.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>File Parsing Validation Warnings:</span>
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 pl-1 text-rose-300/90">
            {parseResult.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Detected Column Headers & Variables Section */}
      {parseResult && parseResult.headers.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#081419] p-4 rounded-xl border border-white/10">
            <div>
              <span className="text-xs text-white/50 uppercase tracking-wider font-mono font-semibold">
                {parseResult.fileType ? parseResult.fileType.toUpperCase() : 'FILE'} Headers Detected
              </span>
              <p className="text-sm font-semibold text-white mt-0.5 flex items-center gap-2">
                <span>{parseResult.headers.length} Dynamic Variables Available</span>
                <span className="text-xs font-normal text-white/50 font-mono">
                  ({parseResult.filename})
                </span>
              </p>
            </div>

            {/* Recipient Column Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/60 whitespace-nowrap">
                Recipient Contact Column:
              </label>
              <select
                value={parseResult.recipientColumn || parseResult.headers[0]}
                onChange={(e) => onSelectRecipientColumn && onSelectRecipientColumn(e.target.value)}
                className="bg-[#0d2530] border border-white/10 text-[#10b981] text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-[#10b981]"
              >
                {parseResult.headers.map((header) => (
                  <option key={header} value={header}>
                    {header} {header === parseResult.recipientColumn ? '(Auto-Detected)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Variable Badges / Pills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#ff8c5a]" />
                Click a variable pill below to insert into message template:
              </span>
              <span className="text-[11px] text-white/40 font-mono">
                Double Curly Bracket &#123;&#123;var&#125;&#125;
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {parseResult.headers.map((header) => {
                const isRecipient = header === parseResult.recipientColumn;
                const sampleVal = parseResult.rows[0]?.[header] || 'Sample';
                return (
                  <button
                    key={header}
                    onClick={() => onVariableClick && onVariableClick(header)}
                    className={`group px-3 py-1.5 rounded-xl border text-xs font-mono transition-all flex items-center gap-2 ${
                      isRecipient
                        ? 'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] hover:bg-[#10b981]/25'
                        : 'bg-[#f05a28]/15 border-[#f05a28]/35 text-[#ff8c5a] hover:bg-[#f05a28]/25 hover:border-[#f05a28]/60'
                    }`}
                    title={`Sample value: "${sampleVal}". Click to insert {{${header}}}`}
                  >
                    <span className="font-semibold text-white">
                      &#123;&#123;{header}&#125;&#125;
                    </span>
                    <span className="text-[10px] text-white/50 max-w-[100px] truncate">
                      ({sampleVal})
                    </span>
                    {isRecipient && (
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-[#10b981]/20 text-[#10b981] uppercase font-semibold">
                        Recipient
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sample Rows Table Preview */}
          {parseResult.rows.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50 font-medium">
                  File Data Sample (First 3 of {parseResult.rows.length} rows):
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#081419]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0d2530] text-slate-200 border-b border-white/10">
                    <tr>
                      <th className="p-2.5 font-semibold text-white/50"># Row</th>
                      {parseResult.headers.map((h) => (
                        <th
                          key={h}
                          className={`p-2.5 font-semibold ${
                            h === parseResult.recipientColumn
                              ? 'text-[#10b981] bg-[#10b981]/5'
                              : 'text-slate-200'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {parseResult.rows.slice(0, 3).map((row, idx) => (
                      <tr key={row.__id} className="hover:bg-white/5">
                        <td className="p-2.5 text-white/40 font-semibold">{idx + 1}</td>
                        {parseResult.headers.map((h) => (
                          <td
                            key={h}
                            className={`p-2.5 max-w-[180px] truncate ${
                              h === parseResult.recipientColumn
                                ? 'text-[#10b981] font-medium bg-[#10b981]/5'
                                : 'text-slate-200'
                            }`}
                          >
                            {row[h] || <span className="text-white/30 font-sans italic">N/A</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
