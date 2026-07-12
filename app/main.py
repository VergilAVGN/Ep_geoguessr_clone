from fastapi import FastAPI
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Request
from fastapi.staticfiles import StaticFiles
import os

from app.routers.game import router as game_router
from app.routers.orbit import router as orbit_router
from app.routers.settings import router as settings_router

app = FastAPI(title="GeoGuessr Clone API")
app.include_router(game_router)
app.include_router(orbit_router)
app.include_router(settings_router)

static_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

templates = Jinja2Templates(directory="app/templates")


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/classic_game", response_class=HTMLResponse)
def classic_game(request: Request):
    return templates.TemplateResponse(request=request, name="classic_game.html")


@app.get("/orbit_game", response_class=HTMLResponse)
def orbit_game(request: Request):
    return templates.TemplateResponse(request=request, name="orbit_game.html")


@app.get("/settings", response_class=HTMLResponse)
def settings(request: Request):
    return templates.TemplateResponse(request=request, name="settings.html")


@app.get("/api/health")
def root():
    return {"message": "GeoGuessr clone API is running"}
