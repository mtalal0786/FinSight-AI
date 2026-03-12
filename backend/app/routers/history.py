from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models.db_models import QueryHistory, DocumentRecord
from app.routers.auth import get_current_user
from app.models.db_models import User

router = APIRouter(prefix="/history", tags=["History"])


@router.get("/queries", summary="Get your query history")
async def get_query_history(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(QueryHistory)
        .where(QueryHistory.user_id == current_user.id)
        .order_by(desc(QueryHistory.created_at))
        .limit(limit)
    )
    queries = result.scalars().all()
    return {
        "total": len(queries),
        "queries": [
            {
                "id": q.id,
                "query": q.query,
                "answer_preview": q.answer[:200] + "...",
                "tools_used": q.tools_used,
                "llm_calls": q.llm_calls,
                "created_at": q.created_at.isoformat(),
            }
            for q in queries
        ],
    }


@router.get("/documents", summary="Get your uploaded documents")
async def get_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DocumentRecord)
        .where(DocumentRecord.user_id == current_user.id)
        .order_by(desc(DocumentRecord.uploaded_at))
    )
    docs = result.scalars().all()
    return {
        "total": len(docs),
        "documents": [
            {
                "doc_id": d.doc_id,
                "filename": d.filename,
                "pages": d.pages,
                "chunks": d.chunks,
                "uploaded_at": d.uploaded_at.isoformat(),
            }
            for d in docs
        ],
    }