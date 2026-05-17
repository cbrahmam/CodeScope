import re
import math
from typing import List
from models.schemas import FunctionComplexity, ComplexityReport

COMPLEXITY_THRESHOLD = 10
NESTING_THRESHOLD = 4
PARAM_THRESHOLD = 5
LOC_THRESHOLD = 50

BRANCH_PATTERNS = {
    "python": [
        r"\bif\b", r"\belif\b", r"\belse\b", r"\bfor\b", r"\bwhile\b",
        r"\btry\b", r"\bexcept\b", r"\band\b", r"\bor\b",
        r"\bif\s+.*\belse\b",
    ],
    "javascript": [
        r"\bif\b", r"\belse\s+if\b", r"\belse\b", r"\bfor\b", r"\bwhile\b",
        r"\bswitch\b", r"\bcase\b", r"\btry\b", r"\bcatch\b",
        r"\b\?\b", r"&&", r"\|\|", r"\?\?",
    ],
}

NESTING_OPENERS = {
    "python": [r"\bif\b", r"\bfor\b", r"\bwhile\b", r"\btry\b", r"\bwith\b"],
    "javascript": [r"\{"],
}


def _get_patterns(language: str) -> tuple:
    if language in ("python", "ruby"):
        return BRANCH_PATTERNS.get("python", []), "python"
    return BRANCH_PATTERNS.get("javascript", []), "javascript"


def _calc_cyclomatic(lines: List[str], lang_type: str) -> int:
    complexity = 1
    patterns = BRANCH_PATTERNS.get(lang_type, BRANCH_PATTERNS["javascript"])
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("//"):
            continue
        for pat in patterns:
            complexity += len(re.findall(pat, stripped))
    return complexity


def _calc_nesting(lines: List[str], lang_type: str) -> int:
    max_depth = 0
    if lang_type == "python":
        base_indent = None
        for line in lines:
            if not line.strip():
                continue
            indent = len(line) - len(line.lstrip())
            if base_indent is None:
                base_indent = indent
            depth = max(0, (indent - base_indent) // 4)
            max_depth = max(max_depth, depth)
    else:
        depth = 0
        for line in lines:
            depth += line.count("{")
            max_depth = max(max_depth, depth)
            depth -= line.count("}")
            depth = max(0, depth)
    return max_depth


def _extract_function_blocks_python(code: str) -> List[dict]:
    blocks = []
    lines = code.split("\n")
    func_pattern = re.compile(r"^(\s*)(?:async\s+)?def\s+(\w+)\s*\((.*?)\)")

    i = 0
    while i < len(lines):
        match = func_pattern.match(lines[i])
        if match:
            indent = len(match.group(1))
            name = match.group(2)
            params_str = match.group(3)
            params = [p.strip().split(":")[0].split("=")[0].strip() for p in params_str.split(",") if p.strip()] if params_str.strip() else []
            if params and params[0] == "self":
                params = params[1:]

            line_start = i
            func_lines = [lines[i]]
            j = i + 1
            while j < len(lines):
                if lines[j].strip() == "":
                    func_lines.append(lines[j])
                    j += 1
                    continue
                cur_indent = len(lines[j]) - len(lines[j].lstrip())
                if cur_indent <= indent and lines[j].strip():
                    break
                func_lines.append(lines[j])
                j += 1

            blocks.append({
                "name": name,
                "line_start": line_start + 1,
                "line_end": line_start + len(func_lines),
                "lines": func_lines,
                "params": params,
            })
            i = j
        else:
            i += 1
    return blocks


def _extract_function_blocks_js(code: str) -> List[dict]:
    blocks = []
    lines = code.split("\n")

    patterns = [
        re.compile(r"(?:async\s+)?function\s+(\w+)\s*\((.*?)\)"),
        re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>"),
        re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\((.*?)\)"),
    ]

    i = 0
    while i < len(lines):
        matched = False
        for pat in patterns:
            match = pat.search(lines[i])
            if match:
                name = match.group(1)
                params_str = match.group(2)
                params = [p.strip().split("=")[0].split(":")[0].strip() for p in params_str.split(",") if p.strip()] if params_str.strip() else []

                func_lines = [lines[i]]
                brace_count = lines[i].count("{") - lines[i].count("}")
                j = i + 1
                while j < len(lines) and brace_count > 0:
                    func_lines.append(lines[j])
                    brace_count += lines[j].count("{") - lines[j].count("}")
                    j += 1

                blocks.append({
                    "name": name,
                    "line_start": i + 1,
                    "line_end": i + len(func_lines),
                    "lines": func_lines,
                    "params": params,
                })
                i = j
                matched = True
                break
        if not matched:
            i += 1
    return blocks


def analyze_complexity(code: str, language: str, file_name: str = "") -> ComplexityReport:
    _, lang_type = _get_patterns(language)

    if language in ("python", "ruby"):
        blocks = _extract_function_blocks_python(code)
    else:
        blocks = _extract_function_blocks_js(code)

    all_functions = []
    for block in blocks:
        loc = len([l for l in block["lines"] if l.strip()])
        cc = _calc_cyclomatic(block["lines"], lang_type)
        nesting = _calc_nesting(block["lines"], lang_type)
        param_count = len(block["params"])

        reasons = []
        if cc > COMPLEXITY_THRESHOLD:
            reasons.append(f"Cyclomatic complexity {cc} exceeds threshold {COMPLEXITY_THRESHOLD}")
        if nesting > NESTING_THRESHOLD:
            reasons.append(f"Nesting depth {nesting} exceeds threshold {NESTING_THRESHOLD}")
        if param_count > PARAM_THRESHOLD:
            reasons.append(f"Parameter count {param_count} exceeds threshold {PARAM_THRESHOLD}")
        if loc > LOC_THRESHOLD:
            reasons.append(f"Lines of code {loc} exceeds threshold {LOC_THRESHOLD}")

        all_functions.append(FunctionComplexity(
            name=block["name"],
            line_start=block["line_start"],
            line_end=block["line_end"],
            lines_of_code=loc,
            cyclomatic_complexity=cc,
            max_nesting_depth=nesting,
            parameter_count=param_count,
            is_flagged=len(reasons) > 0,
            flag_reasons=reasons,
        ))

    complexities = [f.cyclomatic_complexity for f in all_functions]
    avg = sum(complexities) / len(complexities) if complexities else 0
    max_cc = max(complexities) if complexities else 0
    most_complex = max(all_functions, key=lambda f: f.cyclomatic_complexity).name if all_functions else ""
    flagged = [f for f in all_functions if f.is_flagged]

    total_loc = len([l for l in code.split("\n") if l.strip()])
    if all_functions:
        maintainability = max(0, min(100, 171 - 5.2 * math.log(max_cc or 1) - 0.23 * avg - 16.2 * math.log(total_loc or 1) + 50))
    else:
        maintainability = 100.0

    return ComplexityReport(
        file_name=file_name,
        total_functions=len(all_functions),
        average_complexity=round(avg, 1),
        max_complexity=max_cc,
        most_complex_function=most_complex,
        flagged_functions=flagged,
        all_functions=all_functions,
        maintainability_score=round(maintainability, 1),
    )
