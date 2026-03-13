# import shutil
# import uuid
# import json
# from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
# from fastapi.responses import JSONResponse, StreamingResponse
# from pydantic import BaseModel
# from sqlalchemy.ext.asyncio import AsyncSession
# from typing import Optional, AsyncGenerator

# from app.core.config import settings
# from app.core.database import get_db
# from app.services.rag_service import rag_service
# from app.agents.react_agent import run_agentic_query
# from app.models.db_models import QueryHistory, DocumentRecord

# router = APIRouter(prefix="/documents", tags=["Documents"])


# class QueryRequest(BaseModel):
#     question: str
#     doc_id: Optional[str] = None
#     k: int = 5


# class AgentQueryRequest(BaseModel):
#     query: str
#     doc_id: Optional[str] = None


# class QueryResponse(BaseModel):
#     question: str
#     answer: str
#     sources: list[dict]
#     doc_id: Optional[str]


# # ── Upload ────────────────────────────────────────────────────────────────────

# @router.post("/upload", summary="Upload a financial PDF")
# async def upload_document(
#     file: UploadFile = File(...),
#     db: AsyncSession = Depends(get_db),
# ):
#     if not file.filename or not file.filename.lower().endswith(".pdf"):
#         raise HTTPException(status_code=400, detail="Only PDF files supported.")

#     upload_dir = settings.get_upload_path()
#     doc_id = str(uuid.uuid4())
#     safe_name = f"{doc_id}_{file.filename.replace(' ', '_')}"
#     file_path = upload_dir / safe_name

#     try:
#         with open(file_path, "wb") as buffer:
#             shutil.copyfileobj(file.file, buffer)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

#     try:
#         result = await rag_service.ingest_pdf(file_path, doc_id=doc_id)
#     except Exception as e:
#         file_path.unlink(missing_ok=True)
#         raise HTTPException(status_code=500, detail=f"Failed to process PDF: {e}")

#     # Save to DB (no user required — works for both auth and anonymous)
#     try:
#         doc_record = DocumentRecord(
#             doc_id=doc_id,
#             filename=file.filename,
#             pages=result.get("pages_loaded", 0),
#             chunks=result.get("chunks_stored", 0),
#         )
#         db.add(doc_record)
#         await db.commit()
#     except Exception:
#         pass  # DB save is non-critical

#     return JSONResponse(content=result, status_code=201)


# # ── Simple RAG Query ──────────────────────────────────────────────────────────

# @router.post("/query", response_model=QueryResponse, summary="Simple RAG query")
# async def query_documents(request: QueryRequest):
#     if not request.question.strip():
#         raise HTTPException(status_code=400, detail="Question cannot be empty.")

#     try:
#         result = await rag_service.query_document(
#             question=request.question,
#             doc_id=request.doc_id,
#             k=request.k,
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Query failed: {e}")

#     return result


# # ── Agentic RAG Query ─────────────────────────────────────────────────────────

# @router.post("/agent/query", summary="🤖 Agentic RAG — smart multi-tool query")
# async def agent_query(
#     request: AgentQueryRequest,
#     db: AsyncSession = Depends(get_db),
# ):
#     if not request.query.strip():
#         raise HTTPException(status_code=400, detail="Query cannot be empty.")

#     try:
#         result = await run_agentic_query(
#             user_query=request.query,
#             doc_id=request.doc_id,
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Agent query failed: {e}")

#     # Save to query history
#     try:
#         history = QueryHistory(
#             query=request.query,
#             answer=result.get("answer", ""),
#             tools_used=",".join(result.get("tools_used", [])),
#             reasoning=result.get("reasoning", ""),
#             llm_calls=result.get("llm_calls", 0),
#         )
#         db.add(history)
#         await db.commit()
#     except Exception:
#         pass  # Non-critical

#     return JSONResponse(content=result)


# # ── Streaming Agentic Query ───────────────────────────────────────────────────

