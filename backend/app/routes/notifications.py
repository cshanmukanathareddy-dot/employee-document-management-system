from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.routes.auth import get_current_user


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


# ==================================================
# GET CURRENT USER NOTIFICATIONS
# ==================================================

@router.get("")
def get_notifications(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id ==
            current_user.id,

            Notification.notification_type.notin_(
                [
                    "document_approved",
                    "document_rejected",
                ]
            )
        )
        .order_by(
            Notification.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": notification.id,

            "title":
                notification.title,

            "message":
                notification.message,

            "notification_type":
                notification.notification_type,

            "document_id":
                notification.document_id,

            "is_read":
                notification.is_read,

            "created_at":
                notification.created_at,
        }

        for notification in notifications
    ]


# ==================================================
# GET UNREAD COUNT
# ==================================================

@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):

    count = (
        db.query(Notification)
        .filter(
            Notification.user_id ==
            current_user.id,

            Notification.notification_type.notin_(
                [
                    "document_approved",
                    "document_rejected",
                ]
            ),

            Notification.is_read ==
            False
        )
        .count()
    )

    return {
        "count": count
    }


# ==================================================
# MARK NOTIFICATION AS READ
# ==================================================

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(get_db)
):

    notification = (
        db.query(Notification)
        .filter(
            Notification.id ==
            notification_id,

            Notification.user_id ==
            current_user.id,

            Notification.notification_type.notin_(
                [
                    "document_approved",
                    "document_rejected",
                ]
            )
        )
        .first()
    )

    if not notification:

        raise HTTPException(
            status_code=404,
            detail="Notification not found."
        )

    notification.is_read = True

    db.commit()

    return {
        "message":
            "Notification marked as read."
    }


# ==================================================
# MARK ALL NOTIFICATIONS AS READ
# ==================================================

@router.put("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(get_db)
):

    (
        db.query(Notification)
        .filter(
            Notification.user_id ==
            current_user.id,

            Notification.notification_type.notin_(
                [
                    "document_approved",
                    "document_rejected",
                ]
            ),

            Notification.is_read ==
            False
        )
        .update(
            {
                Notification.is_read:
                    True
            },
            synchronize_session=False
        )
    )

    db.commit()

    return {
        "message":
            "All notifications marked as read."
    }