import httpx
from config import settings


async def fetch_pr_info(repo_owner: str, repo_name: str, pr_number: int, token: str = None):
    headers = {"Accept": "application/vnd.github.v3+json"}
    tok = token or settings.GITHUB_TOKEN
    if tok:
        headers["Authorization"] = f"Bearer {tok}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr_number}",
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        pr = resp.json()

    return {
        "title": pr["title"],
        "description": pr.get("body") or "",
        "author": pr["user"]["login"],
        "state": pr["state"],
        "branch": pr["head"]["ref"],
        "base_branch": pr["base"]["ref"],
        "html_url": pr["html_url"],
        "created_at": pr["created_at"],
        "updated_at": pr["updated_at"],
    }


async def fetch_pr_files(repo_owner: str, repo_name: str, pr_number: int, token: str = None):
    headers = {"Accept": "application/vnd.github.v3+json"}
    tok = token or settings.GITHUB_TOKEN
    if tok:
        headers["Authorization"] = f"Bearer {tok}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr_number}/files",
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        pr_files = resp.json()

        files = []
        for pf in pr_files:
            if pf.get("status") == "removed":
                continue
            raw_url = pf.get("raw_url")
            if not raw_url:
                continue
            content_resp = await client.get(raw_url, headers=headers, timeout=15)
            if content_resp.status_code != 200:
                continue
            files.append({
                "filename": pf["filename"],
                "content": content_resp.text,
                "patch": pf.get("patch", ""),
                "status": pf["status"],
                "additions": pf.get("additions", 0),
                "deletions": pf.get("deletions", 0),
            })

    return files
