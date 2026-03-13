from typing import Optional, Union
from app.services.rag_service import rag_service


async def search_documents(
    query: str,
    doc_id: Optional[Union[str, list[str]]] = None,
    top_k: int = 5,
) -> dict:
    try:
        result = await rag_service.query_document(
            question=query,
            doc_ids=doc_id,
            k=top_k,
        )
        return {
            "success": True,
            "query": query,
            "answer": result["answer"],
            "sources": result["sources"],
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "query": query,
        }


async def list_available_documents() -> dict:
    try:
        status = rag_service.list_documents()
        return {
            "success": True,
            "total_chunks": status["total_chunks"],
            "status": "Documents available" if status["total_chunks"] > 0 else "No documents uploaded yet",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}