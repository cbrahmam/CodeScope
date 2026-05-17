import difflib


def generate_diff(original: str, suggested_fix: str, line_start: int, line_end: int, filename: str = "file") -> str:
    original_lines = original.split("\n")

    before_context = original_lines[:max(0, line_start - 1)]
    after_context = original_lines[line_end:]
    fix_lines = suggested_fix.split("\n")

    new_lines = before_context + fix_lines + after_context
    new_content = "\n".join(new_lines)

    diff = difflib.unified_diff(
        original_lines,
        new_lines,
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}",
        lineterm="",
    )

    return "\n".join(diff)


def apply_fix(original: str, suggested_fix: str, line_start: int, line_end: int) -> str:
    original_lines = original.split("\n")

    before = original_lines[:max(0, line_start - 1)]
    after = original_lines[line_end:]
    fix_lines = suggested_fix.split("\n")

    return "\n".join(before + fix_lines + after)
