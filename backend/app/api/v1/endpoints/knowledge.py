"""
Knowledge Base endpoints.

Week 4 deliverables (BE-19 partial):
  GET /knowledge          — list articles with optional ?category= and ?q= search
  GET /knowledge/{id}     — full article detail

Articles are shared across all authenticated users — no business scoping.
Search operates over title, summary, and tags (case-insensitive LIKE).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.knowledge import KBCategory, KnowledgeArticle
from app.models.user import User
from app.schemas.knowledge import KnowledgeArticleDetail, KnowledgeArticleSummary

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeArticleSummary])
def list_articles(
    category: KBCategory | None = Query(
        default=None,
        description="Filter by category: VAT, PAYE, CIT, WHT, CIPA, LABOUR, GENERAL",
    ),
    q: str | None = Query(
        default=None,
        min_length=2,
        max_length=100,
        description="Search across title, summary, and tags (case-insensitive).",
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),  # auth guard — result not used
) -> list[KnowledgeArticle]:
    """
    Return all knowledge base articles, optionally filtered by category
    and/or a full-text search query.

    Filters are AND-combined: ?category=VAT&q=monthly returns only VAT
    articles whose title, summary, or tags contain "monthly".
    """
    query = db.query(KnowledgeArticle)

    if category is not None:
        query = query.filter(KnowledgeArticle.category == category)

    if q:
        pattern = f"%{q.lower()}%"
        query = query.filter(
            or_(
                KnowledgeArticle.title.ilike(pattern),
                KnowledgeArticle.summary.ilike(pattern),
                KnowledgeArticle.tags.ilike(pattern),
            )
        )

    return query.order_by(KnowledgeArticle.category, KnowledgeArticle.title).all()


@router.get("/{article_id}", response_model=KnowledgeArticleDetail)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> KnowledgeArticle:
    """
    Return the full text of a single knowledge base article.
    """
    article = db.get(KnowledgeArticle, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": f"Knowledge article {article_id} not found.",
            },
        )
    return article