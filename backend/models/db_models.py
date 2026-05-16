import json


def row_to_review(row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "language": row["language"] or "",
        "files": row["files"] or "[]",
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def row_to_finding(row) -> dict:
    return {
        "id": row["id"],
        "review_id": row["review_id"],
        "file_name": row["file_name"] or "",
        "line_start": row["line_start"] or 0,
        "line_end": row["line_end"] or 0,
        "category": row["category"] or "",
        "severity": row["severity"] or "",
        "title": row["title"] or "",
        "description": row["description"] or "",
        "suggestion": row["suggestion"],
        "suggested_fix": row["suggested_fix"],
        "original_code": row["original_code"],
        "status": row["status"] or "open",
        "created_at": row["created_at"] or "",
    }


def row_to_comment(row) -> dict:
    return {
        "id": row["id"],
        "finding_id": row["finding_id"],
        "review_id": row["review_id"],
        "author": row["author"] or "",
        "content": row["content"] or "",
        "line_number": row["line_number"],
        "created_at": row["created_at"] or "",
    }


def parse_files_json(files_str: str) -> list:
    try:
        return json.loads(files_str)
    except (json.JSONDecodeError, TypeError):
        return []
