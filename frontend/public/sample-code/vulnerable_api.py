"""
A deliberately vulnerable Flask API for testing code review detection.
DO NOT use this code in production - it contains intentional security flaws.
"""

import os
import sqlite3
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)
app.config["DEBUG"] = True

# Hardcoded secrets
SECRET_KEY = "super_secret_key_12345"
DATABASE_PASSWORD = "admin123"
API_TOKEN = "sk-live-abc123def456ghi789"

# Overly permissive CORS
from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "*"}})

DB_PATH = "users.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            password TEXT,
            email TEXT,
            role TEXT DEFAULT 'user'
        )
    """)
    # Storing passwords in plaintext
    cursor.execute("INSERT OR IGNORE INTO users VALUES (1, 'admin', 'password123', 'admin@example.com', 'admin')")
    cursor.execute("INSERT OR IGNORE INTO users VALUES (2, 'user1', 'qwerty', 'user1@example.com', 'user')")
    conn.commit()
    conn.close()


init_db()


@app.route("/api/login", methods=["POST"])
def login():
    username = request.json.get("username")
    password = request.json.get("password")

    conn = get_db()
    cursor = conn.cursor()

    # SQL Injection vulnerability - string concatenation
    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
    cursor.execute(query)
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({"message": "Login successful", "user_id": user[0], "role": user[4]})
    return jsonify({"message": "Invalid credentials"}), 401


@app.route("/api/users", methods=["GET"])
def get_users():
    # No authentication required to list all users
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password, email, role FROM users")
    users = cursor.fetchall()
    conn.close()

    # Exposing passwords in response
    return jsonify([{
        "id": u[0], "username": u[1], "password": u[2],
        "email": u[3], "role": u[4]
    } for u in users])


@app.route("/api/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    # No authentication, no authorization check
    conn = get_db()
    cursor = conn.cursor()
    # SQL Injection
    cursor.execute(f"DELETE FROM users WHERE id = {user_id}")
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted"})


@app.route("/api/search", methods=["GET"])
def search_users():
    query = request.args.get("q", "")
    conn = get_db()
    cursor = conn.cursor()

    # SQL Injection via search parameter
    sql = "SELECT * FROM users WHERE username LIKE '%" + query + "%'"
    cursor.execute(sql)
    results = cursor.fetchall()
    conn.close()

    return jsonify({"results": [{"id": r[0], "username": r[1]} for r in results]})


@app.route("/api/execute", methods=["POST"])
def execute_code():
    # Remote code execution via eval
    code = request.json.get("code", "")
    result = eval(code)
    return jsonify({"result": str(result)})


@app.route("/api/files/<path:filename>", methods=["GET"])
def download_file(filename):
    # Path traversal vulnerability
    file_path = os.path.join("/app/uploads", filename)
    return send_file(file_path)


@app.route("/api/admin/config", methods=["POST"])
def update_config():
    # No authentication for admin endpoint
    config_data = request.json
    for key, value in config_data.items():
        app.config[key] = value
    return jsonify({"message": "Config updated", "config": dict(app.config)})


@app.route("/api/profile", methods=["PUT"])
def update_profile():
    user_id = request.json.get("user_id")
    new_data = request.json

    conn = get_db()
    cursor = conn.cursor()

    # Mass assignment vulnerability - allows updating role
    for field, value in new_data.items():
        if field != "user_id":
            cursor.execute(f"UPDATE users SET {field} = '{value}' WHERE id = {user_id}")

    conn.commit()
    conn.close()
    return jsonify({"message": "Profile updated"})


@app.route("/api/upload", methods=["POST"])
def upload_file():
    file = request.files.get("file")
    if file:
        # No file type validation, no size limit
        file.save(os.path.join("/app/uploads", file.filename))
        return jsonify({"message": "File uploaded", "path": file.filename})
    return jsonify({"error": "No file provided"}), 400


@app.route("/api/redirect", methods=["GET"])
def redirect_url():
    # Open redirect vulnerability
    url = request.args.get("url", "/")
    from flask import redirect
    return redirect(url)


@app.route("/api/render", methods=["POST"])
def render_template():
    # Server-side template injection
    from flask import render_template_string
    template = request.json.get("template", "")
    return render_template_string(template)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
