import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from database import get_db
from models.schemas import FileInput, FindingResponse, FindingStatusUpdate, ComplexityReport
from models.db_models import row_to_review, row_to_finding, parse_files_json
from services.ai_reviewer import review_code, review_cross_file
from services.code_parser import detect_language, parse_code_structure
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


class ReReviewRequest(BaseModel):
    files: list[FileInput]


@router.post("/{review_id}/re-review")
async def re_review(review_id: str, data: ReReviewRequest):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM reviews WHERE id = ?", (review_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Review not found")

        review = row_to_review(row)

        old_cursor = await db.execute(
            "SELECT * FROM findings WHERE review_id = ?", (review_id,)
        )
        old_finding_rows = await old_cursor.fetchall()
        old_findings = [row_to_finding(r) for r in old_finding_rows]
    finally:
        await db.close()

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

    new_review_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    title = f"{review['title']} (Re-review)"

    structures = [f.get("structure", {}) for f in files_with_meta]
    new_findings_raw = await review_code(files_with_meta, structures)
    cross_findings = await review_cross_file(files_with_meta, structures)
    new_findings_raw.extend(cross_findings)

    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO reviews (id, title, language, files, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (new_review_id, title, primary_language, files_json, "reviewed", now, now),
        )

        for finding in new_findings_raw:
            fid = uuid.uuid4().hex[:12]
            await db.execute(
                """INSERT INTO findings (id, review_id, file_name, line_start, line_end, category, severity, title, description, suggestion, suggested_fix, original_code, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)""",
                (fid, new_review_id, finding.file_name, finding.line_start, finding.line_end,
                 finding.category, finding.severity, finding.title, finding.description,
                 finding.suggestion, finding.suggested_fix, finding.original_code, now),
            )
        await db.commit()

        fc = await db.execute(
            "SELECT * FROM findings WHERE review_id = ? ORDER BY severity, line_start",
            (new_review_id,),
        )
        new_finding_rows = await fc.fetchall()
        new_findings = [row_to_finding(r) for r in new_finding_rows]
    finally:
        await db.close()

    comparison = []
    matched_new = set()
    for old in old_findings:
        found = False
        for nf in new_findings:
            if nf["id"] in matched_new:
                continue
            if old["title"] == nf["title"] and old["file_name"] == nf["file_name"]:
                comparison.append({
                    "title": old["title"],
                    "file_name": old["file_name"],
                    "severity": old["severity"],
                    "category": old["category"],
                    "old_status": old["status"],
                    "new_status": "persists",
                    "change": "unchanged",
                })
                matched_new.add(nf["id"])
                found = True
                break
        if not found:
            comparison.append({
                "title": old["title"],
                "file_name": old["file_name"],
                "severity": old["severity"],
                "category": old["category"],
                "old_status": old["status"],
                "new_status": "fixed",
                "change": "fixed",
            })

    for nf in new_findings:
        if nf["id"] not in matched_new:
            comparison.append({
                "title": nf["title"],
                "file_name": nf["file_name"],
                "severity": nf["severity"],
                "category": nf["category"],
                "old_status": None,
                "new_status": "new",
                "change": "new",
            })

    return {
        "original_review_id": review_id,
        "new_review_id": new_review_id,
        "comparison": comparison,
        "summary": {
            "fixed": sum(1 for c in comparison if c["change"] == "fixed"),
            "new": sum(1 for c in comparison if c["change"] == "new"),
            "unchanged": sum(1 for c in comparison if c["change"] == "unchanged"),
            "old_total": len(old_findings),
            "new_total": len(new_findings),
        },
    }


@router.get("/{review_id}/export")
async def export_review(review_id: str, format: str = Query("markdown")):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM reviews WHERE id = ?", (review_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Review not found")

        review = row_to_review(row)
        files = parse_files_json(review["files"])

        fc = await db.execute(
            "SELECT * FROM findings WHERE review_id = ? ORDER BY severity, line_start",
            (review_id,),
        )
        finding_rows = await fc.fetchall()
        findings = [row_to_finding(r) for r in finding_rows]
    finally:
        await db.close()

    by_severity = {}
    for f in findings:
        by_severity.setdefault(f["severity"], []).append(f)

    weights = {"critical": 10, "high": 5, "medium": 2, "low": 1, "info": 0}
    deductions = sum(weights.get(f["severity"], 1) for f in findings if f["status"] not in ("resolved", "dismissed"))
    score = max(0, round(100 - deductions, 1))

    if format == "github":
        lines = [f"## CodeScope Review: {review['title']}", ""]
        lines.append(f"**Score: {score}/100** | **{len(findings)} findings** | **{len(files)} files**")
        lines.append("")
        for sev in ["critical", "high", "medium", "low", "info"]:
            sev_findings = by_severity.get(sev, [])
            if not sev_findings:
                continue
            emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "⚪"}.get(sev, "⚪")
            lines.append(f"### {emoji} {sev.capitalize()} ({len(sev_findings)})")
            lines.append("")
            for f in sev_findings[:5]:
                status = "✅" if f["status"] in ("resolved", "dismissed") else "⬜"
                lines.append(f"- {status} **{f['title']}** (`{f['file_name']}:{f['line_start']}`)")
                lines.append(f"  {f['description'][:120]}")
            if len(sev_findings) > 5:
                lines.append(f"  _...and {len(sev_findings) - 5} more_")
            lines.append("")
        lines.append("---")
        lines.append("_Generated by [CodeScope](https://github.com/cbrahmam/CodeScope)_")
        return {"format": "github", "content": "\n".join(lines)}

    lines = [f"# Code Review: {review['title']}", ""]
    lines.append(f"**Date:** {review['created_at'][:10]}")
    lines.append(f"**Score:** {score}/100")
    lines.append(f"**Language:** {review['language']}")
    lines.append(f"**Files:** {len(files)}")
    lines.append(f"**Total Findings:** {len(findings)}")
    lines.append("")
    lines.append("## Files Reviewed")
    lines.append("")
    for f in files:
        lines.append(f"- `{f['filename']}` ({f.get('language', 'unknown')})")
    lines.append("")
    lines.append("## Findings by Severity")
    lines.append("")
    for sev in ["critical", "high", "medium", "low", "info"]:
        sev_findings = by_severity.get(sev, [])
        if not sev_findings:
            continue
        lines.append(f"### {sev.capitalize()} ({len(sev_findings)})")
        lines.append("")
        for f in sev_findings:
            status = "[RESOLVED]" if f["status"] in ("resolved", "dismissed") else "[OPEN]"
            lines.append(f"- {status} **{f['title']}** — `{f['file_name']}:{f['line_start']}-{f['line_end']}`")
            lines.append(f"  {f['description']}")
            if f.get("suggestion"):
                lines.append(f"  > **Suggestion:** {f['suggestion']}")
            lines.append("")
    lines.append("---")
    lines.append("*Generated by CodeScope*")
    return {"format": "markdown", "content": "\n".join(lines)}
