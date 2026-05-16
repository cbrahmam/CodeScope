from fastapi import APIRouter

router = APIRouter(prefix="/reviews", tags=["analysis"])

# Block 2: POST /api/reviews/{id}/analyze
# Block 2: GET /api/reviews/{id}/findings
# Block 2: GET /api/reviews/{id}/complexity
# Block 2: PUT /api/reviews/{id}/findings/{finding_id}
# Block 2: POST /api/reviews/{id}/findings/{finding_id}/apply