# @router.post("/agent/stream", summary="🌊 Streaming Agentic RAG — real-time token output")
# async def agent_stream(request: AgentQueryRequest):
#     """
#     Server-Sent Events streaming endpoint.
#     Frontend receives tokens as they generate — no waiting for full response.
#     """
#     if not request.query.strip():
#         raise HTTPException(status_code=400, detail="Query cannot be empty.")

#     async def event_generator() -> AsyncGenerator[str, None]:
#         try:
#             # Step 1: Send status updates while agent works
#             yield f"data: {json.dumps({'type': 'status', 'message': '🔍 Analyzing your query...'})}\n\n"

#             result = await run_agentic_query(
#                 user_query=request.query,
#                 doc_id=request.doc_id,
#             )

#             tools_str = ", ".join(result.get("tools_used", []))
#             yield f"data: {json.dumps({'type': 'status', 'message': f'🛠️ Used tools: {tools_str}'})}\n\n"
#             yield f"data: {json.dumps({'type': 'reasoning', 'content': result.get('reasoning', '')})}\n\n"

#             # Step 2: Stream the answer word by word
#             answer = result.get("answer", "")
#             words = answer.split(" ")
#             for i, word in enumerate(words):
#                 chunk = word + (" " if i < len(words) - 1 else "")
#                 yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

#             # Step 3: Send metadata at end
#             yield f"data: {json.dumps({'type': 'done', 'metadata': {'tools_used': result.get('tools_used', []), 'llm_calls': result.get('llm_calls', 0), 'sub_queries': result.get('sub_queries', [])}})}\n\n"

#         except Exception as e:
#             yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

#     return StreamingResponse(
#         event_generator(),
#         media_type="text/event-stream",
#         headers={
#             "Cache-Control": "no-cache",
#             "X-Accel-Buffering": "no",
#         },
#     )


# # ── Status ────────────────────────────────────────────────────────────────────

# @router.get("/status", summary="Vector store + DB status")
# async def get_status(db: AsyncSession = Depends(get_db)):
#     try:
#         rag_status = rag_service.list_documents()
#         return {**rag_status, "database": "connected"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

import shutil
import uuid
import json
from typing import Optional, AsyncGenerator, List, Union
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.config import settings
from app.core.database import get_db
from app.services.rag_service import rag_service
from app.agents.react_agent import run_agentic_query
from app.models.db_models import QueryHistory, DocumentRecord
from app.routers.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])


class QueryRequest(BaseModel):
    question: str
    doc_id: Optional[Union[str, List[str]]] = None
    k: int = 5


class AgentQueryRequest(BaseModel):
    query: str
    doc_id: Optional[Union[str, List[str]]] = None


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = None,
):
    """Returns user if token provided, None otherwise."""
    if not token:
        return None
    try:
        from app.services.auth_service import decode_token, get_user_by_email
        payload = decode_token(token)
        if payload:
            return await get_user_by_email(db, payload["sub"])
    except Exception:
        pass
    return None


# ── Single upload ─────────────────────────────────────────────────────────────

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
        pass

    return JSONResponse(content=result, status_code=201)


# ── Multi-file upload ─────────────────────────────────────────────────────────

@router.post("/upload/batch", summary="Upload multiple PDFs at once")
async def upload_batch(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Max 10 files per batch.")

    results = []
    errors = []
    upload_dir = settings.get_upload_path()

    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            errors.append({"filename": file.filename, "error": "Not a PDF"})
            continue

        doc_id = str(uuid.uuid4())
        safe_name = f"{doc_id}_{file.filename.replace(' ', '_')}"
        file_path = upload_dir / safe_name

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            result = await rag_service.ingest_pdf(file_path, doc_id=doc_id)

            doc_record = DocumentRecord(
                doc_id=doc_id,
                filename=file.filename,
                pages=result.get("pages_loaded", 0),
                chunks=result.get("chunks_stored", 0),
            )
            db.add(doc_record)
            results.append(result)
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})
            file_path.unlink(missing_ok=True)

    await db.commit()

    return JSONResponse(content={
        "uploaded": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }, status_code=201)


