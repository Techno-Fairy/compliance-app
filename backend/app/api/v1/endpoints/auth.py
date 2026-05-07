from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens(user: User) -> TokenResponse:
    payload = {"sub": str(user.id), "email": user.email}
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": "Email already registered.", "field": "email"},
        )
    user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _tokens(user)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_ERROR", "message": "Invalid credentials."},
        )
    return _tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest):
    try:
        data = decode_token(body.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError
    except (ValueError, Exception):
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_ERROR", "message": "Invalid refresh token."},
        )
    payload = {"sub": data["sub"], "email": data["email"]}
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    # Stateless — client deletes stored tokens
    return
