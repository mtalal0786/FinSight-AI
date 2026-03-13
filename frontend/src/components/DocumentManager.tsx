"use client";
import { useEffect, useState } from "react";
import { FileText, Trash2, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { store } from "@/lib/store";
import toast from "react-hot-toast";

interface Doc {
    doc_id: string;
    filename: string;
    pages: number;
    chunks: number;
    uploaded_at: string;
}

interface Props {
    onSelect: (doc: Doc) => void;
    activeDocIds?: string[];
}

export default function DocumentManager({ onSelect, activeDocIds }: Props) {
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const data = await api.docs.list() as { documents: Doc[] };
            setDocs(data.documents);
            data.documents.forEach(d => store.addDoc(d));
        } catch {
            // Fallback to local store
            setDocs(store.getDocs());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDocs(); }, []);

    const handleDelete = async (doc_id: string, filename: string) => {
        setDeleting(doc_id);
        try {
            await api.docs.delete(doc_id);
            store.removeDoc(doc_id);
            setDocs(prev => prev.filter(d => d.doc_id !== doc_id));
            toast.success(`${filename} deleted`);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Documents</h3>
                <button onClick={fetchDocs} className="text-gray-500 hover:text-gray-300 transition">
                    <RefreshCw size={14} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-gray-500" size={20} />
                </div>
            ) : docs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No documents yet. Upload a PDF above.</p>
            ) : (
                <div className="space-y-2">
                    {docs.map(doc => {
                        const isActive = activeDocIds?.includes(doc.doc_id);

                        return (
                            <div
                                key={doc.doc_id}
                                className={`group flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition ${isActive
                                        ? "bg-emerald-500/10 border-emerald-500/30"
                                        : "bg-gray-800/30 border-gray-700/50 hover:border-gray-600"
                                    }`}
                                onClick={() => onSelect(doc)}
                            >
                                {isActive ? (
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                    <FileText size={16} className="text-gray-500 shrink-0 mt-0.5" />
                                )}

                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-200 truncate">{doc.filename}</p>
                                    <p className="text-xs text-gray-500">
                                        {doc.pages}p · {doc.chunks} chunks
                                    </p>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(doc.doc_id, doc.filename);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition"
                                >
                                    {deleting === doc.doc_id ? (
                                        <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={13} />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}