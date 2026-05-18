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

        items = []
        for row in rows:
            review = row_to_review(row)
            files = parse_files_json(review["files"])

            fc = await db.execute(
                "SELECT severity, status FROM findings WHERE review_id = ?", (review["id"],)
            )
            finding_rows = await fc.fetchall()

            finding_counts = {}
            total = 0
            resolved = 0
            for fr in finding_rows:
                sev = fr["severity"]
                finding_counts[sev] = finding_counts.get(sev, 0) + 1
                total += 1
                if fr["status"] in ("resolved", "dismissed"):
                    resolved += 1

            score = None
            if total > 0:
                weights = {"critical": 10, "high": 5, "medium": 2, "low": 1, "info": 0}
                deductions = sum(weights.get(fr["severity"], 1) for fr in finding_rows if fr["status"] not in ("resolved", "dismissed"))
                score = max(0, round(100 - deductions, 1))

            items.append(ReviewListItem(
                id=review["id"],
                title=review["title"],
                language=review["language"],
                status=review["status"],
                created_at=review["created_at"],
                updated_at=review["updated_at"],
                file_count=len(files),
                finding_counts=finding_counts,
                total_findings=total,
                resolved_findings=resolved,
                score=score,
            ))
    finally:
        await db.close()

    return items


@router.get("/stats/dashboard")
async def dashboard_stats():
    db = await get_db()
    try:
        rc = await db.execute("SELECT COUNT(*) as cnt FROM reviews")
        total_reviews = (await rc.fetchone())["cnt"]

        fc = await db.execute("SELECT COUNT(*) as cnt FROM findings")
        total_findings = (await fc.fetchone())["cnt"]

        cc = await db.execute(
            "SELECT category, COUNT(*) as cnt FROM findings GROUP BY category ORDER BY cnt DESC LIMIT 1"
        )
        top_cat_row = await cc.fetchone()
        top_category = top_cat_row["category"] if top_cat_row else None

        sc = await db.execute("SELECT severity, status FROM findings")
        all_findings = await sc.fetchall()
        weights = {"critical": 10, "high": 5, "medium": 2, "low": 1, "info": 0}
        if total_reviews > 0 and all_findings:
            review_ids = set()
            for f in all_findings:
                pass
            rc2 = await db.execute("SELECT id FROM reviews WHERE status = 'reviewed'")
            reviewed = await rc2.fetchall()
            if reviewed:
                scores = []
                for rev in reviewed:
                    rid = rev["id"]
                    rfc = await db.execute("SELECT severity, status FROM findings WHERE review_id = ?", (rid,))
                    rfindings = await rfc.fetchall()
                    if rfindings:
                        ded = sum(weights.get(rf["severity"], 1) for rf in rfindings if rf["status"] not in ("resolved", "dismissed"))
                        scores.append(max(0, round(100 - ded, 1)))
                avg_score = round(sum(scores) / len(scores), 1) if scores else None
            else:
                avg_score = None
        else:
            avg_score = None

        recent_cursor = await db.execute("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 5")
        recent_rows = await recent_cursor.fetchall()
        recent = []
        for row in recent_rows:
            review = row_to_review(row)
            files = parse_files_json(review["files"])
            rfc = await db.execute("SELECT severity, status FROM findings WHERE review_id = ?", (review["id"],))
            rfindings = await rfc.fetchall()
            finding_counts = {}
            total = 0
            resolved = 0
            for rf in rfindings:
                finding_counts[rf["severity"]] = finding_counts.get(rf["severity"], 0) + 1
                total += 1
                if rf["status"] in ("resolved", "dismissed"):
                    resolved += 1
            score = None
            if total > 0:
                ded = sum(weights.get(rf["severity"], 1) for rf in rfindings if rf["status"] not in ("resolved", "dismissed"))
                score = max(0, round(100 - ded, 1))
            recent.append({
                "id": review["id"],
                "title": review["title"],
                "language": review["language"],
                "status": review["status"],
                "created_at": review["created_at"],
                "file_count": len(files),
                "total_findings": total,
                "resolved_findings": resolved,
                "score": score,
            })
    finally:
        await db.close()

    return {
        "total_reviews": total_reviews,
        "total_findings": total_findings,
        "top_category": top_category,
        "avg_score": avg_score,
        "recent_reviews": recent,
    }


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
