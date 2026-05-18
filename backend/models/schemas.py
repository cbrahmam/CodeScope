from pydantic import BaseModel
from typing import List, Optional


class FileInput(BaseModel):
    filename: str
    content: str
    language: Optional[str] = None


class ReviewCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = ""
    files: List[FileInput]


class ReviewResponse(BaseModel):
    id: str
    title: str
    language: str
    files: str
    status: str
    created_at: str
    updated_at: str


class FindingResponse(BaseModel):
    id: str
    review_id: str
    file_name: str
    line_start: int
    line_end: int
    category: str
    severity: str
    title: str
    description: str
    suggestion: Optional[str] = None
    suggested_fix: Optional[str] = None
    original_code: Optional[str] = None
    status: str
    created_at: str


class ReviewDetail(BaseModel):
    id: str
    title: str
    language: str
    files: str
    status: str
    created_at: str
    updated_at: str
    findings: List[FindingResponse] = []


class ReviewListItem(BaseModel):
    id: str
    title: str
    language: str
    status: str
    created_at: str
    updated_at: str
    file_count: int
    finding_counts: dict = {}
    total_findings: int = 0
    resolved_findings: int = 0
    score: Optional[float] = None


class CodeStructure(BaseModel):
    language: str
    total_lines: int
    code_lines: int
    comment_lines: int
    blank_lines: int
    functions: List[dict]
    classes: List[dict]
    imports: List[str]
    exports: List[str]
    comment_ratio: float


class Finding(BaseModel):
    file_name: str
    line_start: int
    line_end: int
    category: str
    severity: str
    title: str
    description: str
    why_it_matters: str = ""
    suggestion: str
    suggested_fix: str = ""
    original_code: str = ""
    confidence: str = "medium"
    references: List[str] = []


class FindingStatusUpdate(BaseModel):
    status: str


class FunctionComplexity(BaseModel):
    name: str
    line_start: int
    line_end: int
    lines_of_code: int
    cyclomatic_complexity: int
    max_nesting_depth: int
    parameter_count: int
    is_flagged: bool
    flag_reasons: List[str]


class ComplexityReport(BaseModel):
    file_name: str
    total_functions: int
    average_complexity: float
    max_complexity: int
    most_complex_function: str
    flagged_functions: List[FunctionComplexity]
    all_functions: List[FunctionComplexity]
    maintainability_score: float
