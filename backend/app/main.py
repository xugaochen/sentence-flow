from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .migrations import ensure_schema
from .routers import meta, reviews, sentences, words


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)
    yield


app = FastAPI(
    title="句流 Language Study API",
    description="以主动输出为核心的个人句子学习 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sentences.router, prefix="/api")
app.include_router(words.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(meta.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
