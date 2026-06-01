"""
scraper.py — LinkedIn Real Job Fetcher
=======================================
Uses LinkedIn's public jobs search API endpoint to fetch REAL live jobs.
No Selenium required, no CAPTCHA, no login needed.

LinkedIn public API: https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search

Usage:
    python scraper.py --query "python developer" --location "India" --count 50
    python scraper.py --query "react developer" --location "Chennai" --count 25
"""

import argparse
import sqlite3
import time
import re
import requests
from datetime import datetime
from bs4 import BeautifulSoup

# ── DB ─────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect("users.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs(
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name    TEXT,
            job_title       TEXT,
            location        TEXT,
            job_url         TEXT UNIQUE,
            job_description TEXT,
            skills_required TEXT,
            scraped_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn

def save_job(conn, company_name, job_title, location, job_url, job_description, skills):
    try:
        conn.execute(
            """INSERT INTO jobs
               (company_name, job_title, location, job_url, job_description, skills_required, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (company_name, job_title, location, job_url,
             job_description, skills, datetime.now().isoformat())
        )
        conn.commit()
        print(f"  [SAVED] {job_title} @ {company_name} → {job_url[:60]}...")
        return True
    except sqlite3.IntegrityError:
        print(f"  [SKIP]  Duplicate: {job_title} @ {company_name}")
        return False

# ── Skill extractor ────────────────────────────────────────
KNOWN_SKILLS = [
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "sql", "mysql", "postgresql", "mongodb", "redis", "aws", "azure", "gcp",
    "docker", "kubernetes", "git", "machine learning", "deep learning",
    "tensorflow", "pytorch", "fastapi", "django", "flask", "spring boot",
    "node.js", "data structures", "ci/cd", "linux", "html", "css",
    "rest api", "graphql", "spark", "hadoop", "tableau", "power bi",
    "scikit-learn", "pandas", "numpy", "selenium", "pytest", "devops",
    "kotlin", "swift", "golang", "rust", "c++", "scala", "elasticsearch",
    "next.js", "express", "redis", "firebase", "figma", "jira", "agile"
]

def extract_skills(text: str) -> str:
    tl    = text.lower()
    found = [s for s in KNOWN_SKILLS if s in tl]
    return ",".join(found) if found else "general"

# ── LinkedIn public API fetcher ────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.linkedin.com/jobs/search/",
}


def fetch_job_description(job_url: str) -> str:
    """Fetch the description from the individual job page."""
    try:
        resp = requests.get(job_url, headers=HEADERS, timeout=8)
        if resp.status_code != 200:
            return ""
        soup = BeautifulSoup(resp.text, "html.parser")
        desc = soup.find("div", class_=re.compile(r"description|show-more-less-html"))
        if desc:
            text = desc.get_text(separator=" ", strip=True)
            return text[:500]
    except Exception:
        pass
    return ""


def fetch_linkedin_jobs(query: str, location: str, count: int = 25) -> list:
    """
    Use LinkedIn's public job search API to get real job listings.
    Returns list of job dicts with real URLs.
    """
    all_jobs = []
    start    = 0
    per_page = 25

    while len(all_jobs) < count:
        # LinkedIn public jobs API — no authentication needed
        api_url = (
            "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
            f"?keywords={requests.utils.quote(query)}"
            f"&location={requests.utils.quote(location)}"
            f"&start={start}"
            "&f_TPR=r604800"   # posted in last 7 days
            "&sortBy=DD"       # sort by date (most recent)
        )

        print(f"  Fetching page start={start}: {api_url[:80]}...")
        try:
            resp = requests.get(api_url, headers=HEADERS, timeout=15)
        except requests.RequestException as e:
            print(f"  [ERROR] Request failed: {e}")
            break

        if resp.status_code != 200:
            print(f"  [ERROR] Status {resp.status_code}")
            break

        soup  = BeautifulSoup(resp.text, "html.parser")
        cards = soup.find_all("li")

        if not cards:
            print("  No more job cards found, stopping.")
            break

        found_any = False
        for card in cards:
            try:
                # Job title
                title_el  = card.find("h3", class_=re.compile(r"base-search-card__title|title"))
                if not title_el:
                    title_el = card.find("span", class_=re.compile(r"sr-only|visually-hidden"))
                job_title = title_el.get_text(strip=True) if title_el else ""

                # Company
                comp_el   = card.find("h4", class_=re.compile(r"base-search-card__subtitle|company"))
                if not comp_el:
                    comp_el = card.find("a", class_=re.compile(r"hidden-nested-link"))
                company   = comp_el.get_text(strip=True) if comp_el else ""

                # Location
                loc_el    = card.find("span", class_=re.compile(r"job-search-card__location|location"))
                loc       = loc_el.get_text(strip=True) if loc_el else location

                # Real job URL — the most important part
                link_el = card.find("a", class_=re.compile(r"base-card__full-link|result-card__full-card-link"))
                if not link_el:
                    link_el = card.find("a", href=re.compile(r"linkedin\.com/jobs/view/"))
                if not link_el:
                    link_el = card.find("a", href=True)

                job_url = ""
                if link_el:
                    href = link_el.get("href", "")
                    # Extract clean URL — remove tracking params
                    job_url = href.split("?")[0] if href else ""
                    # Ensure it's a real LinkedIn job view URL
                    if "linkedin.com/jobs/view/" not in job_url:
                        job_url = ""

                if not job_title or not job_url:
                    continue

                # Job ID from URL for deduplication
                job_id_match = re.search(r"/jobs/view/(\d+)", job_url)
                if job_id_match:
                    # Canonical clean URL
                    job_url = f"https://www.linkedin.com/jobs/view/{job_id_match.group(1)}/"

                # Posted time
                time_el   = card.find("time")
                posted    = time_el.get_text(strip=True) if time_el else ""

                all_jobs.append({
                    "title":    job_title,
                    "company":  company,
                    "location": loc,
                    "url":      job_url,
                    "posted":   posted,
                })
                found_any = True
                print(f"    → {job_title} @ {company} [{job_url[-40:]}]")

            except Exception as e:
                continue

        if not found_any:
            break

        start    += per_page
        time.sleep(1.5)   # polite rate limiting

    return all_jobs[:count]


def scrape_and_save(query: str, location: str, count: int = 25):
    """
    Fetch real LinkedIn jobs and save to DB with descriptions.
    """
    conn  = get_db()
    total = 0

    print(f"\n🔍 Fetching LinkedIn jobs: '{query}' in '{location}'...")
    jobs = fetch_linkedin_jobs(query, location, count)
    print(f"\n📦 Found {len(jobs)} job listings. Fetching descriptions...\n")

    for job in jobs:
        # Fetch job description from the individual job page
        desc   = fetch_job_description(job["url"])
        if not desc:
            desc = f"{job['title']} position at {job['company']} in {job['location']}."

        skills = extract_skills(f"{job['title']} {desc}")
        if save_job(conn, job["company"], job["title"], job["location"],
                    job["url"], desc, skills):
            total += 1
        time.sleep(0.5)   # brief pause between description fetches

    conn.close()
    print(f"\n✅ Done. {total} real LinkedIn jobs saved to database.")
    return total


# ── CLI ────────────────────────────────────────────────────
if __name__ == "__main__":
    p = argparse.ArgumentParser(description="LinkedIn Real Job Fetcher (no Selenium needed)")
    p.add_argument("--query",    default="software engineer", help="Search keyword")
    p.add_argument("--location", default="India",            help="Location filter")
    p.add_argument("--count",    type=int, default=25,       help="Number of jobs to fetch")
    args = p.parse_args()

    scrape_and_save(
        query    = args.query,
        location = args.location,
        count    = args.count,
    )
