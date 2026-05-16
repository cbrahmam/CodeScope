import os
import aiosqlite
from config import settings

CREATE_REVIEWS = """
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    language TEXT,
    files TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT,
    updated_at TEXT
);
"""

CREATE_FINDINGS = """
CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    review_id TEXT,
    file_name TEXT,
    line_start INTEGER,
    line_end INTEGER,
    category TEXT,
    severity TEXT,
    title TEXT,
    description TEXT,
    suggestion TEXT,
    suggested_fix TEXT,
    original_code TEXT,
    status TEXT DEFAULT 'open',
    created_at TEXT,
    FOREIGN KEY (review_id) REFERENCES reviews(id)
);
"""

CREATE_COMMENTS = """
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    finding_id TEXT,
    review_id TEXT,
    author TEXT,
    content TEXT,
    line_number INTEGER,
    created_at TEXT,
    FOREIGN KEY (finding_id) REFERENCES findings(id),
    FOREIGN KEY (review_id) REFERENCES reviews(id)
);
"""


async def init_db():
    os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute(CREATE_REVIEWS)
        await db.execute(CREATE_FINDINGS)
        await db.execute(CREATE_COMMENTS)
        await db.commit()


async def get_db():
    db = await aiosqlite.connect(settings.DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    return db
