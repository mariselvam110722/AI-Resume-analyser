/**
 * api.js — Centralised API client for AI Resume Analyzer v2
 */

const BASE = "http://localhost:8000";

// ── AUTH ──────────────────────────────────────────────────

export const loginUser = async (username, password) => {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return await res.json();
};

export const registerUser = async (username, email, password) => {
  const res = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return await res.json();
};

// ── RESUME UPLOAD & ANALYSIS ──────────────────────────────

export const uploadResume = async (file, username) => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload?username=${username}`, {
    method: "POST",
    body: form,
  });
  return await res.json();
};

// ── FEATURE 1: Job Matching ───────────────────────────────

export const getRecommendedJobs = async (username) => {
  const res = await fetch(`${BASE}/api/recommended-jobs?username=${username}`);
  return await res.json();
};

// ── FEATURE 2: Interview Preparation ─────────────────────

export const generateInterviewQuestions = async (file, username) => {
  const form = new FormData();
  if (file) form.append("file", file);
  form.append("username", username);
  const res = await fetch(`${BASE}/api/generate-interview-questions`, {
    method: "POST",
    body: form,
  });
  return await res.json();
};

// ── FEATURE 3: Career Chatbot ─────────────────────────────

export const sendChatMessage = async (username, message) => {
  const res = await fetch(`${BASE}/api/career-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, message }),
  });
  return await res.json();
};

export const getChatHistory = async (username) => {
  const res = await fetch(`${BASE}/api/career-chat/history/${username}`);
  return await res.json();
};

// ── FEATURE 4: ATS Resume Builder ────────────────────────

export const generateResume = async (data) => {
  const res = await fetch(`${BASE}/api/generate-resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return await res.json();
};

export const getResumeDownloadUrl = (filename) =>
  `${BASE}/api/download-resume/${filename}`;
