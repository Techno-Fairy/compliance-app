from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.database import get_db
from app.models.user import User, UserRole

bearer = HTTPBearer()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Decodes the Bearer JWT from the Authorization header and returns
    the corresponding active User. Raises 401 on any failure.
    """
    try:
        payload = decode_token(creds.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_ERROR", "message": "Invalid or expired token."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_ERROR", "message": "Token payload malformed."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_ERROR", "message": "User not found or inactive."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ── BE-20: Role-based access helpers ─────────────────────────────────────────

def require_business_owner(current_user: User = Depends(get_current_user)) -> User:
    """Only Business Owners may call this endpoint."""
    if current_user.role not in (UserRole.BUSINESS_OWNER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Only business owners may perform this action.",
            },
        )
    return current_user


def require_accountant_or_owner(current_user: User = Depends(get_current_user)) -> User:
    """Accountants and Business Owners may call this endpoint."""
    if current_user.role not in (
        UserRole.BUSINESS_OWNER,
        UserRole.ACCOUNTANT,
        UserRole.ADMIN,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Insufficient permissions.",
            },
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Admin-only endpoint."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Admin access required."},
        )
    return current_user


# ── BE-22: Multi-client scoping helper ───────────────────────────────────────
#
# Accountants can act on behalf of a client business by passing the
# X-Client-Business-ID header.  Business owners always resolve to their
# own profile and may not pass this header.
#
# Usage in endpoints:
#   business_id: int = Depends(resolve_business_id)

from fastapi import Header  # noqa: E402  (keep imports together above)
from app.models.business import BusinessProfile  # noqa: E402
from app.models.team import TeamMembership  # noqa: E402


def resolve_business_id(
    x_client_business_id: int | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> int:
    """
    Returns the business_id the current request should operate on.

    - Business Owner: always their own profile; ignores the header.
    - Accountant: uses X-Client-Business-ID if provided and they are a
      confirmed member; falls back to their own profile otherwise.
    - Admin: may pass any business_id; resolved directly.
    """
    if current_user.role == UserRole.BUSINESS_OWNER:
        profile = (
            db.query(BusinessProfile)
            .filter(BusinessProfile.owner_id == current_user.id)
            .first()
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Business profile not found."},
            )
        return profile.id

    if current_user.role == UserRole.ADMIN:
        if x_client_business_id:
            return x_client_business_id
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Admin must supply X-Client-Business-ID."},
        )

    # Accountant
    if x_client_business_id:
        membership = (
            db.query(TeamMembership)
            .filter(
                TeamMembership.accountant_id == current_user.id,
                TeamMembership.business_id == x_client_business_id,
                TeamMembership.status == "active",
            )
            .first()
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": "You are not an authorised accountant for this business.",
                },
            )
        return x_client_business_id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "code": "BAD_REQUEST",
            "message": "Accountants must supply X-Client-Business-ID header.",
        },
    )