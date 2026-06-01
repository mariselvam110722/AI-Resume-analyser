# =============================================================
# main.py - AI Resume Analyzer v2  (FastAPI Backend)
# =============================================================
# Endpoints:
#   Auth        POST /register  POST /login  GET /profile/{u}
#   Analysis    POST /upload
#   Jobs        GET  /api/recommended-jobs
#               POST /api/fetch-live-jobs
#               GET  /api/jobs-count
#               DELETE /api/jobs/clear
#   Interview   POST /api/generate-interview-questions
#   Chat        POST /api/career-chat
#               GET  /api/career-chat/history/{username}
#   Resume      POST /api/generate-resume
#               GET  /api/download-resume/{filename}
# =============================================================

import hashlib
import json
import os
import re
import shutil
import sqlite3
import threading

import openai
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PyPDF2 import PdfReader

from linkedin_jobs import fetch_and_save, is_real_job_url

# -- App & env ----------------------------------------------
load_dotenv()
app = FastAPI(title="AI Resume Analyzer v2")

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
    password TEXT
);

CREATE TABLE IF NOT EXISTS resume_history(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    score    INTEGER,
    analysis TEXT
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

CREATE TABLE IF NOT EXISTS resume_analysis(
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT,
    score      INTEGER,
    analysis   TEXT,
    file_name  TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
""")
conn.commit()

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
    """
    On first startup (empty jobs table), fetch real LinkedIn jobs.
    Uses linkedin_jobs module which guarantees /jobs/view/<id>/ URLs.
    No fake / sample / hardcoded jobs - if LinkedIn is unreachable,
    the table stays empty and the frontend shows the Fetch Jobs button.
    """
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
                count    = 8,          # 8 per query  8 queries = ~64 real jobs
                db_conn  = conn,
                fetch_descriptions = True,
            )
            total += saved
            print(f"[jobs]    '{query}': {saved} saved")
        except Exception as e:
            print(f"[jobs]    '{query}': {e}")

    final = c.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    print(f"[jobs] Seeding done. {final} real LinkedIn jobs in DB.")

# Run in background so the server starts immediately
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

def analyze_resume(text: str) -> str:
    prompt = f"""
You are a professional ATS resume analyzer. Return ONLY valid JSON with at least 5 items per list.

{{
  "summary":      "3 professional sentences",
  "skills":       ["skill1","skill2","skill3","skill4","skill5"],
  "strengths":    ["s1","s2","s3","s4","s5"],
  "weaknesses":   ["w1","w2","w3","w4","w5"],
  "improvements": ["i1","i2","i3","i4","i5"],
  "score":        <number 0-100>
}}

Resume:
{text}
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
        c.execute("INSERT INTO users VALUES(?,?,?)",
                  (user.username, user.email, hash_pw(user.password)))
        conn.commit()
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
    return {"success": True, "message": "Login successful"}


@app.get("/profile/{username}")
def profile(username: str):
    row = c.execute(
        "SELECT username, email FROM users WHERE username=?", (username,)
    ).fetchone()
    if not row:
        return {"success": False}
    return {"username": row[0], "email": row[1]}


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
    cleaned = raw.strip().replace("```json","").replace("```","").strip()

    try:
        data = json.loads(cleaned)
    except Exception:
        data = {"summary":"","skills":[],"strengths":[],"weaknesses":[],"improvements":[],"score":60}

    score   = calculate_score(text, data.get("score", 60))
    missing = detect_missing(text)
    data["missing_skills"] = missing

    c.execute("INSERT INTO resume_history(username,score,analysis) VALUES(?,?,?)",
              (username, score, json.dumps(data)))
    conn.commit()

    return {
        "score":          score,
        "summary":        data.get("summary", ""),
        "skills":         data.get("skills", []),
        "strengths":      data.get("strengths", []),
        "weaknesses":     data.get("weaknesses", []),
        "improvements":   data.get("improvements", []),
        "missing_skills": missing,
        "file_name":      file.filename,
    }


# =============================================================
# FEATURE 1 - JOB RECOMMENDATION  (real LinkedIn jobs)
# =============================================================

@app.get("/api/recommended-jobs")
def recommended_jobs(username: str = "guest", location: str = ""):
    """
    1. Load user skills from their latest resume analysis
    2. Fetch ALL jobs from DB - only real /jobs/view/<id>/ URLs are stored
    3. Score each job: count skill overlaps / required skills  100
    4. Return sorted by match score descending
    """
    # Load user skills
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

    # Fetch jobs - filter by location if provided
    loc = location.strip().lower()
    if loc:
        all_rows = c.execute(
            "SELECT id, company_name, job_title, location, job_url, job_description, skills_required FROM jobs"
        ).fetchall()
        # Filter rows matching location (case-insensitive)
        rows = [r for r in all_rows if loc in (r[3] or "").lower() or loc in (r[5] or "").lower()]
        # Fallback to all if filter is too strict
        if len(rows) < 5:
            rows = all_rows
    else:
        rows = c.execute(
            "SELECT id, company_name, job_title, location, job_url, job_description, skills_required FROM jobs"
        ).fetchall()

    matched = []
    for jid, company, title, job_loc, job_url, desc, skills_req in rows:

        # Safety: skip any non-real-view URLs that slipped in
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
            "url":             job_url,           # real /jobs/view/<id>/ URL
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
    """
    Trigger a background fetch of real LinkedIn jobs.
    Only /jobs/view/<id>/ URLs are saved - enforced by linkedin_jobs module.
    """
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
    """Clear all jobs so fresh ones can be fetched."""
    c.execute("DELETE FROM jobs")
    conn.commit()
    return {"success": True, "message": "All jobs cleared. Restart server or call /api/fetch-live-jobs to reload."}


# =============================================================
# FEATURE 2 - INTERVIEW PREPARATION
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
    cleaned = raw.strip().replace("```json","").replace("```","").strip()

    try:
        return json.loads(cleaned)
    except Exception:
        return {
            "technical": [{"question": "Describe your technical background.", "hint": "Focus on key skills."}],
            "hr":        [{"question": "Tell me about yourself.",             "hint": "Keep it under 2 minutes."}],
            "project":   [{"question": "Walk me through your best project.",  "hint": "Use the STAR method."}],
        }


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
    """Clear all chat messages for a user (called on logout or manual clear)."""
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

    # AI-polish the summary
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


# -- Root ---------------------------------------------------
@app.get("/")
def root():
    job_count = c.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    real_count = c.execute(
        "SELECT COUNT(*) FROM jobs WHERE job_url LIKE '%/jobs/view/%'"
    ).fetchone()[0]
    return {
        "status":     "AI Resume Analyzer v2 - running",
        "jobs_total": job_count,
        "jobs_real":  real_count,
    }