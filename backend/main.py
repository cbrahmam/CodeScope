from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from config import settings
from database import init_db
from routers import reviews, analyze, comments, github
from socket_handlers.collaboration import sio


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="CodeScope API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reviews.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(github.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
app = socket_app
