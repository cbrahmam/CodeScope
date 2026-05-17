import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from database import get_db
from models.db_models import row_to_comment

router = APIRouter(prefix="/reviews", tags=["comments"])


class CommentCreate(BaseModel):
    author: str
    content: str
    line_number: Optional[int] = None
    finding_id: Optional[str] = None


@router.post("/{review_id}/comments")
async def create_comment(review_id: str, data: CommentCreate):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM reviews WHERE id = ?", (review_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Review not found")

        comment_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()

        await db.execute(
            "INSERT INTO comments (id, finding_id, review_id, author, content, line_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (comment_id, data.finding_id, review_id, data.author, data.content, data.line_number, now),
        )
        await db.commit()
    finally:
        await db.close()

    return {
        "id": comment_id,
        "finding_id": data.finding_id,
        "review_id": review_id,
        "author": data.author,
        "content": data.content,
        "line_number": data.line_number,
        "created_at": now,
    }


@router.get("/{review_id}/comments")
async def get_comments(
    review_id: str,
    finding_id: Optional[str] = Query(None),
    line_number: Optional[int] = Query(None),
):
    db = await get_db()
    try:
        query = "SELECT * FROM comments WHERE review_id = ?"
        params = [review_id]

        if finding_id:
            query += " AND finding_id = ?"
            params.append(finding_id)
        if line_number is not None:
            query += " AND line_number = ?"
            params.append(line_number)

        query += " ORDER BY created_at ASC"
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
    finally:
        await db.close()

    return [row_to_comment(r) for r in rows]
