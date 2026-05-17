import uuid
from datetime import datetime, timezone
import socketio
from database import get_db

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

# Track online users per review: { review_id: { sid: {name, color} } }
online_users = {}

COLORS = ["#3FB950", "#58A6FF", "#D2A8FF", "#F78166", "#FF7B72", "#79C0FF", "#FFA657", "#7EE787"]


@sio.event
async def connect(sid, environ):
    pass


@sio.event
async def disconnect(sid):
    for review_id, users in list(online_users.items()):
        if sid in users:
            user = users.pop(sid)
            if not users:
                del online_users[review_id]
            await sio.emit("users_online", list(users.values()), room=review_id)
            await sio.emit("user_left", {"user_name": user["name"]}, room=review_id)
            break


@sio.event
async def join_review(sid, data):
    review_id = data.get("review_id")
    user_name = data.get("user_name", "Anonymous")

    sio.enter_room(sid, review_id)

    if review_id not in online_users:
        online_users[review_id] = {}

    color_idx = len(online_users[review_id]) % len(COLORS)
    online_users[review_id][sid] = {
        "name": user_name,
        "color": COLORS[color_idx],
        "sid": sid,
    }

    await sio.emit("users_online", list(online_users[review_id].values()), room=review_id)
    await sio.emit("user_joined", {"user_name": user_name}, room=review_id, skip_sid=sid)


@sio.event
async def leave_review(sid, data):
    review_id = data.get("review_id")
    if review_id in online_users and sid in online_users[review_id]:
        user = online_users[review_id].pop(sid)
        if not online_users[review_id]:
            del online_users[review_id]
        else:
            await sio.emit("users_online", list(online_users[review_id].values()), room=review_id)
        await sio.emit("user_left", {"user_name": user["name"]}, room=review_id)
    sio.leave_room(sid, review_id)


@sio.event
async def add_comment(sid, data):
    review_id = data.get("review_id")
    finding_id = data.get("finding_id")
    line_number = data.get("line_number")
    author = data.get("author", "Anonymous")
    content = data.get("content", "")

    if not content.strip():
        return

    comment_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()

    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO comments (id, finding_id, review_id, author, content, line_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (comment_id, finding_id, review_id, author, content, line_number, now),
        )
        await db.commit()
    finally:
        await db.close()

    comment = {
        "id": comment_id,
        "finding_id": finding_id,
        "review_id": review_id,
        "author": author,
        "content": content,
        "line_number": line_number,
        "created_at": now,
    }

    await sio.emit("new_comment", comment, room=review_id)


@sio.event
async def update_finding_status(sid, data):
    review_id = data.get("review_id")
    finding_id = data.get("finding_id")
    status = data.get("status")
    user_name = data.get("user_name", "Anonymous")

    if status not in ("open", "accepted", "dismissed", "resolved"):
        return

    db = await get_db()
    try:
        await db.execute("UPDATE findings SET status = ? WHERE id = ? AND review_id = ?",
                         (status, finding_id, review_id))
        await db.commit()
    finally:
        await db.close()

    await sio.emit("finding_status_changed", {
        "finding_id": finding_id,
        "status": status,
        "user_name": user_name,
    }, room=review_id, skip_sid=sid)


@sio.event
async def fix_applied(sid, data):
    review_id = data.get("review_id")
    finding_id = data.get("finding_id")
    user_name = data.get("user_name", "Anonymous")
    file_name = data.get("file_name", "")
    new_content = data.get("new_content", "")

    await sio.emit("fix_applied", {
        "finding_id": finding_id,
        "user_name": user_name,
        "file_name": file_name,
        "new_content": new_content,
    }, room=review_id, skip_sid=sid)


@sio.event
async def cursor_move(sid, data):
    review_id = data.get("review_id")
    await sio.emit("cursor_position", {
        "user_name": data.get("user_name"),
        "file_name": data.get("file_name"),
        "line": data.get("line"),
        "column": data.get("column"),
        "color": data.get("color", "#58A6FF"),
    }, room=review_id, skip_sid=sid)
