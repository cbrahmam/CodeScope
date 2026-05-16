import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from models.schemas import ReviewCreate, ReviewResponse, ReviewDetail, ReviewListItem, FindingResponse
from models.db_models import row_to_review, row_to_finding, parse_files_json
from database import get_db
from services.code_parser import detect_language, parse_code_structure

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewResponse)
async def create_review(data: ReviewCreate):
    review_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    title = data.title or f"Code Review - {datetime.now(timezone.utc).strftime('%b %d, %Y %H:%M')}"

    files_with_meta = []
    languages = []

    for f in data.files:
        lang = f.language or detect_language(f.content, f.filename)
        structure = parse_code_structure(f.content, lang)
        languages.append(lang)
        files_with_meta.append({
            "filename": f.filename,
            "content": f.content,
            "language": lang,
            "structure": structure.model_dump(),
        })

    primary_language = max(set(languages), key=languages.count) if languages else "plaintext"
    files_json = json.dumps(files_with_meta)

    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO reviews (id, title, language, files, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (review_id, title, primary_language, files_json, "pending", now, now),
        )
        await db.commit()
    finally:
        await db.close()

    return ReviewResponse(
        id=review_id,
        title=title,
        language=primary_language,
        files=files_json,
        status="pending",
        created_at=now,
        updated_at=now,
    )


@router.get("", response_model=list[ReviewListItem])
async def list_reviews():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM reviews ORDER BY created_at DESC")
        rows = await cursor.fetchall()
    finally:
        await db.close()

    items = []
    for row in rows:
        review = row_to_review(row)
        files = parse_files_json(review["files"])
        items.append(ReviewListItem(
            id=review["id"],
            title=review["title"],
            language=review["language"],
            status=review["status"],
            created_at=review["created_at"],
            updated_at=review["updated_at"],
            file_count=len(files),
        ))
    return items


@router.get("/{review_id}", response_model=ReviewDetail)
async def get_review(review_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM reviews WHERE id = ?", (review_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Review not found")

        review = row_to_review(row)

        findings_cursor = await db.execute(
            "SELECT * FROM findings WHERE review_id = ? ORDER BY severity, line_start",
            (review_id,),
        )
        finding_rows = await findings_cursor.fetchall()
        findings = [FindingResponse(**row_to_finding(r)) for r in finding_rows]
    finally:
        await db.close()

    return ReviewDetail(
        id=review["id"],
        title=review["title"],
        language=review["language"],
        files=review["files"],
        status=review["status"],
        created_at=review["created_at"],
        updated_at=review["updated_at"],
        findings=findings,
    )


@router.delete("/{review_id}", status_code=204)
async def delete_review(review_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM reviews WHERE id = ?", (review_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Review not found")

        await db.execute("DELETE FROM comments WHERE review_id = ?", (review_id,))
        await db.execute("DELETE FROM findings WHERE review_id = ?", (review_id,))
        await db.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
        await db.commit()
    finally:
        await db.close()
