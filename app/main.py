from fastapi import FastAPI
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Request

from app.routers.game import router as game_router

app = FastAPI(title="GeoGuessr Clone API")
app.include_router(game_router)

templates = Jinja2Templates(directory="app/templates")

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )

@app.get("/")
def root():
    return {"message": "GeoGuessr clone API is running"}
