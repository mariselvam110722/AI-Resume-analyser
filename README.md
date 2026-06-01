# AI Resume Analyser — Complete Project

## Folder Structure

```
ai_resume_analyse/
├── backend/
│   ├── main.py              ← FastAPI backend (all endpoints)
│   ├── scraper.py           ← LinkedIn Selenium scraper
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── package.json         ← includes html2pdf.js
    ├── postcss.config.mjs
    └── src/
        ├── main.tsx
        ├── api.js
        ├── app/
        │   ├── App.tsx
        │   ├── context/
        │   │   └── auth-context.tsx
        │   └── components/
        │       ├── landing.tsx          ← MODIFIED: new design
        │       ├── login.tsx
        │       ├── register.tsx
        │       ├── dashboard.tsx
        │       ├── sidebar.tsx
        │       ├── profile.tsx
        │       ├── upload-area.tsx
        │       ├── recommended-jobs.tsx
        │       ├── interview-prep.tsx
        │       ├── career-chat.tsx
        │       ├── resume-builder.tsx   ← MODIFIED: summary + PDF fix
        │       ├── figma/
        │       │   └── ImageWithFallback.tsx
        │       └── ui/                  ← shadcn/ui components
        └── styles/
            ├── index.css
            ├── fonts.css
            ├── tailwind.css
            └── theme.css
```

---

## SQLite Database Schema

```sql
CREATE TABLE users(
    username TEXT, email TEXT, password TEXT
);

CREATE TABLE resume_history(
    username TEXT, score INTEGER, analysis TEXT
);

-- LinkedIn scraped jobs
CREATE TABLE jobs(
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name    TEXT,
    job_title       TEXT,
    location        TEXT,
    job_url         TEXT UNIQUE,
    job_description TEXT,
    skills_required TEXT,
    scraped_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Built resumes stored
CREATE TABLE resumes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT, name TEXT, email TEXT, phone TEXT,
    summary TEXT, skills TEXT, education TEXT,
    experience TEXT, projects TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interview_questions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT, questions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_history(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT, role TEXT, message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resume_analysis(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT, score INTEGER, analysis TEXT, file_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Steps to Run

### Step 1 — Backend

```bash
cd ai_resume_analyse/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variable
cp .env.example .env
# Edit .env → add your GROQ_API_KEY from https://console.groq.com

# Start backend
uvicorn main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**

---

### Step 2 — Frontend

```bash
cd ai_resume_analyse/frontend

# Install dependencies (includes html2pdf.js)
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

### Step 3 — LinkedIn Job Scraping (optional)

The backend seeds 15 sample LinkedIn-style jobs on first run.
To scrape real LinkedIn jobs:

```bash
cd ai_resume_analyse/backend

# Basic scrape
python scraper.py --query "python developer" --location "India" --pages 2

# More examples
python scraper.py --query "react developer"  --location "Bangalore" --pages 2
python scraper.py --query "data scientist"   --location "Hyderabad" --pages 1
python scraper.py --query "ml engineer"      --location "Remote"    --pages 1

# Debug (opens Chrome visibly)
python scraper.py --query "software engineer" --location "India" --no-headless
```

---

## Navigation Flow

```
Landing (/)
  ├── Login (/login) → Dashboard (/dashboard)
  └── Register (/register) → Login → Dashboard

Dashboard → 
  /jobs           Recommended Jobs (LinkedIn-matched)
  /interview-prep Interview Preparation
  /career-chat    AI Career Mentor
  /resume-builder Resume Builder
  /profile        User Profile
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login |
| GET | `/profile/{username}` | Get user profile |
| POST | `/upload` | Upload PDF resume for ATS analysis |
| GET | `/api/recommended-jobs?username=` | LinkedIn-matched jobs |
| POST | `/api/generate-interview-questions` | Generate interview Q&A |
| POST | `/api/career-chat` | Career mentor chat message |
| GET | `/api/career-chat/history/{username}` | Chat history |
| POST | `/api/generate-resume` | Build ATS resume + PDF |
| GET | `/api/download-resume/{filename}` | Download generated PDF |

---

## What Was Changed

| Task | File | Change |
|------|------|--------|
| Task 1 | `frontend/src/app/components/landing.tsx` | Navbar with Login/Register, Hero, CTA, Features section |
| Task 2 | `backend/scraper.py` | Rewrote to scrape **LinkedIn** (not Indeed/Google) |
| Task 2 | `backend/main.py` | New `jobs` table schema + updated `/api/recommended-jobs` |
| Task 3 | `frontend/src/app/components/resume-builder.tsx` | Summary field fixed; shows in preview |
| Task 4 | `frontend/src/app/components/resume-builder.tsx` | PDF uses html2pdf.js, correct order & spacing |
| Task 4 | `frontend/package.json` | Added `html2pdf.js` dependency |
