from pathlib import Path
from typing import Optional
import uuid


from langchain_google_genai import (
    ChatGoogleGenerativeAI,
    GoogleGenerativeAIEmbeddings,
)

from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.embeddings.base import Embeddings
# ✅ FIXED IMPORT
from langchain_classic.chains import RetrievalQA

from langchain_core.prompts import PromptTemplate

from app.core.config import settings


# ── Embedding Factory ─────────────────────────────────────────────────────────

def get_embeddings():
    """
    HuggingFace embeddings — free, local, no API key needed.
    Downloads ~90MB model on first run, then cached forever.
    """
    from langchain_huggingface import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.3,
        convert_system_message_to_human=True,
    )


def get_vector_store(collection_name: str = "finsight_docs") -> Chroma:
    return Chroma(
        collection_name=collection_name,
        embedding_function=get_embeddings(),
        persist_directory=settings.get_chroma_path(),
    )


# ── Finance Prompt ────────────────────────────────────────────────────────────

FINANCE_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""You are FinSight AI, an expert financial analyst assistant.
Use ONLY the provided document context to answer the question.
Be precise, cite specific figures and sections when available, and flag any risks.

If the context does not contain enough information, clearly say so — never make up numbers.

Context:
{context}

Question: {question}

Answer (structured and professional):""",
)


# ── RAG Service ───────────────────────────────────────────────────────────────

class RAGService:

    def __init__(self):
        self.llm = get_llm()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    async def ingest_pdf(self, file_path: Path, doc_id: Optional[str] = None) -> dict:
        if not file_path.exists():
            raise FileNotFoundError(f"PDF not found: {file_path}")

        doc_id = doc_id or str(uuid.uuid4())

        loader = PyPDFLoader(str(file_path))
        pages = loader.load()

        if not pages:
            raise ValueError("PDF appears to be empty or unreadable.")

        chunks = self.text_splitter.split_documents(pages)

        for chunk in chunks:
            chunk.metadata["doc_id"] = doc_id
            chunk.metadata["source_file"] = file_path.name

        vector_store = get_vector_store()
        vector_store.add_documents(chunks)

        return {
            "doc_id": doc_id,
            "filename": file_path.name,
            "pages_loaded": len(pages),
            "chunks_stored": len(chunks),
            "status": "success",
            "embedding_provider": "huggingface (all-MiniLM-L6-v2)",
        }

    async def query_document(
        self,
        question: str,
        doc_id: Optional[str] = None,
        k: int = 5,
    ) -> dict:
        vector_store = get_vector_store()

        search_kwargs: dict = {"k": k}
        if doc_id:
            search_kwargs["filter"] = {"doc_id": doc_id}

        retriever = vector_store.as_retriever(
            search_type="similarity",
            search_kwargs=search_kwargs,
        )

        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True,
            chain_type_kwargs={"prompt": FINANCE_PROMPT},
        )

        result = qa_chain.invoke({"query": question})

        sources = []
        for doc in result.get("source_documents", []):
            sources.append({
                "page": doc.metadata.get("page", "unknown"),
                "source_file": doc.metadata.get("source_file", "unknown"),
                "snippet": doc.page_content[:200] + "...",
            })

        return {
            "question": question,
            "answer": result["result"],
            "sources": sources,
            "doc_id": doc_id,
        }

    def list_documents(self) -> dict:
        vector_store = get_vector_store()
        collection = vector_store._collection
        count = collection.count()
        return {
            "total_chunks": count,
            "embedding_provider": "huggingface (all-MiniLM-L6-v2)",
            "status": "connected",
        }


rag_service = RAGService()