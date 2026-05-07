from fastapi import APIRouter

from app.api.v1.endpoints import auth, business, deadlines

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(business.router)
api_router.include_router(deadlines.router)
