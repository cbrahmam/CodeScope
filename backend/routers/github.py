import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db
from services.github_service import fetch_pr_info, fetch_pr_files
from services.code_parser import detect_language, parse_code_structure

router = APIRouter(prefix="/github", tags=["github"])


class PRImportRequest(BaseModel):
    repo: str
    pr_number: int
    token: Optional[str] = None


def parse_repo(repo_str: str):
    repo_str = repo_str.strip().rstrip("/")
    match = re.match(r"(?:https?://github\.com/)?([^/]+)/([^/]+?)(?:\.git)?$", repo_str)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid repo format. Use 'owner/repo' or a GitHub URL.")
    return match.group(1), match.group(2)


@router.get("/pr-info")
async def get_pr_info(repo: str, pr_number: int, token: Optional[str] = None):
    owner, name = parse_repo(repo)
    try:
        info = await fetch_pr_info(owner, name, pr_number, token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch PR: {e}")
    return info


@router.post("/import-pr")
async def import_pr(data: PRImportRequest):
    owner, name = parse_repo(data.repo)

    try:
        pr_info = await fetch_pr_info(owner, name, data.pr_number, data.token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch PR info: {e}")

    try:
        pr_files = await fetch_pr_files(owner, name, data.pr_number, data.token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch PR files: {e}")

    if not pr_files:
        raise HTTPException(status_code=400, detail="No reviewable files found in this PR")

    review_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    title = f"PR #{data.pr_number}: {pr_info['title']}"

    files_with_meta = []
    languages = []
    for f in pr_files:
        lang = detect_language(f["content"], f["filename"])
        structure = parse_code_structure(f["content"], lang)
        languages.append(lang)
        files_with_meta.append({
            "filename": f["filename"],
            "content": f["content"],
            "language": lang,
            "structure": structure.model_dump(),
            "patch": f.get("patch", ""),
            "pr_status": f.get("status", ""),
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
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

    return {
        "review_id": review_id,
        "title": title,
        "pr": pr_info,
        "files_count": len(files_with_meta),
        "languages": list(set(languages)),
    }
