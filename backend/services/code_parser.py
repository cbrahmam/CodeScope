import re
from typing import Optional, List
from models.schemas import CodeStructure

EXTENSION_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".sql": "sql",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".sh": "shell",
    ".bash": "shell",
}

COMMENT_PATTERNS = {
    "python": {"single": "#", "multi_start": '"""', "multi_end": '"""'},
    "ruby": {"single": "#", "multi_start": "=begin", "multi_end": "=end"},
    "javascript": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "typescript": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "jsx": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "tsx": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "go": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "rust": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "java": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "c": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "cpp": {"single": "//", "multi_start": "/*", "multi_end": "*/"},
    "sql": {"single": "--", "multi_start": "/*", "multi_end": "*/"},
    "html": {"single": None, "multi_start": "<!--", "multi_end": "-->"},
    "css": {"single": None, "multi_start": "/*", "multi_end": "*/"},
    "shell": {"single": "#", "multi_start": None, "multi_end": None},
}


def detect_language(code: str, filename: Optional[str] = None) -> str:
    if filename:
        ext = ""
        parts = filename.rsplit(".", 1)
        if len(parts) > 1:
            ext = "." + parts[1].lower()
        if ext in EXTENSION_MAP:
            return EXTENSION_MAP[ext]

    heuristics = [
        (r"^\s*(?:from\s+\S+\s+)?import\s+\S+", "python"),
        (r"^\s*def\s+\w+\s*\(", "python"),
        (r"^\s*class\s+\w+.*:\s*$", "python"),
        (r"(?:import\s+.*\s+from\s+['\"]|require\s*\()", "javascript"),
        (r"(?:const|let|var)\s+\w+\s*=", "javascript"),
        (r"function\s+\w+\s*\(", "javascript"),
        (r"interface\s+\w+\s*\{", "typescript"),
        (r":\s*(?:string|number|boolean|void)\b", "typescript"),
        (r"<[A-Z]\w+[\s/>]", "jsx"),
        (r"^\s*func\s+\w+\s*\(", "go"),
        (r"^\s*package\s+\w+", "go"),
        (r"^\s*fn\s+\w+\s*\(", "rust"),
        (r"^\s*(?:pub\s+)?(?:struct|enum|impl)\s+", "rust"),
        (r"^\s*(?:public|private|protected)\s+class\s+", "java"),
        (r"^\s*(?:public|private|protected)\s+(?:static\s+)?(?:void|int|String)", "java"),
        (r"^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b", "sql"),
        (r"<!DOCTYPE\s+html|<html", "html"),
        (r"^\s*(?:body|div|span|\.[\w-]+|#[\w-]+)\s*\{", "css"),
    ]

    lines = code.split("\n")[:50]
    sample = "\n".join(lines)

    for pattern, lang in heuristics:
        if re.search(pattern, sample, re.MULTILINE | re.IGNORECASE):
            return lang

    return "plaintext"


def _count_lines(code: str, language: str) -> tuple:
    lines = code.split("\n")
    total = len(lines)
    code_lines = 0
    comment_lines = 0
    blank_lines = 0

    patterns = COMMENT_PATTERNS.get(language, {"single": "#", "multi_start": None, "multi_end": None})
    in_multi = False

    for line in lines:
        stripped = line.strip()

        if not stripped:
            blank_lines += 1
            continue

        if in_multi:
            comment_lines += 1
            if patterns["multi_end"] and patterns["multi_end"] in stripped:
                in_multi = False
            continue

        if patterns["multi_start"] and stripped.startswith(patterns["multi_start"]):
            comment_lines += 1
            if patterns["multi_end"] and patterns["multi_end"] not in stripped[len(patterns["multi_start"]):]:
                in_multi = True
            continue

        if patterns["single"] and stripped.startswith(patterns["single"]):
            comment_lines += 1
            continue

        code_lines += 1

    return total, code_lines, comment_lines, blank_lines


def _extract_python_functions(code: str) -> List[dict]:
    functions = []
    lines = code.split("\n")
    pattern = re.compile(r"^(\s*)(?:async\s+)?def\s+(\w+)\s*\((.*?)\)", re.DOTALL)

    i = 0
    while i < len(lines):
        match = pattern.match(lines[i])
        if match:
            indent = len(match.group(1))
            name = match.group(2)
            params_str = match.group(3)
            params = [p.strip().split(":")[0].split("=")[0].strip() for p in params_str.split(",") if p.strip()] if params_str.strip() else []
            if params and params[0] == "self":
                params = params[1:]
            line_start = i + 1
            line_end = line_start

            j = i + 1
            while j < len(lines):
                if lines[j].strip() == "":
                    j += 1
                    continue
                current_indent = len(lines[j]) - len(lines[j].lstrip())
                if current_indent <= indent and lines[j].strip():
                    break
                line_end = j + 1
                j += 1

            functions.append({"name": name, "line_start": line_start, "line_end": line_end, "params": params})
        i += 1

    return functions


