import shutil
import uuid
import json
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, AsyncGenerator

from app.core.config import settings
from app.core.database import get_db
from app.services.rag_service import rag_service
from app.agents.react_agent import run_agentic_query
from app.models.db_models import QueryHistory, DocumentRecord

router = APIRouter(prefix="/documents", tags=["Documents"])


class QueryRequest(BaseModel):
    question: str
    doc_id: Optional[str] = None
    k: int = 5


class AgentQueryRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None


class QueryResponse(BaseModel):
    question: str
    answer: str
    sources: list[dict]
    doc_id: Optional[str]


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", summary="Upload a financial PDF")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files supported.")

    upload_dir = settings.get_upload_path()
    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}_{file.filename.replace(' ', '_')}"
    file_path = upload_dir / safe_name

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    try:
        result = await rag_service.ingest_pdf(file_path, doc_id=doc_id)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {e}")

    # Save to DB (no user required — works for both auth and anonymous)
    try:
        doc_record = DocumentRecord(
            doc_id=doc_id,
            filename=file.filename,
            pages=result.get("pages_loaded", 0),
            chunks=result.get("chunks_stored", 0),
        )
        db.add(doc_record)
        await db.commit()
    except Exception:
        pass  # DB save is non-critical

    return JSONResponse(content=result, status_code=201)


# ── Simple RAG Query ──────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse, summary="Simple RAG query")
async def query_documents(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = await rag_service.query_document(
            question=request.question,
            doc_id=request.doc_id,
            k=request.k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")

    return result


# ── Agentic RAG Query ─────────────────────────────────────────────────────────

@router.post("/agent/query", summary="🤖 Agentic RAG — smart multi-tool query")
async def agent_query(
    request: AgentQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        result = await run_agentic_query(
            user_query=request.query,
            doc_id=request.doc_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent query failed: {e}")

    # Save to query history
    try:
        history = QueryHistory(
            query=request.query,
            answer=result.get("answer", ""),
            tools_used=",".join(result.get("tools_used", [])),
            reasoning=result.get("reasoning", ""),
            llm_calls=result.get("llm_calls", 0),
        )
        db.add(history)
        await db.commit()
    except Exception:
        pass  # Non-critical

    return JSONResponse(content=result)


# ── Streaming Agentic Query ───────────────────────────────────────────────────

@router.post("/agent/stream", summary="🌊 Streaming Agentic RAG — real-time token output")
async def agent_stream(request: AgentQueryRequest):
    """
    Server-Sent Events streaming endpoint.
    Frontend receives tokens as they generate — no waiting for full response.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Step 1: Send status updates while agent works
            yield f"data: {json.dumps({'type': 'status', 'message': '🔍 Analyzing your query...'})}\n\n"

            result = await run_agentic_query(
                user_query=request.query,
                doc_id=request.doc_id,
            )

            tools_str = ", ".join(result.get("tools_used", []))
            yield f"data: {json.dumps({'type': 'status', 'message': f'🛠️ Used tools: {tools_str}'})}\n\n"
            yield f"data: {json.dumps({'type': 'reasoning', 'content': result.get('reasoning', '')})}\n\n"

            # Step 2: Stream the answer word by word
            answer = result.get("answer", "")
            words = answer.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            # Step 3: Send metadata at end
            yield f"data: {json.dumps({'type': 'done', 'metadata': {'tools_used': result.get('tools_used', []), 'llm_calls': result.get('llm_calls', 0), 'sub_queries': result.get('sub_queries', [])}})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status", summary="Vector store + DB status")
async def get_status(db: AsyncSession = Depends(get_db)):
    try:
        rag_status = rag_service.list_documents()
        return {**rag_status, "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))