# =============================================================
# main.py - AI Resume Analyzer v3  (FastAPI Backend)
# =============================================================
# Endpoints:
#   Auth        POST /register  POST /login  GET /profile/{u}
#   Analysis    POST /upload
#   Jobs        GET  /api/recommended-jobs
#               POST /api/fetch-live-jobs
#               GET  /api/jobs-count
#               DELETE /api/jobs/clear
#   Interview   POST /api/generate-interview-questions  (legacy)
#               POST /mock-interview/start
#               POST /mock-interview/answer
#               POST /mock-interview/save-result
#               GET  /mock-interview/result/{session_id}
#               GET  /mock-interview/history/{username}
#   Chat        POST /api/career-chat
#               GET  /api/career-chat/history/{username}
#   Resume      POST /api/generate-resume
#               GET  /api/download-resume/{filename}
#   Admin       GET  /admin/stats
#               GET  /admin/revenue
#               GET  /admin/users
#               GET  /admin/interviews
#   Activity    PUT  /user/activity
# =============================================================

import hashlib
import json
import os
import re
import shutil
import sqlite3
import threading
import time
from datetime import datetime, timedelta

import openai
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PyPDF2 import PdfReader

from linkedin_jobs import fetch_and_save, is_real_job_url

# -- App & env ----------------------------------------------
load_dotenv()
app = FastAPI(title="AI Resume Analyzer v3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Groq / OpenAI client -----------------------------------
openai.api_key  = os.getenv("GROQ_API_KEY", "")
openai.api_base = "https://api.groq.com/openai/v1"

# -- SQLite -------------------------------------------------
conn = sqlite3.connect("users.db", check_same_thread=False)
c    = conn.cursor()

c.executescript("""
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users(
    username TEXT UNIQUE,
    email    TEXT,
    password TEXT,
    role     TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resume_history(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    score    INTEGER,
    analysis TEXT,
    file_name TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs(
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name    TEXT,
    job_title       TEXT,
    location        TEXT,
    job_url         TEXT UNIQUE,
    job_description TEXT,
    skills_required TEXT,
    scraped_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumes(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT,
    name       TEXT,
    email      TEXT,
    phone      TEXT,
    summary    TEXT,
    skills     TEXT,
    education  TEXT,
    experience TEXT,
    projects   TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_questions(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT,
    questions  TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_history(
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT,
    role      TEXT,
    message   TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_interview_sessions(
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT,
    communication_score INTEGER DEFAULT 0,
    confidence_score    INTEGER DEFAULT 0,
    technical_score     INTEGER DEFAULT 0,
    professionalism_score INTEGER DEFAULT 0,
    body_language_score INTEGER DEFAULT 0,
    hiring_probability  INTEGER DEFAULT 0,
    hiring_decision     TEXT,
    strengths           TEXT,
    improvements        TEXT,
    recommended_skills  TEXT,
    questions_answers_json TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resume_analysis(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT,
    score      INTEGER,
    analysis   TEXT,
    file_name  TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_sessions(
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT,
    resume_analysis_id  INTEGER DEFAULT 0,
    mode                TEXT DEFAULT 'text',
    difficulty_level    TEXT DEFAULT 'medium',
    technical_score     REAL DEFAULT 0,
    hr_score            REAL DEFAULT 0,
    project_score       REAL DEFAULT 0,
    communication_score REAL DEFAULT 0,
    fluency_score       REAL DEFAULT 0,
    confidence_score    REAL DEFAULT 0,
    overall_score       REAL DEFAULT 0,
    questions_json      TEXT DEFAULT '[]',
    answers_json        TEXT DEFAULT '[]',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_activity(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_online   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT,
    plan       TEXT DEFAULT 'free',
    amount     REAL DEFAULT 0,
    status     TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
""")

# Safe migration: add columns if they don't exist
def safe_add_column(table: str, col: str, col_def: str):
    try:
        c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
        conn.commit()
    except Exception:
        pass  # Column already exists

safe_add_column("users", "role", "TEXT DEFAULT 'user'")
safe_add_column("users", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")
safe_add_column("resume_history", "file_name", "TEXT DEFAULT ''")
safe_add_column("resume_history", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")

conn.commit()

# Seed mock subscription data for admin demo
def _seed_subscriptions():
    count = c.execute("SELECT COUNT(*) FROM subscriptions").fetchone()[0]
    if count > 0:
        return
    plans = [
        ("basic", 9.99), ("premium", 19.99), ("free", 0),
        ("basic", 9.99), ("premium", 19.99), ("premium", 19.99),
        ("basic", 9.99), ("free", 0), ("premium", 19.99), ("basic", 9.99),
    ]
    for i, (plan, amount) in enumerate(plans):
        # Use dates spread across last 12 months
        days_ago = i * 25
        dt = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
        c.execute(
            "INSERT OR IGNORE INTO subscriptions(username, plan, amount, status, created_at) VALUES(?,?,?,?,?)",
            (f"user_{i}", plan, amount, "active", dt)
        )
    conn.commit()

threading.Thread(target=_seed_subscriptions, daemon=True).start()

# -- Seed real LinkedIn jobs on startup ---------------------
STARTUP_QUERIES = [
    ("software engineer",    "India"),
    ("python developer",     "India"),
    ("react developer",      "India"),
    ("data scientist",       "India"),
    ("full stack developer", "India"),
    ("java developer",       "India"),
    ("devops engineer",      "India"),
    ("machine learning engineer", "India"),
]

def _seed_startup():
    existing = c.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    if existing > 0:
        print(f"[jobs] {existing} jobs already in DB, skipping seed.")
        return

    print("[jobs] Empty DB - fetching real LinkedIn jobs...")
    total = 0
    for query, loc in STARTUP_QUERIES:
        try:
            saved = fetch_and_save(
                query    = query,
                location = loc,
                count    = 8,
                db_conn  = conn,
                fetch_descriptions = True,
            )
            total += saved
            print(f"[jobs]    '{query}': {saved} saved")
        except Exception as e:
            print(f"[jobs]    '{query}': {e}")

    final = c.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    print(f"[jobs] Seeding done. {final} real LinkedIn jobs in DB.")

threading.Thread(target=_seed_startup, daemon=True).start()


# -- Skill list for ATS analysis ----------------------------
REQUIRED_SKILLS = [
    "python","java","react","sql","aws","docker","git",
    "machine learning","data structures","fastapi",
]

# -- Helpers ------------------------------------------------
def hash_pw(p: str) -> str:
    return hashlib.sha256(p.encode()).hexdigest()

def extract_pdf(path: str) -> str:
    reader = PdfReader(path)
    return "".join(page.extract_text() or "" for page in reader.pages)

def call_ai(system: str, user: str, max_tokens: int = 900) -> str:
    res = openai.ChatCompletion.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=0.2,
        max_tokens=max_tokens,
    )
    return res["choices"][0]["message"]["content"]

def extract_json(text: str) -> dict:
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        text = text[start:end+1]
    import re
    text = re.sub(r',\s*([\]}])', r'\1', text)
    return json.loads(text, strict=False)

def analyze_resume(text: str) -> str:
    prompt = f"""
You are a professional ATS resume analyzer. Return ONLY valid JSON with at least 5 items per list.

{{
  "summary":    "3 professional sentences",
  "skills":     ["skill1","skill2","skill3","skill4","skill5"],
  "strengths":  ["s1","s2","s3","s4","s5"],
  "weaknesses": ["w1","w2","w3","w4","w5"],
  "improvements": ["i1","i2","i3","i4","i5"],
  "score":      <number 0-100>
}}

Resume:
{text[:4000]}
"""
    return call_ai("Return only valid JSON.", prompt)

def calculate_score(text: str, ai_score: int) -> int:
    score = ai_score
    wc    = len(text.split())
    if wc < 200:   score -= 10
    elif wc > 900: score -= 5
    hits  = sum(1 for s in ["python","java","sql","react","ml","ai","fastapi"] if s in text.lower())
    score += hits * 2
    return max(0, min(100, score))

def detect_missing(text: str) -> list:
    tl = text.lower()
    return [s.title() for s in REQUIRED_SKILLS if s not in tl]

def _update_activity(username: str):
    try:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        c.execute("""
            INSERT INTO user_activity(username, last_active, is_online)
            VALUES(?,?,1)
            ON CONFLICT(username) DO UPDATE SET last_active=?, is_online=1
        """, (username, now, now))
        conn.commit()
    except Exception:
        pass


# -- Pydantic models ----------------------------------------
class UserModel(BaseModel):
    username: str
    email:    str = ""
    password: str

class ChatRequest(BaseModel):
    username: str
    message:  str

class ResumeData(BaseModel):
    username:   str       = "guest"
    name:       str
    email:      str
    phone:      str
    summary:    str       = ""
    education:  list[str] = []
    skills:     list[str] = []
    projects:   list[str] = []
    experience: list[str] = []

class MockInterviewStartRequest(BaseModel):
    username:         str = "guest"
    difficulty_level: str = "medium"  # easy | medium | hard
    mode:             str = "text"    # text | voice

class MockInterviewAnswerRequest(BaseModel):
    session_id:    int
    question:      str
    answer:        str
    question_type: str = "technical"  # technical | hr | project
    mode:          str = "text"       # text | voice

class SaveInterviewResultRequest(BaseModel):
    session_id:         int
    username:           str
    technical_score:    float = 0
    hr_score:           float = 0
    project_score:      float = 0
    communication_score: float = 0
    fluency_score:      float = 0
    confidence_score:   float = 0
    overall_score:      float = 0
    answers_json:       str   = "[]"

class ActivityRequest(BaseModel):
    username:  str
    is_online: bool = True


# =============================================================
# AUTH
# =============================================================

@app.post("/register")
def register(user: UserModel):
    existing = c.execute(
        "SELECT username FROM users WHERE username=?", (user.username,)
    ).fetchone()
    if existing:
        return {"success": False, "message": "Username already exists. Please choose a different username."}
    try:
        c.execute("INSERT INTO users(username, email, password, role) VALUES(?,?,?,?)",
                  (user.username, user.email, hash_pw(user.password), "user"))
        conn.commit()
        _update_activity(user.username)
        return {"success": True, "message": "Account created successfully!"}
    except Exception as e:
        return {"success": False, "message": f"Registration failed: {e}"}


@app.post("/login")
def login(user: UserModel):
    row = c.execute(
        "SELECT username, password FROM users WHERE username=?", (user.username,)
    ).fetchone()
    if not row:
        return {"success": False, "message": "Username not found. Please register first."}
    if row[1] != hash_pw(user.password):
        return {"success": False, "message": "Incorrect password. Please try again."}
    _update_activity(user.username)
    return {"success": True, "message": "Login successful"}


@app.get("/profile/{username}")
def profile(username: str):
    row = c.execute(
        "SELECT username, email, role FROM users WHERE username=?", (username,)
    ).fetchone()
    if not row:
        return {"success": False}
    _update_activity(username)
    return {"username": row[0], "email": row[1], "role": row[2] or "user"}


# =============================================================
# RESUME UPLOAD & ATS ANALYSIS
# =============================================================

@app.post("/upload")
async def upload(file: UploadFile = File(...), username: str = "guest"):
    os.makedirs("uploads", exist_ok=True)
    path = f"uploads/{file.filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text    = extract_pdf(path)
    raw     = analyze_resume(text)

    try:
        data = extract_json(raw)
    except Exception as e:
        with open("json_error_log.txt", "w") as err_file:
            err_file.write(f"Error: {e}\n\nRAW OUTPUT:\n{raw}")
        data = {
            "summary":"","skills":[],"strengths":[],"weaknesses":[],
            "improvements":[],"education":[],"experience":[],"projects":[],"score":60
        }

    score   = calculate_score(text, data.get("score", 60))
    missing = detect_missing(text)
    data["missing_skills"] = missing
    data["score"] = score

    c.execute(
        "INSERT INTO resume_history(username, score, analysis, file_name) VALUES(?,?,?,?)",
        (username, score, json.dumps(data), file.filename)
    )
    conn.commit()
    _update_activity(username)

    return {
        "score":          score,
        "summary":        data.get("summary", ""),
        "skills":         data.get("skills", []),
        "strengths":      data.get("strengths", []),
        "weaknesses":     data.get("weaknesses", []),
        "improvements":   data.get("improvements", []),
        "missing_skills": missing,
        "education":      data.get("education", []),
        "experience":     data.get("experience", []),
        "projects":       data.get("projects", []),
        "file_name":      file.filename,
    }


@app.delete("/api/clear-resume")
def clear_resume(username: str = "guest"):
    c.execute("DELETE FROM resume_history WHERE username=?", (username,))
    conn.commit()
    return {"success": True, "message": "Resume history cleared."}


# =============================================================
# FEATURE 1 - JOB RECOMMENDATION  (real LinkedIn jobs)
# =============================================================

@app.get("/api/recommended-jobs")
def recommended_jobs(username: str = "guest", location: str = ""):
    row = c.execute(
        "SELECT analysis FROM resume_history WHERE username=? ORDER BY id DESC LIMIT 1",
        (username,),
    ).fetchone()

    user_skills: list[str] = []
    if row:
        try:
            user_skills = [s.lower().strip() for s in json.loads(row[0]).get("skills", [])]
        except Exception:
            pass

    loc = location.strip().lower()
    if loc:
        all_rows = c.execute(
            "SELECT id, company_name, job_title, location, job_url, job_description, skills_required FROM jobs"
        ).fetchall()
        rows = [r for r in all_rows if loc in (r[3] or "").lower() or loc in (r[5] or "").lower()]
        if len(rows) < 5:
            rows = all_rows
    else:
        rows = c.execute(
            "SELECT id, company_name, job_title, location, job_url, job_description, skills_required FROM jobs"
        ).fetchall()

    matched = []
    for jid, company, title, job_loc, job_url, desc, skills_req in rows:
        if not is_real_job_url(job_url):
            continue

        required = [s.strip().lower() for s in (skills_req or "").split(",") if s.strip()]

        if required and user_skills:
            match_count = 0
            for us in user_skills:
                for req in required:
                    if us == req or us in req or req in us:
                        match_count += 1
                        break
            match_pct = round(min(match_count / len(required) * 100, 100))
        else:
            match_pct = 0

        matched.append({
            "id":              jid,
            "company":         company or "Unknown Company",
            "title":           title,
            "location":        job_loc or "India",
            "url":             job_url,
            "description":     (desc or "")[:300].rstrip() + ("..." if len(desc or "") > 300 else ""),
            "skills_required": required,
            "match_score":     match_pct,
        })

    matched.sort(key=lambda x: x["match_score"], reverse=True)
    return {"jobs": matched, "user_skills": user_skills, "total": len(matched)}


@app.post("/api/fetch-live-jobs")
def fetch_live_jobs(
    background_tasks: BackgroundTasks,
    query:    str = "software engineer",
    location: str = "India",
    count:    int = 25,
):
    def _bg():
        try:
            saved = fetch_and_save(
                query    = query,
                location = location,
                count    = min(count, 50),
                db_conn  = conn,
                fetch_descriptions = True,
            )
            print(f"[fetch-live-jobs] Saved {saved} new jobs for '{query}' / '{location}'")
        except Exception as e:
            print(f"[fetch-live-jobs] Error: {e}")

    background_tasks.add_task(_bg)
    return {
        "status":  "started",
        "message": f"Fetching up to {count} real LinkedIn jobs for '{query}' in '{location}'...",
    }


@app.get("/api/jobs-count")
def jobs_count():
    n = c.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    return {"total": n}


@app.delete("/api/jobs/clear")
def clear_jobs():
    c.execute("DELETE FROM jobs")
    conn.commit()
    return {"success": True, "message": "All jobs cleared."}


# =============================================================
# LEGACY INTERVIEW PREPARATION (kept for backward compat)
# =============================================================

@app.post("/api/generate-interview-questions")
async def gen_interview_questions(
    file:     UploadFile = File(None),
    username: str        = "guest",
):
    resume_text = ""
    if file:
        os.makedirs("uploads", exist_ok=True)
        path = f"uploads/{file.filename}"
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        resume_text = extract_pdf(path)

    if not resume_text:
        row = c.execute(
            "SELECT analysis FROM resume_history WHERE username=? ORDER BY id DESC LIMIT 1",
            (username,),
        ).fetchone()
        if row:
            try:
                d = json.loads(row[0])
                resume_text = (
                    f"Skills: {', '.join(d.get('skills', []))}\n"
                    f"Summary: {d.get('summary', '')}"
                )
            except Exception:
                pass

    if not resume_text:
        return {"error": "No resume data found. Upload a resume first."}

    prompt = f"""
You are an expert interview coach. Generate questions from the resume below.

Return ONLY valid JSON:
{{
  "technical": [{{"question":"...","hint":"..."}}],
  "hr":        [{{"question":"...","hint":"..."}}],
  "project":   [{{"question":"...","hint":"..."}}]
}}

Rules:
- 5 technical questions based on listed skills
- 5 HR questions (soft skills, culture fit, career goals)
- 5 project-based questions about listed projects/experience
- hint = 1-sentence answering tip

Resume:
{resume_text[:2000]}
"""
    raw     = call_ai("Return only valid JSON, no markdown.", prompt, max_tokens=1200)

    try:
        return extract_json(raw)
    except Exception:
        return {
            "technical": [{"question": "Describe your technical background.", "hint": "Focus on key skills."}],
            "hr":        [{"question": "Tell me about yourself.",             "hint": "Keep it under 2 minutes."}],
            "project":   [{"question": "Walk me through your best project.",  "hint": "Use the STAR method."}],
        }


# =============================================================
# MOCK INTERVIEW — NEW ENDPOINTS
# =============================================================

DIFFICULTY_GUIDANCE = {
    "easy":   "Generate beginner-level questions. Focus on definitions, basic concepts, and 'What is X?' style questions.",
    "medium": "Generate intermediate questions. Focus on differences, use cases, hands-on concepts.",
    "hard":   "Generate advanced questions. Focus on internals, architecture, edge cases, performance, and system design.",
}

@app.post("/mock-interview/start")
async def mock_interview_start(req: MockInterviewStartRequest):
    """
    Generate interview questions from the user's latest resume analysis.
    No file upload needed. Supports difficulty levels.
    """
    row = c.execute(
        "SELECT analysis, file_name, id FROM resume_history WHERE username=? ORDER BY id DESC LIMIT 1",
        (req.username,),
    ).fetchone()

    if not row:
        return {"error": "No resume found. Please upload and analyze your resume first."}

    try:
        analysis = json.loads(row[0])
        resume_id = row[2]
    except Exception:
        return {"error": "Could not read resume data."}

    skills   = analysis.get("skills", [])
    projects = analysis.get("projects", [])
    education = analysis.get("education", [])
    experience = analysis.get("experience", [])
    summary  = analysis.get("summary", "")

    difficulty_note = DIFFICULTY_GUIDANCE.get(req.difficulty_level, DIFFICULTY_GUIDANCE["medium"])

    prompt = f"""
You are an expert technical interview coach. Generate personalized interview questions.

{difficulty_note}

Resume Data:
- Skills: {', '.join(skills[:10])}
- Projects: {'; '.join(projects[:3])}
- Education: {'; '.join(education[:2])}
- Experience: {'; '.join(experience[:3])}
- Summary: {summary[:300]}

Return ONLY valid JSON with exactly 5 questions per category:
{{
  "technical": [{{"question": "...", "hint": "1-sentence tip", "category": "technical"}}],
  "hr":        [{{"question": "...", "hint": "1-sentence tip", "category": "hr"}}],
  "project":   [{{"question": "...", "hint": "1-sentence tip", "category": "project"}}]
}}

Rules:
- Technical: based on the candidate's actual listed skills
- HR: career goals, teamwork, communication, culture fit
- Project: based on actual listed projects and experience
- Each question must be specific to THIS candidate's resume
"""
    raw     = call_ai("Return only valid JSON, no markdown.", prompt, max_tokens=1500)

    try:
        questions = extract_json(raw)
    except Exception:
        questions = {
            "technical": [
                {"question": "Describe your experience with " + (skills[0] if skills else "programming"), "hint": "Give specific examples.", "category": "technical"},
                {"question": "What are your strongest technical skills?", "hint": "Be specific with examples.", "category": "technical"},
                {"question": "Describe a complex technical problem you solved.", "hint": "Use the STAR method.", "category": "technical"},
                {"question": "How do you keep your technical skills up to date?", "hint": "Mention courses, projects.", "category": "technical"},
                {"question": "What tools do you use for version control?", "hint": "Mention Git workflows.", "category": "technical"},
            ],
            "hr": [
                {"question": "Tell me about yourself.", "hint": "Keep it professional and under 2 minutes.", "category": "hr"},
                {"question": "Why should we hire you?", "hint": "Link your skills to the role requirements.", "category": "hr"},
                {"question": "What is your greatest strength?", "hint": "Back it up with a real example.", "category": "hr"},
                {"question": "Where do you see yourself in 5 years?", "hint": "Show ambition aligned with the company.", "category": "hr"},
                {"question": "How do you handle tight deadlines?", "hint": "Give a specific situation.", "category": "hr"},
            ],
            "project": [
                {"question": "Walk me through your most impressive project.", "hint": "Cover problem, solution, outcome.", "category": "project"},
                {"question": "What challenges did you face in your projects?", "hint": "Show problem-solving skills.", "category": "project"},
                {"question": "How did you choose your tech stack?", "hint": "Explain the reasoning.", "category": "project"},
                {"question": "How did you handle project deadlines?", "hint": "Be specific about your approach.", "category": "project"},
                {"question": "What would you improve in your past projects?", "hint": "Show self-awareness.", "category": "project"},
            ],
        }

    # Create session in DB
    c.execute("""
        INSERT INTO interview_sessions(username, resume_analysis_id, mode, difficulty_level, questions_json)
        VALUES(?,?,?,?,?)
    """, (req.username, resume_id, req.mode, req.difficulty_level, json.dumps(questions)))
    conn.commit()
    session_id = c.lastrowid

    return {
        "session_id":      session_id,
        "questions":       questions,
        "difficulty_level": req.difficulty_level,
        "mode":            req.mode,
        "resume_summary": {
            "skills":    skills[:8],
            "projects":  projects[:3],
            "education": education[:2],
            "experience": experience[:2],
        },
    }


@app.post("/mock-interview/answer")
async def mock_interview_answer(req: MockInterviewAnswerRequest):
    """
    Evaluate a single interview answer with AI.
    Returns detailed feedback including score, confidence, strengths, improvements.
    """
    is_voice = req.mode == "voice"
    voice_metrics = ""
    if is_voice:
        voice_metrics = """
- communication_score: 0-100 (how well-structured and clear the answer is)
- fluency_score: 0-100 (how smooth and natural the speech was — infer from transcript quality)
"""

    prompt = f"""
You are an expert interview evaluator. Evaluate this interview answer strictly and fairly.

Question Type: {req.question_type}
Question: {req.question}
Candidate's Answer: {req.answer}

Return ONLY valid JSON:
{{
  "score": <0-10>,
  "confidence_score": <0-100>,
  "communication_score": <0-100>,
  "fluency_score": <0-100>,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "sample_best_answer": "A complete ideal answer to this question in 3-5 sentences."
}}

Evaluation criteria:
- score: accuracy and depth of technical answer (0=wrong, 10=perfect)
- confidence_score: infer from answer length, specificity, and decisiveness
{voice_metrics if is_voice else ""}
- Give at least 2 strengths and 2 improvements
- sample_best_answer must be tailored to this exact question
"""
    raw     = call_ai("Return only valid JSON, no markdown.", prompt, max_tokens=800)

    try:
        result = extract_json(raw)
    except Exception:
        result = {
            "score":               5,
            "confidence_score":    50,
            "communication_score": 50,
            "fluency_score":       50,
            "strengths":           ["You attempted to answer the question", "Some relevant points mentioned"],
            "improvements":        ["Add more specific examples", "Structure your answer better"],
            "sample_best_answer":  "A strong answer would include specific examples, technical depth, and a clear structure.",
        }

    # Ensure all fields exist
    result.setdefault("communication_score", 50)
    result.setdefault("fluency_score", 50)
    result.setdefault("confidence_score", 50)

    return result


@app.post("/mock-interview/save-result")
async def mock_interview_save_result(req: SaveInterviewResultRequest):
    """Save final interview scores to DB."""
    c.execute("""
        UPDATE interview_sessions
        SET technical_score=?, hr_score=?, project_score=?,
            communication_score=?, fluency_score=?, confidence_score=?,
            overall_score=?, answers_json=?
        WHERE id=? AND username=?
    """, (
        req.technical_score, req.hr_score, req.project_score,
        req.communication_score, req.fluency_score, req.confidence_score,
        req.overall_score, req.answers_json,
        req.session_id, req.username,
    ))
    conn.commit()
    return {"success": True, "session_id": req.session_id}


@app.get("/mock-interview/result/{session_id}")
async def mock_interview_result(session_id: int):
    row = c.execute(
        """SELECT id, username, mode, difficulty_level, technical_score, hr_score,
           project_score, communication_score, fluency_score, confidence_score,
           overall_score, questions_json, answers_json, created_at
           FROM interview_sessions WHERE id=?""",
        (session_id,)
    ).fetchone()
    if not row:
        return {"error": "Session not found"}
    keys = ["id","username","mode","difficulty_level","technical_score","hr_score",
            "project_score","communication_score","fluency_score","confidence_score",
            "overall_score","questions_json","answers_json","created_at"]
    return dict(zip(keys, row))


@app.get("/mock-interview/history/{username}")
async def mock_interview_history(username: str):
    rows = c.execute(
        """SELECT id, mode, difficulty_level, technical_score, hr_score, project_score,
           communication_score, fluency_score, confidence_score, overall_score, created_at
           FROM interview_sessions WHERE username=? ORDER BY id DESC LIMIT 20""",
        (username,)
    ).fetchall()
    keys = ["id","mode","difficulty_level","technical_score","hr_score","project_score",
            "communication_score","fluency_score","confidence_score","overall_score","created_at"]
    return {"sessions": [dict(zip(keys, row)) for row in rows]}


# =============================================================
# USER ACTIVITY
# =============================================================

@app.put("/user/activity")
async def update_activity(req: ActivityRequest):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("""
        INSERT INTO user_activity(username, last_active, is_online)
        VALUES(?,?,?)
        ON CONFLICT(username) DO UPDATE SET last_active=?, is_online=?
    """, (req.username, now, 1 if req.is_online else 0, now, 1 if req.is_online else 0))
    conn.commit()
    return {"success": True}


# =============================================================
# ADMIN ENDPOINTS
# =============================================================

@app.get("/admin/stats")
def admin_stats():
    total_users   = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    total_resumes = c.execute("SELECT COUNT(*) FROM resume_history").fetchone()[0]
    total_interviews = c.execute("SELECT COUNT(*) FROM interview_sessions WHERE overall_score > 0").fetchone()[0]

    cutoff_24h = (datetime.now() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    active_users = c.execute(
        "SELECT COUNT(*) FROM user_activity WHERE last_active >= ?", (cutoff_24h,)
    ).fetchone()[0]
    online_users = c.execute(
        "SELECT COUNT(*) FROM user_activity WHERE is_online=1"
    ).fetchone()[0]

    total_revenue = c.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM subscriptions WHERE status='active'"
    ).fetchone()[0]

    voice_interviews = c.execute(
        "SELECT COUNT(*) FROM interview_sessions WHERE mode='voice' AND overall_score > 0"
    ).fetchone()[0]

    avg_comm = c.execute(
        "SELECT COALESCE(AVG(communication_score), 0) FROM interview_sessions WHERE overall_score > 0"
    ).fetchone()[0]

    avg_conf = c.execute(
        "SELECT COALESCE(AVG(confidence_score), 0) FROM interview_sessions WHERE overall_score > 0"
    ).fetchone()[0]

    # Difficulty distribution
    diff_rows = c.execute(
        "SELECT difficulty_level, COUNT(*) FROM interview_sessions WHERE overall_score > 0 GROUP BY difficulty_level"
    ).fetchall()
    difficulty_dist = {row[0]: row[1] for row in diff_rows}

    return {
        "totalUsers":         total_users,
        "activeUsers":        active_users,
        "onlineUsers":        online_users,
        "totalResumes":       total_resumes,
        "totalInterviews":    total_interviews,
        "totalRevenue":       round(total_revenue, 2),
        "voiceInterviews":    voice_interviews,
        "avgCommunication":   round(avg_comm, 1),
        "avgConfidence":      round(avg_conf, 1),
        "difficultyDistribution": difficulty_dist,
    }


@app.get("/admin/revenue")
def admin_revenue():
    now = datetime.now()

    # Monthly revenue (current month)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    monthly = c.execute(
        "SELECT COALESCE(SUM(amount),0) FROM subscriptions WHERE status='active' AND created_at >= ?",
        (month_start,)
    ).fetchone()[0]

    # Yearly revenue
    year_start = now.replace(month=1, day=1).strftime("%Y-%m-%d")
    yearly = c.execute(
        "SELECT COALESCE(SUM(amount),0) FROM subscriptions WHERE status='active' AND created_at >= ?",
        (year_start,)
    ).fetchone()[0]

    # Total revenue
    total = c.execute(
        "SELECT COALESCE(SUM(amount),0) FROM subscriptions WHERE status='active'"
    ).fetchone()[0]

    # Monthly breakdown for chart (last 12 months)
    monthly_chart = []
    for i in range(11, -1, -1):
        month_dt = now - timedelta(days=i*30)
        m_start  = month_dt.replace(day=1).strftime("%Y-%m-%d")
        if i > 0:
            prev_month = month_dt - timedelta(days=30)
            m_end = prev_month.replace(day=1).strftime("%Y-%m-%d")
            # go forward from m_start
            next_m = (month_dt.replace(day=28) + timedelta(days=4)).replace(day=1)
            m_end  = next_m.strftime("%Y-%m-%d")
        else:
            m_end = (now + timedelta(days=31)).replace(day=1).strftime("%Y-%m-%d")

        rev = c.execute(
            "SELECT COALESCE(SUM(amount),0) FROM subscriptions WHERE created_at >= ? AND created_at < ?",
            (m_start, m_end)
        ).fetchone()[0]
        monthly_chart.append({
            "month": month_dt.strftime("%b %Y"),
            "revenue": round(rev, 2),
        })

    # Subscription distribution
    plan_rows = c.execute(
        "SELECT plan, COUNT(*) FROM subscriptions WHERE status='active' GROUP BY plan"
    ).fetchall()
    subscription_dist = [{"plan": r[0], "count": r[1]} for r in plan_rows]

    return {
        "monthlyRevenue":   round(monthly, 2),
        "yearlyRevenue":    round(yearly, 2),
        "totalRevenue":     round(total, 2),
        "monthlyChart":     monthly_chart,
        "subscriptionDist": subscription_dist,
    }


@app.get("/admin/users")
def admin_users(limit: int = 20):
    rows = c.execute(
        """SELECT u.username, u.email, u.role, u.created_at,
           COALESCE(a.last_active, u.created_at) as last_active,
           COALESCE(a.is_online, 0) as is_online
           FROM users u
           LEFT JOIN user_activity a ON u.username = a.username
           ORDER BY u.rowid DESC LIMIT ?""",
        (limit,)
    ).fetchall()
    users = []
    for row in rows:
        users.append({
            "username":    row[0],
            "email":       row[1],
            "role":        row[2] or "user",
            "joinDate":    row[3] or "",
            "lastActive":  row[4] or "",
            "isOnline":    bool(row[5]),
        })

    # Recent resume uploads
    resume_rows = c.execute(
        "SELECT username, file_name, score, created_at FROM resume_history ORDER BY id DESC LIMIT 20"
    ).fetchall()
    resumes = [{"username": r[0], "fileName": r[1] or "resume.pdf", "score": r[2], "uploadDate": r[3] or ""} for r in resume_rows]

    return {"users": users, "recentResumes": resumes}


@app.get("/admin/interviews")
def admin_interviews(limit: int = 20):
    rows = c.execute(
        """SELECT username, mode, difficulty_level, technical_score, hr_score,
           project_score, communication_score, overall_score, created_at
           FROM interview_sessions ORDER BY id DESC LIMIT ?""",
        (limit,)
    ).fetchall()
    interviews = []
    for row in rows:
        interviews.append({
            "username":    row[0],
            "mode":        row[1],
            "difficulty":  row[2],
            "technical":   round(row[3] or 0, 1),
            "hr":          round(row[4] or 0, 1),
            "project":     round(row[5] or 0, 1),
            "communication": round(row[6] or 0, 1),
            "overall":     round(row[7] or 0, 1),
            "date":        row[8] or "",
        })
    return {"interviews": interviews}


# =============================================================
# FEATURE 3 - CAREER MENTOR CHATBOT
# =============================================================

@app.post("/api/career-chat")
def career_chat(req: ChatRequest):
    resume_ctx = ""
    row = c.execute(
        "SELECT score, analysis FROM resume_history WHERE username=? ORDER BY id DESC LIMIT 1",
        (req.username,),
    ).fetchone()
    if row:
        try:
            score, aj = row
            d = json.loads(aj)
            resume_ctx = (
                f"ATS Score: {score}/100\n"
                f"Skills: {', '.join(d.get('skills', []))}\n"
                f"Missing Skills: {', '.join(d.get('missing_skills', []))}\n"
                f"Summary: {d.get('summary', '')}"
            )
        except Exception:
            pass

    jobs_ctx = ", ".join(
        f"{r[0]} at {r[1]}"
        for r in c.execute("SELECT job_title, company_name FROM jobs LIMIT 5").fetchall()
    )

    hist = c.execute(
        "SELECT role, message FROM chat_history WHERE username=? ORDER BY id DESC LIMIT 10",
        (req.username,),
    ).fetchall()
    hist.reverse()

    system = f"""You are an expert AI Career Mentor providing personalised guidance.

User Career Profile:
{resume_ctx or "No resume uploaded yet - give general advice."}

Top Matching Jobs: {jobs_ctx or "None yet."}

Be encouraging, specific, and concise (under 200 words per reply).
"""
    messages  = [{"role": "system", "content": system}]
    messages += [{"role": r[0], "content": r[1]} for r in hist]
    messages += [{"role": "user", "content": req.message}]

    res   = openai.ChatCompletion.create(
        model="openai/gpt-oss-20b", messages=messages, temperature=0.7, max_tokens=500,
    )
    reply = res["choices"][0]["message"]["content"]

    c.execute("INSERT INTO chat_history(username,role,message) VALUES(?,?,?)",
              (req.username, "user", req.message))
    c.execute("INSERT INTO chat_history(username,role,message) VALUES(?,?,?)",
              (req.username, "assistant", reply))
    conn.commit()
    return {"reply": reply}


@app.get("/api/career-chat/history/{username}")
def chat_history(username: str):
    rows = c.execute(
        "SELECT role, message, timestamp FROM chat_history WHERE username=? ORDER BY id DESC LIMIT 50",
        (username,),
    ).fetchall()
    rows.reverse()
    return {"history": [{"role": r[0], "message": r[1], "timestamp": r[2]} for r in rows]}


@app.delete("/api/career-chat/clear/{username}")
def clear_chat_history(username: str):
    c.execute("DELETE FROM chat_history WHERE username=?", (username,))
    conn.commit()
    return {"success": True, "message": f"Chat history cleared for {username}"}


# =============================================================
# FEATURE 4 - ATS RESUME BUILDER
# =============================================================

@app.post("/api/generate-resume")
def generate_resume(data: ResumeData):
    from reportlab.lib             import colors
    from reportlab.lib.enums       import TA_CENTER, TA_LEFT
    from reportlab.lib.pagesizes   import A4
    from reportlab.lib.styles      import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units       import cm
    from reportlab.platypus        import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

    try:
        polished = call_ai(
            "You are a professional resume writer.",
            f"""Write a 3-sentence ATS-optimised professional summary.
Name: {data.name}
Skills: {', '.join(data.skills)}
Experience: {'; '.join(data.experience)}
Existing summary: {data.summary}
Return only the summary text. No labels or quotes.""",
            max_tokens=200,
        ).strip()
    except Exception:
        polished = data.summary or (
            f"Experienced professional skilled in {', '.join(data.skills[:3])}."
            if data.skills else "Motivated professional seeking a challenging opportunity."
        )

    c.execute(
        """INSERT INTO resumes
           (username,name,email,phone,summary,skills,education,experience,projects)
           VALUES(?,?,?,?,?,?,?,?,?)""",
        (data.username, data.name, data.email, data.phone, polished,
         json.dumps(data.skills), json.dumps(data.education),
         json.dumps(data.experience), json.dumps(data.projects)),
    )
    conn.commit()

    os.makedirs("generated_resumes", exist_ok=True)
    safe  = re.sub(r"[^a-zA-Z0-9_]", "_", data.name)
    fname = f"generated_resumes/{safe}_resume.pdf"

    doc    = SimpleDocTemplate(
        fname, pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.5*cm,  bottomMargin=1.5*cm,
    )
    styles = getSampleStyleSheet()
    name_s    = ParagraphStyle("N", parent=styles["Title"],    fontSize=20, spaceAfter=2,
                               textColor=colors.HexColor("#1a1a2e"), alignment=TA_CENTER)
    contact_s = ParagraphStyle("C", parent=styles["Normal"],   fontSize=9,  spaceAfter=8,
                               textColor=colors.HexColor("#444444"), alignment=TA_CENTER)
    head_s    = ParagraphStyle("H", parent=styles["Heading2"], fontSize=11, spaceBefore=10,
                               spaceAfter=3, textColor=colors.HexColor("#1a1a2e"))
    body_s    = ParagraphStyle("B", parent=styles["Normal"],   fontSize=10, spaceAfter=4,
                               leading=14, alignment=TA_LEFT)
    bullet_s  = ParagraphStyle("U", parent=styles["Normal"],   fontSize=10, spaceAfter=3,
                               leading=14, leftIndent=12, alignment=TA_LEFT)

    div   = HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"))
    story = []

    story.append(Paragraph(data.name.upper(), name_s))
    contacts = [p for p in [data.email, data.phone] if p]
    if contacts:
        story.append(Paragraph(" | ".join(contacts), contact_s))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1a1a2e")))
    story.append(Spacer(1, 6))

    def section(title, items, is_para=False):
        if not items:
            return
        story.append(Paragraph(title, head_s))
        story.append(div)
        story.append(Spacer(1, 3))
        if is_para:
            story.append(Paragraph(
                items if isinstance(items, str) else " * ".join(items), body_s
            ))
        else:
            for item in items:
                story.append(Paragraph(f"* {item}", bullet_s))
        story.append(Spacer(1, 6))

    section("PROFESSIONAL SUMMARY", polished,        is_para=True)
    section("SKILLS",               data.skills,     is_para=True)
    section("WORK EXPERIENCE",      data.experience)
    section("EDUCATION",            data.education)
    section("PROJECTS",             data.projects)

    doc.build(story)

    return {
        "success":          True,
        "polished_summary": polished,
        "download_url":     f"/api/download-resume/{safe}_resume.pdf",
        "sections": {
            "name":       data.name,
            "email":      data.email,
            "phone":      data.phone,
            "summary":    polished,
            "skills":     data.skills,
            "experience": data.experience,
            "education":  data.education,
            "projects":   data.projects,
        },
    }


@app.get("/api/download-resume/{filename}")
def download_resume(filename: str):
    path = f"generated_resumes/{filename}"
    if not os.path.exists(path):
        return {"error": "File not found"}
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

# =============================================================
# AI RECRUITER LIVE INTERVIEW
# =============================================================

class LiveInterviewStartRequest(BaseModel):
    username: str

class LiveInterviewEvaluateRequest(BaseModel):
    username: str
    question: str
    answer: str

class LiveInterviewFinishRequest(BaseModel):
    username: str
    communication_score: int
    confidence_score: int
    technical_score: int
    professionalism_score: int
    body_language_score: int
    questions_answers_json: str

@app.post("/api/live-interview/start")
def live_interview_start(req: LiveInterviewStartRequest):
    row = c.execute("SELECT analysis FROM resume_history WHERE username=? ORDER BY id DESC LIMIT 1", (req.username,)).fetchone()
    if not row:
        return {"success": False, "error": "No resume found. Please upload a resume in the dashboard first."}
    
    resume_text = row[0]
    prompt = f"""You are an expert HR Recruiter. The candidate's resume analysis is below:
{resume_text}

Generate 8 personalized interview questions to ask the candidate in a live voice interview.
Include a mix of:
- 1 "Tell me about yourself"
- 2 Resume-based / Project-based questions
- 2 Technical questions
- 2 Behavioral questions
- 1 Career goal question

Return a JSON list of strings ONLY. No markdown, no explanations."""

    raw = call_ai("Return ONLY a valid JSON list of strings.", prompt, max_tokens=1000)
    try:
        questions = extract_json(raw)
        if not isinstance(questions, list):
            questions = list(questions.values()) if isinstance(questions, dict) else [questions]
    except Exception:
        questions = [
            "Tell me about yourself.",
            "I noticed your projects on your resume. Can you explain one in detail?",
            "What technical challenges have you faced recently?",
            "How do you handle disagreements within a team?",
            "Where do you see your career going in the next few years?"
        ]
    return {"success": True, "questions": questions}

@app.post("/api/live-interview/evaluate")
def live_interview_evaluate(req: LiveInterviewEvaluateRequest):
    prompt = f"""You are an AI Recruiter evaluating a candidate's answer during a live interview.
Question asked: "{req.question}"
Candidate's voice transcript answer: "{req.answer}"

Evaluate the answer and return ONLY valid JSON with the following schema:
{{
  "communication_score": <0-100>,
  "confidence_score": <0-100>,
  "technical_score": <0-100>,
  "professionalism_score": <0-100>,
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<improvement1>", "<improvement2>"],
  "sample_best_answer": "<ideal concise answer to the question>"
}}
No markdown formatting."""
    raw = call_ai("Return ONLY valid JSON.", prompt, max_tokens=600)
    try:
        eval_result = extract_json(raw)
    except Exception:
        eval_result = {
            "communication_score": 50,
            "confidence_score": 50,
            "technical_score": 50,
            "professionalism_score": 50,
            "strengths": ["Answered the question."],
            "improvements": ["Provide more detail and structure."],
            "sample_best_answer": "A structured answer using the STAR method."
        }
    return {"success": True, "evaluation": eval_result}

@app.post("/api/live-interview/finish")
def live_interview_finish(req: LiveInterviewFinishRequest):
    prompt = f"""You are a Hiring Manager. Based on the following interview scores out of 100:
Communication: {req.communication_score}
Confidence: {req.confidence_score}
Technical: {req.technical_score}
Professionalism: {req.professionalism_score}
Body Language: {req.body_language_score}

Return ONLY valid JSON with:
{{
  "hiring_decision": "<Strong Hire | Hire | Borderline | Needs Improvement>",
  "hiring_probability": <0-100>,
  "strengths": "<short string summarizing overall strengths>",
  "improvements": "<short string summarizing areas to improve>",
  "recommended_skills": "<comma separated skills>"
}}"""
    raw = call_ai("Return ONLY valid JSON.", prompt, max_tokens=500)
    try:
        decision = extract_json(raw)
    except Exception:
        avg = (req.communication_score + req.technical_score + req.confidence_score) / 3
        decision = {
            "hiring_decision": "Hire" if avg > 70 else "Needs Improvement",
            "hiring_probability": int(avg),
            "strengths": "Solid overall effort.",
            "improvements": "Keep practicing interviews.",
            "recommended_skills": "System Design, Communication"
        }
    
    c.execute("""
        INSERT INTO live_interview_sessions (
            username, communication_score, confidence_score, technical_score, 
            professionalism_score, body_language_score, hiring_probability, 
            hiring_decision, strengths, improvements, recommended_skills, questions_answers_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.username, req.communication_score, req.confidence_score, req.technical_score,
        req.professionalism_score, req.body_language_score, decision.get("hiring_probability", 50),
        decision.get("hiring_decision", "Borderline"), decision.get("strengths", ""), 
        decision.get("improvements", ""), decision.get("recommended_skills", ""), 
        req.questions_answers_json
    ))
    conn.commit()
    
    decision["success"] = True
    return decision

@app.get("/api/live-interview/history/{username}")
def live_interview_history(username: str):
    rows = c.execute("""
        SELECT id, communication_score, confidence_score, technical_score, professionalism_score,
               body_language_score, hiring_probability, hiring_decision, created_at
        FROM live_interview_sessions WHERE username=? ORDER BY id DESC LIMIT 20
    """, (username,)).fetchall()
    
    keys = ["id", "communication_score", "confidence_score", "technical_score", "professionalism_score",
            "body_language_score", "hiring_probability", "hiring_decision", "created_at"]
    sessions = [dict(zip(keys, row)) for row in rows]
    return {"success": True, "sessions": sessions}

# -- Root ---------------------------------------------------
@app.get("/")
def root():
    job_count  = c.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    real_count = c.execute(
        "SELECT COUNT(*) FROM jobs WHERE job_url LIKE '%/jobs/view/%'"
    ).fetchone()[0]
    return {
        "status":     "AI Resume Analyzer v3 - running",
        "jobs_total": job_count,
        "jobs_real":  real_count,
    }