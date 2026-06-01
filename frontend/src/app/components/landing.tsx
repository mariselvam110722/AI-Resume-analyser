/**
 * landing.tsx — AI Resume Analyzer Landing Page
 * Redesigned: Navbar with Login/Register + Hero + CTA + Features section
 */

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileSearch, Briefcase, MessageSquare, Bot, FileEdit,
  ChevronRight, Star, Zap, Shield
} from "lucide-react";

const features = [
  {
    icon: <FileSearch className="w-7 h-7" />,
    title: "Resume Analysis",
    desc: "Instant ATS score, strengths, weaknesses, and improvement suggestions powered by AI.",
    color: "from-blue-600 to-blue-400",
    bg: "bg-blue-600/10 border-blue-600/20",
  },
  {
    icon: <Briefcase className="w-7 h-7" />,
    title: "Job Recommendation",
    desc: "LinkedIn-sourced jobs matched to your resume skills with a real-time match score.",
    color: "from-violet-600 to-violet-400",
    bg: "bg-violet-600/10 border-violet-600/20",
  },
  {
    icon: <MessageSquare className="w-7 h-7" />,
    title: "Interview Preparation",
    desc: "AI-generated technical, HR, and project questions tailored to your resume.",
    color: "from-emerald-600 to-emerald-400",
    bg: "bg-emerald-600/10 border-emerald-600/20",
  },
  {
    icon: <Bot className="w-7 h-7" />,
    title: "AI Career Mentor",
    desc: "Context-aware career chatbot that knows your skills, gaps, and job market position.",
    color: "from-amber-500 to-orange-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: <FileEdit className="w-7 h-7" />,
    title: "Resume Builder",
    desc: "Build an ATS-optimised PDF resume with AI-polished summary in minutes.",
    color: "from-rose-600 to-pink-400",
    bg: "bg-rose-600/10 border-rose-600/20",
  },
];

const stats = [
  { value: "98%",  label: "ATS Accuracy",     icon: <Zap    className="w-4 h-4" /> },
  { value: "5+",   label: "AI Features",      icon: <Star   className="w-4 h-4" /> },
  { value: "100%", label: "Secure & Private", icon: <Shield className="w-4 h-4" /> },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-6 md:px-14 py-5 border-b border-white/5 backdrop-blur-sm bg-[#0a0f1e]/80 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100 tracking-tight"> Mari's ResumeAI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition"
          >
            Login
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
          >
            Register
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-20 pb-10">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/15 border border-blue-600/25 text-blue-400 text-xs font-medium mb-6">
            <Zap className="w-3 h-3" /> AI-Powered Career Platform
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-tight tracking-tight">
            AI-Powered{" "}
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Resume Analysis
            </span>
          </h1>

          <p className="text-slate-400 max-w-2xl mx-auto text-base md:text-lg mb-8 leading-relaxed">
            Upload your resume and get instant ATS score, strengths, weaknesses,
            job recommendations, interview prep, and a career mentor — all in one place.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 justify-center">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-blue-400">{s.icon}</span>
                <span className="font-bold text-white">{s.value}</span>
                <span className="text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hero Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="relative z-10 mt-14 w-full max-w-[500px]"
        >
          <img
            src="/ai-resume.png"
            alt="AI Resume Analyzer"
            className="w-full rounded-2xl shadow-2xl shadow-blue-900/30 border border-white/5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </motion.div>
      </section>

      {/* ── Ready to Analyze CTA (matches provided image) ── */}
      <section className="flex flex-col items-center text-center px-6 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Ready to Analyze Your Resume?</h2>
        <button
          onClick={() => navigate("/register")}
          className="px-10 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg transition shadow-lg shadow-blue-600/25"
        >
          Start Analysis
        </button>
      </section>

      {/* ── Features Section ── */}
      <section className="px-6 md:px-14 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Land Your Dream Job
            </span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Five powerful AI features designed to take your career to the next level.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`p-6 rounded-2xl border ${f.bg} hover:scale-[1.02] transition-transform cursor-default`}
            >
              <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${f.color} text-white mb-4`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-white text-base mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}

          {/* CTA card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: features.length * 0.08 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 border border-blue-600/40 flex flex-col justify-between hover:scale-[1.02] transition-transform"
          >
            <div>
              <h3 className="font-bold text-white text-lg mb-2">Start Your Journey</h3>
              <p className="text-blue-200 text-sm leading-relaxed mb-6">
                Join thousands of professionals who've boosted their careers with AI.
              </p>
            </div>
            <button
              onClick={() => navigate("/register")}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-xl font-semibold text-sm transition"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 text-center text-slate-500 text-sm px-6">
        <p>© 2025 ResumeAI · Built with React, FastAPI &amp; AI</p>
        <div className="flex justify-center gap-6 mt-3">
          <button onClick={() => navigate("/login")}    className="hover:text-slate-300 transition">Login</button>
          <button onClick={() => navigate("/register")} className="hover:text-slate-300 transition">Register</button>
        </div>
      </footer>
    </div>
  );
}