def _extract_python_classes(code: str) -> List[dict]:
    classes = []
    lines = code.split("\n")
    class_pattern = re.compile(r"^(\s*)class\s+(\w+)")
    method_pattern = re.compile(r"^\s+(?:async\s+)?def\s+(\w+)")

    i = 0
    while i < len(lines):
        match = class_pattern.match(lines[i])
        if match:
            indent = len(match.group(1))
            name = match.group(2)
            line_start = i + 1
            line_end = line_start
            methods = []

            j = i + 1
            while j < len(lines):
                if lines[j].strip() == "":
                    j += 1
                    continue
                current_indent = len(lines[j]) - len(lines[j].lstrip())
                if current_indent <= indent and lines[j].strip():
                    break
                line_end = j + 1
                method_match = method_pattern.match(lines[j])
                if method_match:
                    methods.append(method_match.group(1))
                j += 1

            classes.append({"name": name, "line_start": line_start, "line_end": line_end, "methods": methods})
        i += 1

    return classes


def _extract_js_functions(code: str) -> List[dict]:
    functions = []
    lines = code.split("\n")

    patterns = [
        re.compile(r"(?:async\s+)?function\s+(\w+)\s*\((.*?)\)"),
        re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>"),
        re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\((.*?)\)"),
    ]

    for i, line in enumerate(lines):
        for pattern in patterns:
            match = pattern.search(line)
            if match:
                name = match.group(1)
                params_str = match.group(2)
                params = [p.strip().split("=")[0].split(":")[0].strip() for p in params_str.split(",") if p.strip()] if params_str.strip() else []

                line_end = i + 1
                brace_count = line.count("{") - line.count("}")
                j = i + 1
                while j < len(lines) and brace_count > 0:
                    brace_count += lines[j].count("{") - lines[j].count("}")
                    line_end = j + 1
                    j += 1

                functions.append({"name": name, "line_start": i + 1, "line_end": line_end, "params": params})
                break

    return functions


def _extract_js_classes(code: str) -> List[dict]:
    classes = []
    lines = code.split("\n")
    class_pattern = re.compile(r"class\s+(\w+)")
    method_pattern = re.compile(r"^\s+(?:async\s+)?(\w+)\s*\(")

    for i, line in enumerate(lines):
        match = class_pattern.search(line)
        if match:
            name = match.group(1)
            line_start = i + 1
            methods = []
            brace_count = line.count("{") - line.count("}")
            line_end = line_start

            j = i + 1
            while j < len(lines) and brace_count > 0:
                brace_count += lines[j].count("{") - lines[j].count("}")
                method_match = method_pattern.match(lines[j])
                if method_match and method_match.group(1) not in ("if", "for", "while", "switch", "return"):
                    methods.append(method_match.group(1))
                line_end = j + 1
                j += 1

            classes.append({"name": name, "line_start": line_start, "line_end": line_end, "methods": methods})

    return classes


def _extract_imports(code: str, language: str) -> List[str]:
    imports = []
    if language == "python":
        for match in re.finditer(r"^\s*(?:from\s+(\S+)\s+)?import\s+(.+)", code, re.MULTILINE):
            module = match.group(1) or match.group(2).split(",")[0].strip().split(" as ")[0]
            imports.append(module)
    elif language in ("javascript", "typescript", "jsx", "tsx"):
        for match in re.finditer(r"import\s+.*?\s+from\s+['\"](.+?)['\"]", code):
            imports.append(match.group(1))
        for match in re.finditer(r"require\s*\(\s*['\"](.+?)['\"]\s*\)", code):
            imports.append(match.group(1))
    elif language == "go":
        for match in re.finditer(r'"([^"]+)"', code):
            if "/" in match.group(1) or match.group(1) in ("fmt", "os", "io", "net", "sync", "time", "math", "sort", "strings", "strconv"):
                imports.append(match.group(1))
    elif language == "java":
        for match in re.finditer(r"^\s*import\s+([\w.]+);", code, re.MULTILINE):
            imports.append(match.group(1))
    elif language == "rust":
        for match in re.finditer(r"^\s*use\s+([\w:]+)", code, re.MULTILINE):
            imports.append(match.group(1))
    return imports


def _extract_exports(code: str, language: str) -> List[str]:
    exports = []
    if language in ("javascript", "typescript", "jsx", "tsx"):
        for match in re.finditer(r"export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)", code):
            exports.append(match.group(1))
        for match in re.finditer(r"module\.exports\s*=\s*(\w+)", code):
            exports.append(match.group(1))
    elif language == "go":
        for match in re.finditer(r"^\s*func\s+([A-Z]\w*)", code, re.MULTILINE):
            exports.append(match.group(1))
    return exports


def parse_code_structure(code: str, language: str) -> CodeStructure:
    total_lines, code_lines, comment_lines, blank_lines = _count_lines(code, language)

    if language == "python":
        functions = _extract_python_functions(code)
        classes = _extract_python_classes(code)
    elif language in ("javascript", "typescript", "jsx", "tsx"):
        functions = _extract_js_functions(code)
        classes = _extract_js_classes(code)
    else:
        functions = _extract_js_functions(code)
        classes = _extract_js_classes(code)

    imports = _extract_imports(code, language)
    exports = _extract_exports(code, language)

    return CodeStructure(
        language=language,
        total_lines=total_lines,
        code_lines=code_lines,
        comment_lines=comment_lines,
        blank_lines=blank_lines,
        functions=functions,
        classes=classes,
        imports=imports,
        exports=exports,
        comment_ratio=round(comment_lines / max(code_lines, 1), 2),
    )
