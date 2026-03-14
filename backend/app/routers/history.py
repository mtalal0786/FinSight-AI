from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models.db_models import QueryHistory, DocumentRecord

router = APIRouter(prefix="/history", tags=["History"])


def safe_preview(text: str | None, length: int = 300) -> str:
    """Safely create a preview — handles None and empty strings."""
    if not text:
        return ""
    text = text.strip()
    if len(text) <= length:
        return text
    return text[:length] + "..."


@router.get("/queries", summary="Get all query history")
async def get_query_history(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(QueryHistory)
        .order_by(desc(QueryHistory.created_at))
        .limit(limit)
    )
    queries = result.scalars().all()
    return {
        "total": len(queries),
        "queries": [
            {
                "id": q.id,
                "query": q.query or "",
                "answer": q.answer or "",
                "answer_preview": safe_preview(q.answer),
                "tools_used": q.tools_used or "",
                "reasoning": q.reasoning or "",
                "llm_calls": q.llm_calls or 0,
                "created_at": q.created_at.isoformat(),
            }
            for q in queries
        ],
    }


@router.get("/queries/{query_id}", summary="Get a single query with full answer")
async def get_query_detail(query_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(QueryHistory).where(QueryHistory.id == query_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Query not found")
    return {
        "id": q.id,
        "query": q.query or "",
        "answer": q.answer or "",
        "tools_used": q.tools_used or "",
        "reasoning": q.reasoning or "",
        "llm_calls": q.llm_calls or 0,
        "created_at": q.created_at.isoformat(),
    }


@router.delete("/queries/{query_id}", summary="Delete a query")
async def delete_query(query_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(QueryHistory).where(QueryHistory.id == query_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Query not found")
    await db.delete(q)
    await db.commit()
    return {"message": "Deleted", "id": query_id}


@router.get("/documents", summary="Get all uploaded documents")
async def get_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DocumentRecord).order_by(desc(DocumentRecord.uploaded_at))
    )
    docs = result.scalars().all()
    return {
        "total": len(docs),
        "documents": [
            {
                "doc_id": d.doc_id,
                "filename": d.filename,
                "pages": d.pages or 0,
                "chunks": d.chunks or 0,
                "uploaded_at": d.uploaded_at.isoformat(),
            }
            for d in docs
        ],
    }