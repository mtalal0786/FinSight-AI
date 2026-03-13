"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface Props {
  onUpload: (docId: string, filename: string) => void;
}

type UploadResponse = {
  doc_id: string;
  chunks_stored: number;
};

export default function FileUpload({ onUpload }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ name: string; docId: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }

    setUploading(true);

    try {
      const result = (await api.docs.upload(file)) as UploadResponse;

      setUploaded({
        name: file.name,
        docId: result.doc_id,
      });

      onUpload(result.doc_id, file.name);

      toast.success(`✅ ${file.name} uploaded — ${result.chunks_stored} chunks indexed`);

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      {uploaded ? (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <CheckCircle className="text-emerald-400 shrink-0" size={20} />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-400 truncate">
              {uploaded.name}
            </p>

            <p className="text-xs text-gray-400 font-mono truncate">
              {uploaded.docId}
            </p>
          </div>

          <button
            onClick={() => setUploaded(null)}
            className="text-gray-500 hover:text-gray-300 transition shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);

            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
            dragging
              ? "border-emerald-400 bg-emerald-500/10"
              : "border-gray-700 hover:border-gray-500"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-emerald-400" size={28} />
              <p className="text-sm text-gray-400">Indexing document...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                <Upload className="text-gray-500" size={24} />
                <FileText className="text-gray-500" size={24} />
              </div>

              <p className="text-sm font-medium text-gray-300">
                Drop PDF here or click to browse
              </p>

              <p className="text-xs text-gray-500">
                Annual reports, 10-K, earnings, bank statements
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}