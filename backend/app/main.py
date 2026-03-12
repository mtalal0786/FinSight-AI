from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.routers import documents
from app.routers import auth, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"\n🚀 Starting {settings.APP_NAME} v0.3.0")
    print(f"🤖 LLM:        {settings.GEMINI_MODEL}")
    print(f"🔢 Embeddings: {settings.EMBEDDING_PROVIDER}")
    print(f"🌐 Web Search: {'Tavily + DuckDuckGo' if settings.TAVILY_API_KEY else 'DuckDuckGo only (free)'}")
    print(f"📈 Alpha Vantage: {'Enabled' if settings.ALPHA_VANTAGE_KEY else 'Demo mode (limited)'}")

    # Init DB
    await init_db()

    # Test embeddings
    try:
        from app.services.rag_service import get_embeddings
        emb = get_embeddings()
        test = emb.embed_query("startup test")
        print(f"✅ Embeddings OK — vector size: {len(test)}")
    except Exception as e:
        print(f"❌ Embedding error: {e}")

    print(f"\n📖 API Docs: http://localhost:8000/docs\n")
    yield
    print("👋 Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="""
## FinSight AI — Financial Intelligence Platform

### Capabilities
- 📄 **RAG**: Ask questions about uploaded financial PDFs
- 🤖 **Agentic RAG**: Multi-tool intelligent research agent
- 📈 **Live Stock Data**: Real-time prices via Yahoo Finance
- 📰 **Financial News**: Latest articles via DuckDuckGo
- 🔍 **Web Search**: Market sentiment and analysis
- 📊 **Fundamentals**: Deep analysis via Alpha Vantage
- 🌊 **Streaming**: Real-time response streaming
- 🔐 **Auth**: JWT-based user accounts
""",
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(documents.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(history.router, prefix="/api/v1")


@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "running",
        "app": settings.APP_NAME,
        "version": "0.3.0",
        "endpoints": {
            "upload_pdf":     "POST /api/v1/documents/upload",
            "simple_query":   "POST /api/v1/documents/query",
            "agent_query":    "POST /api/v1/documents/agent/query",
            "stream_query":   "POST /api/v1/documents/agent/stream",
            "register":       "POST /api/v1/auth/register",
            "login":          "POST /api/v1/auth/login",
            "query_history":  "GET  /api/v1/history/queries",
            "docs":           "GET  /docs",
        },
    }


@app.get("/health", tags=["Health"])
async def health():
    return JSONResponse({"status": "healthy", "version": "0.3.0"})