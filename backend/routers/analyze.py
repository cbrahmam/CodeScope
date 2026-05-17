import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from database import get_db
from models.schemas import FindingResponse, FindingStatusUpdate, ComplexityReport
from models.db_models import row_to_review, row_to_finding, parse_files_json
from services.ai_reviewer import review_code, review_cross_file
from services.complexity_analyzer import analyze_complexity
from services.diff_generator import apply_fix, generate_diff

router = APIRouter(prefix="/reviews", tags=["analysis"])

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


@router.post("/{review_id}/analyze")
async def run_analysis(review_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM reviews WHERE id = ?", (review_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Review not found")

        review = row_to_review(row)
        files = parse_files_json(review["files"])
        if not files:
            raise HTTPException(status_code=400, detail="No files to analyze")

        await db.execute("UPDATE reviews SET status = 'analyzing', updated_at = ? WHERE id = ?",
                         (datetime.now(timezone.utc).isoformat(), review_id))
        await db.commit()
    finally:
        await db.close()

    structures = [f.get("structure", {}) for f in files]

    all_findings = await review_code(files, structures)

    cross_findings = await review_cross_file(files, structures)
    all_findings.extend(cross_findings)

    now = datetime.now(timezone.utc).isoformat()
    db = await get_db()
    try:
        for finding in all_findings:
            finding_id = uuid.uuid4().hex[:12]
            await db.execute(
                """INSERT INTO findings (id, review_id, file_name, line_start, line_end, category, severity, title, description, suggestion, suggested_fix, original_code, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)""",
                (finding_id, review_id, finding.file_name, finding.line_start, finding.line_end,
                 finding.category, finding.severity, finding.title, finding.description,
                 finding.suggestion, finding.suggested_fix, finding.original_code, now),
            )

        await db.execute("UPDATE reviews SET status = 'reviewed', updated_at = ? WHERE id = ?", (now, review_id))
        await db.commit()

        findings_cursor = await db.execute(
            "SELECT * FROM findings WHERE review_id = ? ORDER BY severity, line_start", (review_id,))
        rows = await findings_cursor.fetchall()
        findings_out = [FindingResponse(**row_to_finding(r)) for r in rows]
    finally:
        await db.close()

    by_severity = {}
    by_category = {}
    by_file = {}
    for f in findings_out:
        by_severity.setdefault(f.severity, []).append(f.model_dump())
        by_category.setdefault(f.category, []).append(f.model_dump())
        by_file.setdefault(f.file_name, []).append(f.model_dump())

    return {
        "review_id": review_id,
        "status": "reviewed",
        "total_findings": len(findings_out),
        "by_severity": {k: len(v) for k, v in by_severity.items()},
        "by_category": {k: len(v) for k, v in by_category.items()},
        "findings": [f.model_dump() for f in findings_out],
    }


@router.get("/{review_id}/findings", response_model=list[FindingResponse])
async def get_findings(
    review_id: str,
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    file: Optional[str] = Query(None),
):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM reviews WHERE id = ?", (review_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Review not found")

        query = "SELECT * FROM findings WHERE review_id = ?"
        params = [review_id]

        if category:
            query += " AND category = ?"
            params.append(category)
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        if status:
            query += " AND status = ?"
            params.append(status)
        if file:
            query += " AND file_name = ?"
            params.append(file)

        query += " ORDER BY severity, line_start"
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
    finally:
        await db.close()

    findings = [FindingResponse(**row_to_finding(r)) for r in rows]
    findings.sort(key=lambda f: SEVERITY_ORDER.get(f.severity, 5))
    return findings


@router.get("/{review_id}/complexity")
async def get_complexity(review_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM reviews WHERE id = ?", (review_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Review not found")

        review = row_to_review(row)
        files = parse_files_json(review["files"])
    finally:
        await db.close()

    reports = []
    for f in files:
        report = analyze_complexity(f["content"], f["language"], f["filename"])
        reports.append(report.model_dump())

    return {"review_id": review_id, "reports": reports}


@router.put("/{review_id}/findings/{finding_id}")
async def update_finding_status(review_id: str, finding_id: str, data: FindingStatusUpdate):
    if data.status not in ("open", "accepted", "dismissed", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid status")

    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM findings WHERE id = ? AND review_id = ?", (finding_id, review_id))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Finding not found")

        await db.execute("UPDATE findings SET status = ? WHERE id = ?", (data.status, finding_id))
        await db.execute("UPDATE reviews SET updated_at = ? WHERE id = ?",
                         (datetime.now(timezone.utc).isoformat(), review_id))
        await db.commit()

        cursor = await db.execute("SELECT * FROM findings WHERE id = ?", (finding_id,))
        row = await cursor.fetchone()
    finally:
        await db.close()

    return FindingResponse(**row_to_finding(row))


@router.post("/{review_id}/findings/{finding_id}/apply")
async def apply_finding_fix(review_id: str, finding_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM findings WHERE id = ? AND review_id = ?", (finding_id, review_id))
        finding_row = await cursor.fetchone()
        if not finding_row:
            raise HTTPException(status_code=404, detail="Finding not found")

        finding = row_to_finding(finding_row)
        if not finding["suggested_fix"]:
            raise HTTPException(status_code=400, detail="No suggested fix available")

        cursor = await db.execute("SELECT * FROM reviews WHERE id = ?", (review_id,))
        review_row = await cursor.fetchone()
        review = row_to_review(review_row)
        files = parse_files_json(review["files"])

        target_file = None
        target_idx = None
        for idx, f in enumerate(files):
            if f["filename"] == finding["file_name"]:
                target_file = f
                target_idx = idx
                break

        if target_file is None:
            raise HTTPException(status_code=400, detail="File not found in review")

        new_content = apply_fix(
            target_file["content"],
            finding["suggested_fix"],
            finding["line_start"],
            finding["line_end"],
        )

        diff = generate_diff(
            target_file["content"],
            finding["suggested_fix"],
            finding["line_start"],
            finding["line_end"],
            target_file["filename"],
        )

        line_diff = len(new_content.split("\n")) - len(target_file["content"].split("\n"))

        files[target_idx]["content"] = new_content
        now = datetime.now(timezone.utc).isoformat()

        await db.execute("UPDATE reviews SET files = ?, updated_at = ? WHERE id = ?",
                         (json.dumps(files), now, review_id))
        await db.execute("UPDATE findings SET status = 'resolved' WHERE id = ?", (finding_id,))

        if line_diff != 0:
            cursor = await db.execute(
                "SELECT * FROM findings WHERE review_id = ? AND file_name = ? AND id != ? AND status = 'open' AND line_start > ?",
                (review_id, finding["file_name"], finding_id, finding["line_end"]),
            )
            affected = await cursor.fetchall()
            for af in affected:
                await db.execute(
                    "UPDATE findings SET line_start = ?, line_end = ? WHERE id = ?",
                    (af["line_start"] + line_diff, af["line_end"] + line_diff, af["id"]),
                )

        await db.commit()
    finally:
        await db.close()

    return {
        "status": "applied",
        "finding_id": finding_id,
        "file_name": finding["file_name"],
        "new_content": new_content,
        "diff": diff,
        "line_diff": line_diff,
    }
