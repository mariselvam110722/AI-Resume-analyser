"""
linkedin_jobs.py — Real LinkedIn Job Fetcher
=============================================
Fetches ONLY real, currently active LinkedIn job postings.

Rules:
  - ONLY returns URLs matching: https://www.linkedin.com/jobs/view/<numeric_id>/
  - NEVER returns /jobs/search/ URLs
  - NEVER returns hardcoded / sample jobs
  - Strips all tracking params from URLs
  - Fetches real job description from the job detail page
  - Stores in SQLite `jobs` table

Public endpoints used (no login required):
  List  : https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search
  Detail: https://www.linkedin.com/jobs/view/<job_id>/
"""

import re
import time
import sqlite3
import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

log = logging.getLogger("linkedin_jobs")
logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(message)s")

# ── Constants ──────────────────────────────────────────────
SEARCH_API = (
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
)
JOB_VIEW_BASE = "https://www.linkedin.com/jobs/view/"
JOB_VIEW_RE   = re.compile(r"linkedin\.com/jobs/view/(\d+)")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection":      "keep-alive",
    "Referer":         "https://www.linkedin.com/jobs/search/",
    "Cache-Control":   "no-cache",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

KNOWN_SKILLS = [
    "python","java","javascript","typescript","react","angular","vue","next.js",
    "sql","mysql","postgresql","mongodb","redis","sqlite","oracle",
    "aws","azure","gcp","terraform","ansible",
    "docker","kubernetes","linux","ci/cd","jenkins","github actions",
    "git","agile","scrum","jira",
    "machine learning","deep learning","tensorflow","pytorch","keras",
    "fastapi","django","flask","spring boot","node.js","express","laravel",
    "html","css","sass","tailwind","figma",
    "rest api","graphql","grpc","microservices",
    "spark","hadoop","kafka","airflow","databricks",
    "tableau","power bi","looker","pandas","numpy","scikit-learn",
    "data structures","algorithms","system design",
    "kotlin","swift","flutter","react native","android","ios",
    "devops","sre","elasticsearch","rabbitmq","celery",
    "scala","golang","rust","c++","c#",".net","ruby","php",
]


# ── URL helpers ────────────────────────────────────────────

def extract_job_id(href: str) -> Optional[str]:
    """
    Extract numeric job ID from any LinkedIn URL.
    Returns None if the URL is not a real job view URL.
    """
    if not href:
        return None
    m = JOB_VIEW_RE.search(href)
    return m.group(1) if m else None

def make_job_url(job_id: str) -> str:
    """Build canonical clean job URL with no tracking params."""
    return f"{JOB_VIEW_BASE}{job_id}/"

def is_real_job_url(url: str) -> bool:
    """Return True only if URL is a real LinkedIn job view URL."""
    return bool(JOB_VIEW_RE.search(url))


# ── Skill extractor ────────────────────────────────────────

def extract_skills(text: str) -> str:
    text_lower = text.lower()
    found = [s for s in KNOWN_SKILLS if s in text_lower]
    return ",".join(found) if found else ""


# ── Fetch job description from detail page ─────────────────

def fetch_job_description(job_id: str) -> str:
    """
    Fetch the job description from the LinkedIn job detail page.
    Returns plain text, truncated to 800 chars.
    """
    url = make_job_url(job_id)
    try:
        resp = SESSION.get(url, timeout=10)
        if resp.status_code != 200:
            return ""
        soup = BeautifulSoup(resp.text, "html.parser")

        # Primary selector — public job page
        for sel in [
            "div.show-more-less-html__markup",
            "div.description__text",
            "section.show-more-less-html",
            "div[class*='description']",
        ]:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(separator=" ", strip=True)
                if len(text) > 50:
                    return text[:800]

    except Exception as e:
        log.debug(f"Description fetch failed for {job_id}: {e}")
    return ""


# ── Parse individual job card from API HTML ────────────────

def parse_card(card, fallback_location: str) -> Optional[dict]:
    """
    Parse one <li> job card from LinkedIn's seeMoreJobPostings API response.
    Returns a dict with guaranteed real job_url, or None if invalid.
    """
    try:
        # ── Job ID / URL ───────────────────────────────────
        # Try every anchor in the card
        job_id = None
        for a in card.find_all("a", href=True):
            job_id = extract_job_id(a["href"])
            if job_id:
                break

        # Also try data-entity-urn attribute (sometimes carries the ID)
        if not job_id:
            for el in card.find_all(True):
                urn = el.get("data-entity-urn", "")
                m   = re.search(r"jobPosting:(\d+)", urn)
                if m:
                    job_id = m.group(1)
                    break

        if not job_id:
            return None   # Cannot build a real URL without an ID

        job_url = make_job_url(job_id)

        # ── Job Title ──────────────────────────────────────
        job_title = ""
        for sel in [
            "h3.base-search-card__title",
            "h3[class*='title']",
            "span.sr-only",
            "h3",
        ]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t and len(t) > 2:
                    job_title = t
                    break

        if not job_title:
            return None

        # ── Company Name ───────────────────────────────────
        company = ""
        for sel in [
            "h4.base-search-card__subtitle",
            "a.hidden-nested-link",
            "h4[class*='subtitle']",
            "h4",
        ]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t:
                    company = t
                    break

        # ── Location ───────────────────────────────────────
        location = fallback_location
        for sel in [
            "span.job-search-card__location",
            "span[class*='location']",
        ]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t:
                    location = t
                    break

        return {
            "job_id":   job_id,
            "title":    job_title,
            "company":  company,
            "location": location,
            "url":      job_url,
        }

    except Exception as e:
        log.debug(f"Card parse error: {e}")
        return None


