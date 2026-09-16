from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .migrations import ensure_schema
from .routers import data, meta, reviews, sentences, words


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"


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
app.include_router(data.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIST / "assets", check_dir=False),
    name="frontend-assets",
)


@app.get("/{full_path:path}", include_in_schema=False)
async def frontend_app(full_path: str):
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="接口不存在")
    if not FRONTEND_INDEX.is_file():
        raise HTTPException(
            status_code=503,
            detail="前端尚未构建，请先运行 npm run build 或使用项目的一键启动脚本。",
        )
    return FileResponse(FRONTEND_INDEX)
