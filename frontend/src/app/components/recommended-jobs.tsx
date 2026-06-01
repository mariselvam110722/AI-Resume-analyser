/**
 * recommended-jobs.tsx - Feature 1: Real LinkedIn Job Matching
 *
 * - Fetches ONLY real LinkedIn jobs (/jobs/view/<id>/ URLs)
 * - "Fetch Live Jobs" triggers backend to pull fresh real postings
 * - Apply button opens the actual LinkedIn job page
 * - Green badge = skill matched | Grey badge = not in your resume
 */

import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { useAuth } from "../context/auth-context";
import {
  Briefcase, MapPin, ExternalLink, RefreshCw,
  Loader2, Search, Building2, Wifi, WifiOff,
  AlertCircle, CheckCircle2
} from "lucide-react";

interface Job {
  id:              number;
  company:         string;
  title:           string;
  location:        string;
  url:             string;
  description:     string;
  skills_required: string[];
  match_score:     number;
}

// -- Match score badge -------------------------------------
const MatchBadge: React.FC<{ score: number }> = ({ score }) => {
  const { text, bar, ring } =
    score >= 70 ? { text: "text-green-400",  bar: "bg-green-500",  ring: "ring-green-700/30"  }
    : score >= 40 ? { text: "text-yellow-400", bar: "bg-yellow-500", ring: "ring-yellow-700/30" }
    :               { text: "text-orange-400", bar: "bg-orange-500", ring: "ring-orange-700/30" };

  return (
    <div className={`flex flex-col items-end gap-1 px-3 py-2 rounded-xl bg-slate-800 ring-1 ${ring} min-w-[76px]`}>
      <span className={`text-2xl font-bold leading-none ${text}`}>{score}%</span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Match</span>
      <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden mt-0.5">
        <div className={`h-full ${bar} rounded-full`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

export const RecommendedJobs: React.FC = () => {
  const { user }                       = useAuth();
  const [jobs, setJobs]                = useState<Job[]>([]);
  const [loading, setLoading]          = useState(true);
  const [fetching, setFetching]        = useState(false);
  const [userSkills, setUserSkills]    = useState<string[]>([]);
  const [totalInDb, setTotalInDb]      = useState(0);
  const [query, setQuery]              = useState("software engineer");
  const [location, setLocation]        = useState("India");
  const [count, setCount]              = useState(25);
  const [status, setStatus]            = useState<{ type: "info"|"ok"|"err"; msg: string } | null>(null);

  // -- Load jobs from DB (with optional location filter) ----
  const loadJobs = useCallback(async (filterLocation = "") => {
    setLoading(true);
    try {
      const locParam = filterLocation ? `&location=${encodeURIComponent(filterLocation)}` : "";
      const res  = await fetch(`http://localhost:8000/api/recommended-jobs?username=${user?.username || "guest"}${locParam}`);
      const data = await res.json();
      setJobs(data.jobs        || []);
      setUserSkills(data.user_skills || []);
      setTotalInDb(data.total  || 0);
    } catch {
      setStatus({ type: "err", msg: "Could not connect to backend. Make sure it is running." });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // -- Trigger live fetch --------------------------------
  const fetchLive = async () => {
    if (!query.trim()) {
      setStatus({ type: "err", msg: "Please enter a job role or keyword." });
      return;
    }
    setFetching(true);
    const fetchQuery    = query.trim();
    const fetchLocation = location.trim() || "India";
    setStatus({ type: "info", msg: `Fetching ${count} real jobs for "${fetchQuery}" in "${fetchLocation}"...` });

    try {
      const res  = await fetch(
        `http://localhost:8000/api/fetch-live-jobs?query=${encodeURIComponent(fetchQuery)}&location=${encodeURIComponent(fetchLocation)}&count=${count}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Server error");

      setStatus({ type: "info", msg: `Jobs are being fetched in the background. Refreshing every 8s...` });

      // Poll up to 5 times (40s), reload jobs on EVERY poll regardless of count change
      // This ensures location-filtered results always show up
      let attempts = 0;
      const maxAttempts = 5;
      const poll = setInterval(async () => {
        attempts++;
        try {
          await loadJobs(fetchLocation);  // reload filtered by fetched location
          const r = await fetch(`http://localhost:8000/api/jobs-count`);
          const d = await r.json();
          if (attempts >= maxAttempts) {
            clearInterval(poll);
            setStatus({ type: "ok", msg: `Done! ${d.total} jobs in database. Results updated for "${fetchQuery}" in "${fetchLocation}".` });
            setTimeout(() => setStatus(null), 5000);
          } else {
            setStatus({ type: "info", msg: `Fetching... (${attempts}/${maxAttempts}) - ${d.total} jobs loaded so far` });
          }
        } catch {
          clearInterval(poll);
          setStatus({ type: "err", msg: "Error refreshing jobs." });
        }
      }, 8000);

    } catch (e: any) {
      setStatus({ type: "err", msg: `Fetch failed: ${e.message}. Check backend connection.` });
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 p-8 max-w-5xl mx-auto">

        {/* -- Header -- */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-4xl font-bold text-slate-100">Job Matches</h1>
            <p className="text-slate-400 text-sm mt-1">
              Real LinkedIn jobs matched to your resume skills.
              {totalInDb > 0 &&
                <span className="ml-2 text-slate-500">
                  {totalInDb} jobs in database
                </span>
              }
            </p>
          </div>
          <button
            onClick={() => loadJobs()}
            title="Refresh"
            className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* -- Your skills -- */}
        {userSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-5 mt-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Your skills:</span>
            {userSkills.slice(0, 12).map((s, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-900/30 border border-blue-700/40 text-blue-300 text-xs rounded-full">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* -- Fetch Live Jobs panel -- */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Wifi className="w-4 h-4 text-blue-400" />
            <span className="text-slate-200 font-semibold text-sm">Fetch Live Jobs from LinkedIn</span>
            <span className="text-xs text-slate-500 ml-1">
              Only real /jobs/view/ URLs are saved - Apply always works
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role / Keyword</label>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. react developer"
                className="w-52 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Location</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Bangalore, India"
                className="w-44 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Count</label>
              <select
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              onClick={fetchLive}
              disabled={fetching}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {fetching
                ? <><Loader2 className="w-4 h-4 animate-spin" />Fetching...</>
                : <><Search className="w-4 h-4" />Fetch Live Jobs</>
              }
            </button>
          </div>

          {status && (
            <div className={`mt-3 flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${
              status.type === "ok"  ? "bg-green-950/40 border border-green-800 text-green-300"
            : status.type === "err" ? "bg-red-950/40 border border-red-800 text-red-300"
            : "bg-blue-950/40 border border-blue-800 text-blue-300"
            }`}>
              {status.type === "ok"  ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
             : status.type === "err" ? <AlertCircle  className="w-4 h-4 mt-0.5 flex-shrink-0" />
             : <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />}
              <span>{status.msg}</span>
            </div>
          )}
        </div>

        {/* -- Job Cards -- */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 text-slate-400 py-20">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading job matches...</span>
          </div>

        ) : jobs.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <WifiOff className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg mb-1">No jobs in database yet</p>
            <p className="text-sm text-slate-600 mb-6">
              Click "Fetch Live Jobs" above to load real LinkedIn postings, or upload a resume first.
            </p>
          </div>

        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <div
                key={job.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-5 transition-all"
              >
                <div className="flex items-start gap-4 justify-between">

                  {/* Left - job info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <h3 className="text-slate-100 font-semibold text-lg leading-tight">
                        {job.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-slate-400 mb-2">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />{job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{job.location}
                      </span>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed mb-3 line-clamp-2">
                      {job.description}
                    </p>

                    {/* Skill badges - green = matched */}
                    <div className="flex flex-wrap gap-1.5">
                      {(job.skills_required || []).slice(0, 8).map((skill, i) => {
                        const matched = userSkills.some(
                          us => us === skill ||
                                us.includes(skill) ||
                                skill.includes(us)
                        );
                        return (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded-full text-xs border ${
                              matched
                                ? "bg-green-900/40 border-green-700/50 text-green-300"
                                : "bg-slate-800 border-slate-700 text-slate-500"
                            }`}
                          >
                            {skill}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right - score + apply */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <MatchBadge score={job.match_score} />
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition font-medium whitespace-nowrap"
                    >
                      Apply <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};