# ── List all documents ────────────────────────────────────────────────────────

@router.get("/list", summary="List all uploaded documents")
async def list_documents(db: AsyncSession = Depends(get_db)):
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
                "pages": d.pages,
                "chunks": d.chunks,
                "uploaded_at": d.uploaded_at.isoformat(),
            }
            for d in docs
        ],
    }


# ── Delete document ───────────────────────────────────────────────────────────

@router.delete("/delete/{doc_id}", summary="Delete a document")
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DocumentRecord).where(DocumentRecord.doc_id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # Remove from vector store
        from app.services.rag_service import get_vector_store
        vs = get_vector_store()
        vs._collection.delete(where={"doc_id": doc_id})
    except Exception:
        pass

    await db.delete(doc)
    await db.commit()
    return {"message": f"Document {doc_id} deleted", "doc_id": doc_id}


# ── Simple RAG query ──────────────────────────────────────────────────────────

@router.post("/query", summary="Simple RAG query")
async def query_documents(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    doc_ids = (
        request.doc_id
        if isinstance(request.doc_id, list)
        else ([request.doc_id] if request.doc_id else None)
    )

    try:
        result = await rag_service.query_document(
            question=request.question,
            doc_ids=doc_ids,
            k=request.k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
    return result


# ── Agentic query (saves to history) ─────────────────────────────────────────

@router.post("/agent/query", summary="Agentic RAG — multi-tool query")
async def agent_query(
    request: AgentQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    doc_ids = (
        request.doc_id
        if isinstance(request.doc_id, list)
        else ([request.doc_id] if request.doc_id else None)
    )

    try:
        result = await run_agentic_query(
            user_query=request.query,
            doc_id=doc_ids,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent query failed: {e}")

    # ✅ Save to history WITHOUT requiring auth
    try:
        history = QueryHistory(
            user_id=None,  # anonymous — history router filters correctly now
            query=request.query,
            answer=result.get("answer", ""),
            tools_used=",".join(result.get("tools_used", [])),
            reasoning=result.get("reasoning", ""),
            llm_calls=result.get("llm_calls", 0),
        )
        db.add(history)
        await db.commit()
    except Exception as e:
        print(f"⚠️ History save failed: {e}")

    return JSONResponse(content=result)


# ── Streaming agentic query ───────────────────────────────────────────────────

@router.post("/agent/stream", summary="Streaming agentic RAG")
async def agent_stream(request: AgentQueryRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': '🔍 Analyzing your query...'})}\n\n"

            doc_ids = (
                request.doc_id
                if isinstance(request.doc_id, list)
                else ([request.doc_id] if request.doc_id else None)
            )
            result = await run_agentic_query(
                user_query=request.query,
                doc_id=doc_ids,
            )

            tools_str = ", ".join(result.get("tools_used", []))
            yield f"data: {json.dumps({'type': 'status', 'message': f'🛠️ Tools: {tools_str}'})}\n\n"
            yield f"data: {json.dumps({'type': 'reasoning', 'content': result.get('reasoning', '')})}\n\n"

            answer = result.get("answer", "")
            words = answer.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'metadata': {'tools_used': result.get('tools_used', []), 'llm_calls': result.get('llm_calls', 0), 'sub_queries': result.get('sub_queries', []), 'reasoning': result.get('reasoning', '')}})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status", summary="Vector store + DB status")
async def get_status(db: AsyncSession = Depends(get_db)):
    try:
        rag_status = rag_service.list_documents()
        doc_count = await db.execute(select(DocumentRecord))
        return {**rag_status, "database": "connected", "db_doc_count": len(doc_count.scalars().all())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))