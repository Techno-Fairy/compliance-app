from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    auth,
    business,
    deadlines,
    documents,
    history,
    knowledge,
    reports,
    team,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(business.router)
api_router.include_router(deadlines.router)
api_router.include_router(documents.router)
api_router.include_router(history.router)
api_router.include_router(analytics.router)
api_router.include_router(knowledge.router)
api_router.include_router(reports.router)
api_router.include_router(team.router)