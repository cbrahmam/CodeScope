import json
import os
import anthropic
from typing import List
from models.schemas import Finding, CodeStructure

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

REVIEW_PROMPT = """You are a senior staff engineer conducting a thorough code review. Analyze the following code for issues across these categories:

**Security**: SQL injection, XSS, CSRF, hardcoded secrets, insecure dependencies, missing auth, path traversal, command injection
**Performance**: O(n^2+) algorithms, unnecessary re-renders, memory leaks, blocking I/O, missing indexes, N+1 queries, unnecessary allocations
**Bug Risk**: Null pointer risks, race conditions, off-by-one errors, unhandled exceptions, type mismatches, unreachable code
**Code Quality**: Code duplication, dead code, overly complex functions, magic numbers, poor naming, missing type hints
**Style**: Inconsistent formatting, missing docstrings, comment quality, import organization
**Architecture**: Tight coupling, missing error boundaries, no separation of concerns, hardcoded config

For each issue found, provide:
- file_name: the filename
- line_start / line_end: exact line numbers from the numbered code
- category: one of "security", "performance", "bug_risk", "code_quality", "style", "architecture"
- severity: "critical", "high", "medium", "low", or "info"
- title: short title (e.g. "SQL Injection Risk")
- description: detailed explanation
- why_it_matters: impact if not fixed
- suggestion: how to fix (text)
- suggested_fix: actual replacement code for the problematic lines
- original_code: the problematic code lines as they appear
- confidence: "high", "medium", or "low"
- references: relevant CWE IDs, doc links, or best practice URLs

Rules:
- Be thorough but not pedantic — don't flag every missing semicolon
- Prioritize security and bug risks over style issues
- For each finding, provide an actual code fix, not just "consider refactoring"
- Include confidence level: high = definitely an issue, low = might be intentional
- Return ONLY valid JSON: a list of finding objects. No markdown, no explanation outside the JSON.
"""


def _prepend_line_numbers(code: str) -> str:
    lines = code.split("\n")
    return "\n".join(f"{i+1:4d} | {line}" for i, line in enumerate(lines))


def _build_file_context(filename: str, content: str, structure: dict) -> str:
    numbered = _prepend_line_numbers(content)
    struct_summary = (
        f"Language: {structure.get('language', 'unknown')}, "
        f"Lines: {structure.get('total_lines', 0)} total / {structure.get('code_lines', 0)} code / {structure.get('comment_lines', 0)} comments, "
        f"Functions: {len(structure.get('functions', []))}, "
        f"Classes: {len(structure.get('classes', []))}, "
        f"Imports: {', '.join(structure.get('imports', [])[:10])}"
    )
    return f"### File: {filename}\n**Structure**: {struct_summary}\n\n```\n{numbered}\n```"


async def review_code(files: List[dict], structures: List[dict]) -> List[Finding]:
    file_contexts = []
    for f, s in zip(files, structures):
        ctx = _build_file_context(f["filename"], f["content"], s)
        file_contexts.append(ctx)

    full_context = "\n\n---\n\n".join(file_contexts)

    user_message = f"{REVIEW_PROMPT}\n\n{full_context}"

    findings = []
    max_retries = 2

    for attempt in range(max_retries + 1):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=8192,
                messages=[{"role": "user", "content": user_message}],
            )

            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

            raw_findings = json.loads(text)

            for rf in raw_findings:
                findings.append(Finding(
                    file_name=rf.get("file_name", ""),
                    line_start=rf.get("line_start", 0),
                    line_end=rf.get("line_end", 0),
                    category=rf.get("category", "code_quality"),
                    severity=rf.get("severity", "medium"),
                    title=rf.get("title", ""),
                    description=rf.get("description", ""),
                    why_it_matters=rf.get("why_it_matters", ""),
                    suggestion=rf.get("suggestion", ""),
                    suggested_fix=rf.get("suggested_fix", ""),
                    original_code=rf.get("original_code", ""),
                    confidence=rf.get("confidence", "medium"),
                    references=rf.get("references", []),
                ))
            break

        except (json.JSONDecodeError, KeyError, IndexError):
            if attempt == max_retries:
                raise ValueError("Failed to parse AI review response after retries")
            continue

    return findings


async def review_cross_file(files: List[dict], structures: List[dict]) -> List[Finding]:
    if len(files) < 2:
        return []

    file_contexts = []
    for f, s in zip(files, structures):
        ctx = _build_file_context(f["filename"], f["content"], s)
        file_contexts.append(ctx)

    full_context = "\n\n---\n\n".join(file_contexts)

    cross_prompt = """You are a senior staff engineer. Analyze these files TOGETHER for cross-file issues:
- Inconsistent patterns across files
- Missing error handling at integration points
- Dependency issues between files
- Architectural concerns spanning multiple files

Return ONLY valid JSON: a list of finding objects with the same schema as a single-file review.
Focus only on issues that span multiple files — single-file issues are handled separately.
If there are no cross-file issues, return an empty list: []
"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": f"{cross_prompt}\n\n{full_context}"}],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        raw = json.loads(text)
        return [Finding(
            file_name=rf.get("file_name", ""),
            line_start=rf.get("line_start", 0),
            line_end=rf.get("line_end", 0),
            category=rf.get("category", "architecture"),
            severity=rf.get("severity", "medium"),
            title=rf.get("title", ""),
            description=rf.get("description", ""),
            why_it_matters=rf.get("why_it_matters", ""),
            suggestion=rf.get("suggestion", ""),
            suggested_fix=rf.get("suggested_fix", ""),
            original_code=rf.get("original_code", ""),
            confidence=rf.get("confidence", "medium"),
            references=rf.get("references", []),
        ) for rf in raw]
    except (json.JSONDecodeError, KeyError, IndexError):
        return []
