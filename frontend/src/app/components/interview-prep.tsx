/**
 * interview-prep.tsx — Feature 2: AI Interview Preparation
 * Upload resume → GET 5 Technical, 5 HR, 5 Project questions with hints.
 * Each question is an expandable accordion card.
 */

import React, { useState, useRef } from "react";
import { Sidebar } from "./sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useAuth } from "../context/auth-context";
import {
  Upload, Loader2, ChevronDown, ChevronUp,
  Code, Users, FolderOpen, Lightbulb, FileText
} from "lucide-react";

interface Question { question: string; hint: string; }
interface QData    { technical: Question[]; hr: Question[]; project: Question[]; }

// ── Single expandable question card ──────────────────────
const QCard: React.FC<{ q: Question; idx: number }> = ({ q, idx }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex justify-between items-start gap-3 hover:bg-slate-800 transition"
        onClick={() => setOpen(!open)}
      >
        <span className="text-slate-200 text-sm">
          <span className="text-slate-500 mr-2">Q{idx + 1}.</span>{q.question}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
               : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-400 text-sm">{q.hint}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Category section ──────────────────────────────────────
const Category: React.FC<{
  title: string; icon: React.ReactNode; color: string; questions: Question[];
}> = ({ title, icon, color, questions }) => (
  <Card className="bg-slate-900 border-slate-800 mt-6">
    <CardHeader>
      <CardTitle className={`flex items-center gap-2 ${color}`}>
        {icon} {title}
        <span className="ml-auto text-sm font-normal text-slate-500">{questions.length} questions</span>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {questions.map((q, i) => <QCard key={i} q={q} idx={i} />)}
    </CardContent>
  </Card>
);

// ── Main component ────────────────────────────────────────
export const InterviewPrep: React.FC = () => {
  const { user }                          = useAuth();
  const [loading, setLoading]             = useState(false);
  const [questions, setQuestions]         = useState<QData | null>(null);
  const [error, setError]                 = useState("");
  const [fileName, setFileName]           = useState("");
  const fileRef                           = useRef<HTMLInputElement>(null);

  const generate = async (file?: File) => {
    setLoading(true); setError(""); setQuestions(null);
    const form = new FormData();
    if (file) form.append("file", file);
    form.append("username", user?.username || "guest");
    try {
      const res  = await fetch("http://localhost:8000/api/generate-interview-questions", { method: "POST", body: form });
      const data = await res.json();
      data.error ? setError(data.error) : setQuestions(data);
    } catch {
      setError("Failed to generate questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFileName(f.name); generate(f); }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 p-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-100 mb-2">Interview Prep</h1>
        <p className="text-slate-400 mb-8">Upload your resume and get AI-generated questions tailored to your profile.</p>

        {/* Upload area */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div
              className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-600 transition"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <p className="text-slate-300 font-medium mb-1">{fileName || "Drop your resume PDF here"}</p>
              <p className="text-slate-500 text-sm">or click to browse</p>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFile} />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 border-t border-slate-700" />
              <span className="text-slate-600 text-sm">or</span>
              <div className="flex-1 border-t border-slate-700" />
            </div>

            <button
              onClick={() => { setFileName("(last uploaded resume)"); generate(); }}
              className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
            >
              Use my last uploaded resume
            </button>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-slate-400 mt-8">
            <Loader2 className="animate-spin" /><span>Generating personalised questions…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="mt-6 bg-red-950/30 border-red-800">
            <CardContent className="p-4 text-red-300 text-sm">{error}</CardContent>
          </Card>
        )}

        {/* Questions */}
        {questions && (
          <>
            <Category title="Technical Questions"      icon={<Code className="w-5 h-5" />}      color="text-blue-400"   questions={questions.technical || []} />
            <Category title="HR Questions"             icon={<Users className="w-5 h-5" />}     color="text-green-400"  questions={questions.hr       || []} />
            <Category title="Project-Based Questions"  icon={<FolderOpen className="w-5 h-5" />} color="text-purple-400" questions={questions.project  || []} />
          </>
        )}
      </div>
    </div>
  );
};