# ── Main fetch function ────────────────────────────────────

def fetch_real_jobs(
    query:    str,
    location: str,
    count:    int = 25,
    fetch_descriptions: bool = True,
) -> list[dict]:
    """
    Fetch real LinkedIn jobs using the public seeMoreJobPostings API.

    Returns list of dicts:
        job_id, title, company, location, url (real /jobs/view/<id>/),
        description, skills_required

    ONLY returns jobs with real /jobs/view/<numeric_id>/ URLs.
    """
    results   = []
    seen_ids  = set()
    start     = 0
    per_page  = 25

    while len(results) < count:
        params = {
            "keywords": query,
            "location": location,
            "start":    start,
            "sortBy":   "DD",        # Most recent first
            "f_TPR":    "r2592000",  # Posted in last 30 days
        }

        log.info(f"  Fetching start={start}: '{query}' in '{location}'")
        try:
            resp = SESSION.get(SEARCH_API, params=params, timeout=15)
        except requests.RequestException as e:
            log.warning(f"  Request error: {e}")
            break

        if resp.status_code == 429:
            log.warning("  Rate limited (429). Waiting 5s...")
            time.sleep(5)
            continue
        if resp.status_code != 200:
            log.warning(f"  Status {resp.status_code}, stopping.")
            break

        soup  = BeautifulSoup(resp.text, "html.parser")
        cards = soup.find_all("li")

        if not cards:
            log.info("  No cards found, stopping.")
            break

        found_this_page = 0
        for card in cards:
            if len(results) >= count:
                break

            job = parse_card(card, location)
            if not job:
                continue
            if job["job_id"] in seen_ids:
                continue

            seen_ids.add(job["job_id"])

            # Fetch real description from job detail page
            description = ""
            if fetch_descriptions:
                description = fetch_job_description(job["job_id"])
                time.sleep(0.4)   # polite delay per description fetch

            if not description:
                description = (
                    f"{job['title']} position at {job['company']} "
                    f"located in {job['location']}."
                )

            skills = extract_skills(f"{job['title']} {description}")

            results.append({
                "job_id":          job["job_id"],
                "title":           job["title"],
                "company":         job["company"],
                "location":        job["location"],
                "url":             job["url"],      # always /jobs/view/<id>/
                "description":     description,
                "skills_required": skills,
            })
            found_this_page += 1
            log.info(f"    ✓ [{len(results)}/{count}] {job['title']} @ {job['company']}")

        if found_this_page == 0:
            log.info("  No new jobs on this page, stopping.")
            break

        start    += per_page
        time.sleep(1.5)   # polite delay between pages

    log.info(f"Fetched {len(results)} real LinkedIn jobs.")
    return results


# ── DB save ────────────────────────────────────────────────

def save_jobs_to_db(jobs: list[dict], db_conn) -> int:
    """
    Save job list to SQLite `jobs` table.
    Skips jobs that already exist (UNIQUE on job_url).
    Returns number of newly saved jobs.
    """
    saved = 0
    for j in jobs:
        # Final safety check — never save non-view URLs
        if not is_real_job_url(j["url"]):
            log.warning(f"  SKIP non-view URL: {j['url']}")
            continue
        try:
            db_conn.execute(
                """INSERT OR IGNORE INTO jobs
                   (company_name, job_title, location, job_url,
                    job_description, skills_required)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    j["company"],
                    j["title"],
                    j["location"],
                    j["url"],
                    j["description"],
                    j["skills_required"],
                ),
            )
            db_conn.commit()
            saved += 1
        except Exception as e:
            log.debug(f"  DB insert error: {e}")
    return saved


# ── High-level convenience ─────────────────────────────────

def fetch_and_save(
    query:    str,
    location: str,
    count:    int,
    db_conn,
    fetch_descriptions: bool = True,
) -> int:
    """
    Fetch real LinkedIn jobs and immediately save to DB.
    Returns number of new jobs saved.
    """
    jobs  = fetch_real_jobs(query, location, count, fetch_descriptions)
    saved = save_jobs_to_db(jobs, db_conn)
    log.info(f"Saved {saved} new jobs ('{query}' / '{location}')")
    return saved


# ── CLI (standalone testing) ───────────────────────────────

if __name__ == "__main__":
    import argparse, json

    p = argparse.ArgumentParser()
    p.add_argument("--query",    default="python developer")
    p.add_argument("--location", default="India")
    p.add_argument("--count",    type=int, default=10)
    p.add_argument("--no-desc",  action="store_true", help="Skip description fetching (faster)")
    a = p.parse_args()

    jobs = fetch_real_jobs(
        query    = a.query,
        location = a.location,
        count    = a.count,
        fetch_descriptions = not a.no_desc,
    )

    print(f"\n{'─'*60}")
    print(f"Results: {len(jobs)} jobs")
    print(f"{'─'*60}")
    for j in jobs:
        print(f"\n  Title    : {j['title']}")
        print(f"  Company  : {j['company']}")
        print(f"  Location : {j['location']}")
        print(f"  URL      : {j['url']}")
        print(f"  Skills   : {j['skills_required'][:80]}")
        print(f"  Desc     : {j['description'][:120]}...")
        assert is_real_job_url(j["url"]), f"BAD URL: {j['url']}"
    print(f"\n✅ All {len(jobs)} jobs have real /jobs/view/<id>/ URLs")
