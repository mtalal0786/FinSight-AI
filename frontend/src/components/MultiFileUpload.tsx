"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, FileText, CheckCircle, Loader2, X, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { store } from "@/lib/store";

interface UploadedFile {
  doc_id: string;
  filename: string;
  pages: number;
  chunks: number;
  status: "success" | "error";
  error?: string;
}

interface Props {
  onUpload: (docs: { doc_id: string; filename: string }[]) => void;
}

export default function MultiFileUpload({ onUpload }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith(".pdf"));
    const rejected = files.filter(f => !f.name.toLowerCase().endsWith(".pdf"));
    if (rejected.length) toast.error(`${rejected.length} file(s) skipped — PDFs only`);
    if (!pdfs.length) return;

    setUploading(true);
    setProgress(0);

    const addUploadedDocs = (docs: { doc_id: string; filename: string }[]) => {
      onUpload(docs);
    };

    if (pdfs.length === 1) {
      // Single file
      try {
        const result = await api.docs.upload(pdfs[0]) as { doc_id: string; pages_loaded: number; chunks_stored: number };
        const uploaded: UploadedFile = {
          doc_id: result.doc_id,
          filename: pdfs[0].name,
          pages: result.pages_loaded,
          chunks: result.chunks_stored,
          status: "success",
        };
        setUploadedFiles(prev => [uploaded, ...prev]);
        store.addDoc({ doc_id: result.doc_id, filename: pdfs[0].name, pages: result.pages_loaded, chunks: result.chunks_stored, uploaded_at: new Date().toISOString() });
        addUploadedDocs([{ doc_id: result.doc_id, filename: pdfs[0].name }]);
        toast.success(`✅ ${pdfs[0].name} — ${result.chunks_stored} chunks indexed`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    } else {
      // Batch upload
      const batchSize = 3;
      const results: UploadedFile[] = [];
      const successfulDocs: { doc_id: string; filename: string }[] = [];

      for (let i = 0; i < pdfs.length; i += batchSize) {
        const batch = pdfs.slice(i, i + batchSize);
        try {
          const res = await api.docs.uploadBatch(batch) as { results: Array<{ doc_id: string; filename: string; pages_loaded: number; chunks_stored: number }>; errors: Array<{ filename: string; error: string }> };
          res.results.forEach(r => {
            results.push({ doc_id: r.doc_id, filename: r.filename, pages: r.pages_loaded, chunks: r.chunks_stored, status: "success" });
            store.addDoc({ doc_id: r.doc_id, filename: r.filename, pages: r.pages_loaded, chunks: r.chunks_stored, uploaded_at: new Date().toISOString() });
            successfulDocs.push({ doc_id: r.doc_id, filename: r.filename });
          });
          res.errors.forEach(e => results.push({ doc_id: "", filename: e.filename, pages: 0, chunks: 0, status: "error", error: e.error }));
        } catch (e: unknown) {
          batch.forEach(f => results.push({ doc_id: "", filename: f.name, pages: 0, chunks: 0, status: "error", error: "Upload failed" }));
        }
        setProgress(Math.round(((i + batchSize) / pdfs.length) * 100));
      }

      setUploadedFiles(prev => [...results, ...prev]);
      addUploadedDocs(successfulDocs);
      const ok = results.filter(r => r.status === "success").length;
      toast.success(`${ok}/${pdfs.length} files uploaded successfully`);
    }

    setUploading(false);
    setProgress(0);
  }, [onUpload]);

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(Array.from(e.dataTransfer.files)); }}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${dragging ? "border-emerald-400 bg-emerald-500/10" : "border-gray-700 hover:border-gray-500"}`}
      >
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="animate-spin text-emerald-400 mx-auto" size={24} />
            <p className="text-sm text-gray-400">Indexing documents...</p>
            {progress > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="text-gray-500" size={22} />
            <p className="text-sm font-medium text-gray-300">Drop PDFs here or click to browse</p>
            <p className="text-xs text-gray-500">Multiple files supported · Max 10 per batch · PDF only</p>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
        onChange={e => { const files = Array.from(e.target.files || []); if (files.length) processFiles(files); e.target.value = ""; }} />

      {uploadedFiles.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {uploadedFiles.map((f, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${f.status === "success" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
              {f.status === "success" ? <CheckCircle size={14} className="text-emerald-400 shrink-0" /> : <AlertCircle size={14} className="text-red-400 shrink-0" />}
              <span className="flex-1 truncate text-gray-300">{f.filename}</span>
              {f.status === "success" && <span className="text-gray-500 shrink-0">{f.chunks} chunks</span>}
              {f.status === "error" && <span className="text-red-400 shrink-0 truncate max-w-[100px]">{f.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
