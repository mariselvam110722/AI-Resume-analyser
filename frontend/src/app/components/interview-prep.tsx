/**
 * interview-prep.tsx — AI Mock Interview (v3)
 * Features: Text + Voice interview modes, Easy/Medium/Hard difficulty,
 * per-answer AI evaluation, final score report, voice waveform animation.
 * Uses existing resume data — NO re-upload required.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useAuth } from "../context/auth-context";
import type { InterviewSession } from "../context/auth-context";
import {
  Loader2, ChevronDown, ChevronUp, Code, Users, FolderOpen,
  Lightbulb, Mic, MicOff, Volume2, VolumeX, Play, SkipForward,
  CheckCircle, AlertCircle, Trophy, Brain, MessageSquare,
  ArrowRight, RotateCcw, Zap, Star, Target, Activity,
  ChevronRight, BookOpen, Flame
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────
interface Question { question: string; hint: string; category: string; }
interface QData    { technical: Question[]; hr: Question[]; project: Question[]; }
interface EvalResult {
  score:               number;
  confidence_score:    number;
  communication_score: number;
  fluency_score:       number;
  strengths:           string[];
  improvements:        string[];
  sample_best_answer:  string;
}
interface AnswerRecord {
  question:      Question;
  answer:        string;
  evaluation:    EvalResult;
  questionIndex: number;
}

type Phase =
  | "setup"          // difficulty + mode selection
  | "generating"     // fetching questions from AI
  | "question-bank"  // accordion view of all questions
  | "mock-interview" // one-question-at-a-time flow
  | "evaluating"     // waiting for AI eval
  | "feedback"       // showing per-answer feedback
  | "final-result";  // end-of-interview summary

type Difficulty = "easy" | "medium" | "hard";
type Mode       = "text" | "voice";

// ─── Difficulty config ──────────────────────────────────────
const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   color: "text-green-400",  bg: "bg-green-900/30",  border: "border-green-700", icon: "🌱" },
  medium: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-900/30", border: "border-yellow-700", icon: "⚡" },
  hard:   { label: "Hard",   color: "text-red-400",    bg: "bg-red-900/30",    border: "border-red-700",    icon: "🔥" },
};

// ─── Score ring component ────────────────────────────────────
const ScoreRing: React.FC<{ score: number; max?: number; label: string; color: string }> = ({
  score, max = 10, label, color
}) => {
  const pct = (score / max) * 100;
  const r   = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="36" y="40" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
          {score}
        </text>
      </svg>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
};

// ─── Waveform animation ─────────────────────────────────────
const VoiceWaveform: React.FC<{ active: boolean }> = ({ active }) => (
  <div className="flex items-center gap-1 h-8">
    {[1,2,3,4,5,6,7].map(i => (
      <div
        key={i}
        className={`w-1 rounded-full transition-all ${active ? "bg-blue-400" : "bg-slate-600"}`}
        style={{
          height: active ? `${Math.random() * 24 + 8}px` : "8px",
          animation: active ? `wave ${0.6 + i * 0.1}s ease-in-out infinite alternate` : "none",
          animationDelay: `${i * 0.08}s`,
        }}
      />
    ))}
    <style>{`
      @keyframes wave {
        from { height: 8px; }
        to   { height: 28px; }
      }
    `}</style>
  </div>
);

// ─── Expandable question card ────────────────────────────────
const QCard: React.FC<{ q: Question; idx: number }> = ({ q, idx }) => {
  const [open, setOpen] = useState(false);
  const catColors: Record<string, string> = {
    technical: "text-blue-400", hr: "text-green-400", project: "text-purple-400",
  };
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

// ─── Category section (question bank) ───────────────────────
const CategorySection: React.FC<{
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

// ─── Main Component ──────────────────────────────────────────
export const InterviewPrep: React.FC = () => {
  const { user, lastAnalysis, addInterviewSession } = useAuth();

  // Setup state
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [mode,       setMode]       = useState<Mode>("text");

  // Session state
  const [phase,       setPhase]       = useState<Phase>("setup");
  const [questions,   setQuestions]   = useState<QData | null>(null);
  const [sessionId,   setSessionId]   = useState<number | null>(null);
  const [error,       setError]       = useState("");
  const [resumeSummary, setResumeSummary] = useState<any>(null);

  // Mock interview state
  const allQuestions = questions
    ? [
        ...( questions.technical || []).map(q => ({ ...q, category: "technical" })),
        ...( questions.hr        || []).map(q => ({ ...q, category: "hr"        })),
        ...( questions.project   || []).map(q => ({ ...q, category: "project"   })),
      ]
    : [];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer,     setAnswer]     = useState("");
  const [answers,    setAnswers]    = useState<AnswerRecord[]>([]);
  const [evaluation, setEvaluation] = useState<EvalResult | null>(null);
  const [showSample, setShowSample] = useState(false);

  // Voice state
  const [recording,   setRecording]   = useState(false);
  const [transcript,  setTranscript]  = useState("");
  const [speaking,    setSpeaking]    = useState(false);
  const [speechReady, setSpeechReady] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef       = useRef<SpeechSynthesis | null>(null);

  // Check speech API availability
  useEffect(() => {
    const hasSpeech = 'speechSynthesis' in window;
    const hasRecog  = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    setSpeechReady(hasSpeech && hasRecog);
    synthRef.current = hasSpeech ? window.speechSynthesis : null;
  }, []);

  // Cleanup speech on unmount
  useEffect(() => () => {
    synthRef.current?.cancel();
    recognitionRef.current?.stop();
  }, []);

  // ── Generate questions ──────────────────────────────────────
  const generateQuestions = async () => {
    if (!user) return;
    setPhase("generating");
    setError("");
    try {
      const res = await fetch("http://localhost:8000/mock-interview/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          username:         user.username,
          difficulty_level: difficulty,
          mode,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setPhase("setup"); return; }
      setQuestions(data.questions);
      setSessionId(data.session_id);
      setResumeSummary(data.resume_summary);
      setPhase("question-bank");
    } catch {
      setError("Failed to generate questions. Please ensure your resume is uploaded on the Dashboard.");
      setPhase("setup");
    }
  };

  // ── Start mock interview ────────────────────────────────────
  const startMockInterview = () => {
    setCurrentIdx(0);
    setAnswers([]);
    setAnswer("");
    setTranscript("");
    setEvaluation(null);
    setPhase("mock-interview");
    if (mode === "voice") {
      setTimeout(() => speakQuestion(allQuestions[0]?.question || ""), 300);
    }
  };

  // ── Speech synthesis ────────────────────────────────────────
  const speakQuestion = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = 0.9;
    utt.pitch  = 1;
    utt.volume = 1;
    utt.onstart = () => setSpeaking(true);
    utt.onend   = () => setSpeaking(false);
    setSpeaking(true);
    synthRef.current.speak(utt);
  };

  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setSpeaking(false);
  };

  const replayQuestion = () => {
    if (allQuestions[currentIdx]) speakQuestion(allQuestions[currentIdx].question);
  };

  // ── Speech recognition ──────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = "en-US";

    recognition.onresult = (e: any) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript + " ";
        else                       interim += e.results[i][0].transcript;
      }
      setTranscript(prev => prev + final);
      setAnswer(prev => prev + final);
    };

    recognition.onerror = () => { setRecording(false); };
    recognition.onend   = () => { setRecording(false); };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  const replayAnswer = () => {
    if (!answer.trim() || !synthRef.current) return;
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(answer.trim());
    utt.rate = 0.9;
    synthRef.current.speak(utt);
  };

  // ── Submit answer ────────────────────────────────────────────
  const submitAnswer = async () => {
    if (!answer.trim() || !sessionId) return;
    const q = allQuestions[currentIdx];
    setPhase("evaluating");
    try {
      const res = await fetch("http://localhost:8000/mock-interview/answer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          session_id:    sessionId,
          question:      q.question,
          answer:        answer.trim(),
          question_type: q.category,
          mode,
        }),
      });
      const evalData: EvalResult = await res.json();
      setEvaluation(evalData);
      setAnswers(prev => [...prev, { question: q, answer: answer.trim(), evaluation: evalData, questionIndex: currentIdx }]);
      setShowSample(false);
      setPhase("feedback");
    } catch {
      setError("Failed to evaluate answer. Please try again.");
      setPhase("mock-interview");
    }
  };

  // ── Next question ────────────────────────────────────────────
  const nextQuestion = () => {
    const next = currentIdx + 1;
    if (next >= allQuestions.length) {
      finishInterview();
      return;
    }
    setCurrentIdx(next);
    setAnswer("");
    setTranscript("");
    setEvaluation(null);
    setPhase("mock-interview");
    if (mode === "voice") {
      setTimeout(() => speakQuestion(allQuestions[next].question), 300);
    }
  };

  // ── Finish interview ─────────────────────────────────────────
  const finishInterview = async () => {
    setPhase("final-result");

    // Calculate scores per category
    const techAnswers = answers.filter(a => a.question.category === "technical");
    const hrAnswers   = answers.filter(a => a.question.category === "hr");
    const projAnswers = answers.filter(a => a.question.category === "project");

    const avg = (arr: AnswerRecord[], field: keyof EvalResult): number => {
      if (!arr.length) return 0;
      return arr.reduce((s, a) => s + ((a.evaluation[field] as number) || 0), 0) / arr.length;
    };

    const technical_score    = parseFloat((avg(techAnswers, "score") * 10).toFixed(1));
    const hr_score           = parseFloat((avg(hrAnswers,   "score") * 10).toFixed(1));
    const project_score      = parseFloat((avg(projAnswers, "score") * 10).toFixed(1));
    const communication_score= parseFloat(avg(answers, "communication_score").toFixed(1));
    const fluency_score      = parseFloat(avg(answers, "fluency_score").toFixed(1));
    const confidence_score   = parseFloat(avg(answers, "confidence_score").toFixed(1));
    const overall_score      = parseFloat(((technical_score + hr_score + project_score) / 3).toFixed(1));

    const session: InterviewSession = {
      id:                 sessionId || Date.now(),
      mode,
      difficulty_level:  difficulty,
      technical_score,
      hr_score,
      project_score,
      communication_score,
      fluency_score,
      confidence_score,
      overall_score,
      created_at:        new Date().toISOString(),
    };
    addInterviewSession(session);

    if (sessionId && user) {
      try {
        await fetch("http://localhost:8000/mock-interview/save-result", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            session_id: sessionId,
            username:   user.username,
            technical_score, hr_score, project_score,
            communication_score, fluency_score, confidence_score,
            overall_score,
            answers_json: JSON.stringify(answers),
          }),
        });
      } catch {}
    }
  };

  const restart = () => {
    setPhase("setup");
    setQuestions(null);
    setSessionId(null);
    setAnswers([]);
    setCurrentIdx(0);
    setAnswer("");
    setTranscript("");
    setEvaluation(null);
    setError("");
  };

  // ─── Score helpers ──────────────────────────────────────────
  const getScoreColor = (score: number, max = 100) => {
    const pct = score / max * 100;
    if (pct >= 80) return "#22c55e";
    if (pct >= 60) return "#eab308";
    return "#ef4444";
  };

  const getGrade = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "text-green-400" };
    if (score >= 60) return { label: "Good",      color: "text-yellow-400" };
    if (score >= 40) return { label: "Average",   color: "text-orange-400" };
    return { label: "Needs Work", color: "text-red-400" };
  };

  const currentQ = allQuestions[currentIdx];

  // ── Final scores calculation ─────────────────────────────────
  const finalScores = (() => {
    if (phase !== "final-result" || !answers.length) return null;
    const avg = (arr: AnswerRecord[], field: keyof EvalResult): number => {
      if (!arr.length) return 0;
      return arr.reduce((s, a) => s + ((a.evaluation[field] as number) || 0), 0) / arr.length;
    };
    const techAnswers = answers.filter(a => a.question.category === "technical");
    const hrAnswers   = answers.filter(a => a.question.category === "hr");
    const projAnswers = answers.filter(a => a.question.category === "project");
    const tech  = avg(techAnswers, "score") * 10;
    const hr    = avg(hrAnswers,   "score") * 10;
    const proj  = avg(projAnswers, "score") * 10;
    const comm  = avg(answers, "communication_score");
    const conf  = avg(answers, "confidence_score");
    const flu   = avg(answers, "fluency_score");
    const overall = (tech + hr + proj) / 3;
    return { tech, hr, proj, comm, conf, flu, overall };
  })();

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full">

        {/* ── PHASE: SETUP ── */}
        {phase === "setup" && (
          <>
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-100 mb-2">AI Mock Interview</h1>
              <p className="text-slate-400">
                Personalized from your resume — no re-upload needed.
              </p>
              {lastAnalysis && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastAnalysis.skills?.slice(0,6).map((s: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-900/40 border border-blue-800 text-blue-300 text-xs rounded-full">{s}</span>
                  ))}
                  {lastAnalysis.skills?.length > 6 && (
                    <span className="px-2.5 py-1 text-slate-500 text-xs">+{lastAnalysis.skills.length - 6} more</span>
                  )}
                </div>
              )}
              {!lastAnalysis && (
                <div className="mt-3 p-3 bg-yellow-950/40 border border-yellow-800 rounded-lg text-yellow-300 text-sm">
                  ⚠ Upload a resume on the Dashboard first to personalize your interview questions.
                </div>
              )}
            </div>

            {/* Step 1: Difficulty */}
            <Card className="bg-slate-900 border-slate-800 mb-4">
              <CardHeader>
                <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">1</span>
                  Select Difficulty
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {(["easy","medium","hard"] as Difficulty[]).map(d => {
                    const cfg = DIFFICULTY_CONFIG[d];
                    const selected = difficulty === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          selected ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        <div className="text-2xl mb-1">{cfg.icon}</div>
                        <div className="font-semibold">{cfg.label}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {d === "easy" ? "Definitions & basics" : d === "medium" ? "Concepts & use cases" : "Internals & architecture"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Mode */}
            <Card className="bg-slate-900 border-slate-800 mb-6">
              <CardHeader>
                <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">2</span>
                  Select Interview Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {/* Text Mode */}
                  <button
                    onClick={() => setMode("text")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      mode === "text"
                        ? "bg-blue-900/30 border-blue-600 text-blue-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <MessageSquare className="w-6 h-6 mb-2" />
                    <div className="font-semibold">Text Interview</div>
                    <div className="text-xs mt-1 opacity-70">Type your answers</div>
                  </button>

                  {/* Voice Mode */}
                  <button
                    onClick={() => setMode("voice")}
                    className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                      mode === "voice"
                        ? "bg-purple-900/30 border-purple-600 text-purple-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <Mic className="w-6 h-6 mb-2" />
                    <div className="font-semibold">Voice Interview</div>
                    <div className="text-xs mt-1 opacity-70">Speak your answers</div>
                    {!speechReady && (
                      <span className="absolute top-2 right-2 text-xs bg-orange-900/60 text-orange-300 px-1.5 py-0.5 rounded">Browser support needed</span>
                    )}
                  </button>
                </div>

                {mode === "voice" && !speechReady && (
                  <p className="mt-3 text-orange-400 text-sm">
                    ⚠ Your browser may not support the Web Speech API. Please use Chrome or Edge for voice mode.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Generate button */}
            <button
              onClick={generateQuestions}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
            >
              <Brain className="w-5 h-5" />
              Generate Questions &amp; Start
              <ChevronRight className="w-5 h-5" />
            </button>

            {error && (
              <Card className="mt-4 bg-red-950/30 border-red-800">
                <CardContent className="p-4 text-red-300 text-sm">{error}</CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── PHASE: GENERATING ── */}
        {phase === "generating" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-100 mb-2">Generating Your Questions</h2>
              <p className="text-slate-400">AI is personalizing {DIFFICULTY_CONFIG[difficulty].label} questions from your resume…</p>
            </div>
          </div>
        )}

        {/* ── PHASE: QUESTION BANK ── */}
        {phase === "question-bank" && questions && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-100 mb-1">Your Interview Questions</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className={`px-2 py-0.5 rounded ${DIFFICULTY_CONFIG[difficulty].bg} ${DIFFICULTY_CONFIG[difficulty].color} border ${DIFFICULTY_CONFIG[difficulty].border}`}>
                    {DIFFICULTY_CONFIG[difficulty].icon} {DIFFICULTY_CONFIG[difficulty].label}
                  </span>
                  <span>·</span>
                  <span>{mode === "voice" ? "🎙 Voice Mode" : "⌨ Text Mode"}</span>
                  <span>·</span>
                  <span>{allQuestions.length} questions total</span>
                </div>
              </div>
              <button onClick={restart} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1">
                <RotateCcw className="w-4 h-4" /> Restart
              </button>
            </div>

            {/* Resume summary chips */}
            {resumeSummary && (
              <Card className="bg-slate-900 border-slate-800 mb-4">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-2">Questions generated from your resume:</p>
                  <div className="flex flex-wrap gap-2">
                    {resumeSummary.skills?.map((s: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-900/30 border border-blue-800 text-blue-300 text-xs rounded-full">{s}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* START MOCK INTERVIEW */}
            <button
              onClick={startMockInterview}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2 mb-6"
            >
              <Play className="w-5 h-5" />
              {mode === "voice" ? "🎙 Start Voice Mock Interview" : "🎯 Start Text Mock Interview"}
            </button>

            {/* Question accordion */}
            <CategorySection title="Technical Questions" icon={<Code className="w-5 h-5" />} color="text-blue-400"   questions={questions.technical || []} />
            <CategorySection title="HR Questions"        icon={<Users className="w-5 h-5" />} color="text-green-400"  questions={questions.hr       || []} />
            <CategorySection title="Project Questions"   icon={<FolderOpen className="w-5 h-5" />} color="text-purple-400" questions={questions.project  || []} />
          </>
        )}

        {/* ── PHASE: MOCK INTERVIEW ── */}
        {(phase === "mock-interview" || phase === "evaluating") && currentQ && (
          <>
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Question {currentIdx + 1} of {allQuestions.length}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${DIFFICULTY_CONFIG[difficulty].bg} ${DIFFICULTY_CONFIG[difficulty].color} border ${DIFFICULTY_CONFIG[difficulty].border}`}>
                    {DIFFICULTY_CONFIG[difficulty].label}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    currentQ.category === "technical" ? "bg-blue-900/30 text-blue-300 border border-blue-800"
                    : currentQ.category === "hr"       ? "bg-green-900/30 text-green-300 border border-green-800"
                    : "bg-purple-900/30 text-purple-300 border border-purple-800"
                  }`}>
                    {currentQ.category === "technical" ? "💻 Technical"
                     : currentQ.category === "hr"       ? "👥 HR"
                     : "📁 Project"}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${((currentIdx) / allQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question card */}
            <Card className="bg-slate-900 border-slate-800 mb-4">
              <CardContent className="p-6">
                <p className="text-slate-200 text-xl font-medium leading-relaxed mb-4">{currentQ.question}</p>
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span>{currentQ.hint}</span>
                </div>

                {/* Voice controls */}
                {mode === "voice" && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={replayQuestion}
                      disabled={speaking}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {speaking ? <Volume2 className="w-4 h-4 text-blue-400 animate-pulse" /> : <Play className="w-4 h-4" />}
                      {speaking ? "Speaking…" : "Replay Question"}
                    </button>
                    {speaking && (
                      <button onClick={stopSpeaking} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg text-sm transition">
                        <VolumeX className="w-4 h-4" /> Stop
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Answer input */}
            <Card className="bg-slate-900 border-slate-800 mb-4">
              <CardHeader>
                <CardTitle className="text-slate-300 text-sm font-medium flex items-center justify-between">
                  {mode === "voice" ? (
                    <span className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-purple-400" />
                      Voice Answer
                    </span>
                  ) : (
                    <span>Your Answer</span>
                  )}
                  {mode === "voice" && (
                    <div className="flex items-center gap-3">
                      <VoiceWaveform active={recording} />
                      <span className={`text-xs px-2 py-0.5 rounded-full ${recording ? "bg-red-900/50 text-red-300" : "bg-slate-800 text-slate-500"}`}>
                        {recording ? "● Recording" : "○ Not recording"}
                      </span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mode === "voice" ? (
                  <>
                    {/* Voice controls */}
                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={recording ? stopRecording : startRecording}
                        disabled={phase === "evaluating"}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition ${
                          recording
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-purple-600 hover:bg-purple-700 text-white"
                        } disabled:opacity-50`}
                      >
                        {recording ? <><MicOff className="w-4 h-4" /> Stop Recording</> : <><Mic className="w-4 h-4" /> Start Recording</>}
                      </button>
                      {answer && (
                        <button
                          onClick={replayAnswer}
                          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
                        >
                          <Play className="w-4 h-4" /> Replay Answer
                        </button>
                      )}
                    </div>
                    {/* Live transcript */}
                    <div className="min-h-[120px] p-3 bg-slate-800 rounded-lg border border-slate-700">
                      {transcript || answer ? (
                        <p className="text-slate-200 text-sm leading-relaxed">{answer}</p>
                      ) : (
                        <p className="text-slate-600 text-sm italic">
                          {recording ? "Listening… speak your answer" : "Press Start Recording to begin speaking"}
                        </p>
                      )}
                    </div>
                    {/* Text fallback */}
                    {!recording && (
                      <button
                        onClick={() => setMode("text")}
                        className="mt-2 text-xs text-slate-500 hover:text-slate-400 transition"
                      >
                        Switch to text input →
                      </button>
                    )}
                  </>
                ) : (
                  <textarea
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Type your answer here…"
                    rows={6}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm resize-none focus:outline-none focus:border-blue-500 transition placeholder:text-slate-600"
                    disabled={phase === "evaluating"}
                  />
                )}

                <button
                  onClick={submitAnswer}
                  disabled={!answer.trim() || phase === "evaluating"}
                  className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium text-sm transition flex items-center justify-center gap-2"
                >
                  {phase === "evaluating" ? <><Loader2 className="w-4 h-4 animate-spin" /> Evaluating…</> : <><CheckCircle className="w-4 h-4" /> Submit Answer</>}
                </button>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── PHASE: FEEDBACK ── */}
        {phase === "feedback" && evaluation && currentQ && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100">Answer Evaluation</h2>
                <span className="text-slate-400 text-sm">Q{currentIdx + 1} / {allQuestions.length}</span>
              </div>
              <p className="text-slate-400 text-sm mt-1 line-clamp-2">{currentQ.question}</p>
            </div>

            {/* Score rings */}
            <Card className="bg-slate-900 border-slate-800 mb-4">
              <CardContent className="p-6">
                <div className="flex flex-wrap justify-around gap-4">
                  <ScoreRing score={evaluation.score} max={10}  label="Answer Score"   color={getScoreColor(evaluation.score, 10)} />
                  <ScoreRing score={Math.round(evaluation.confidence_score)}    max={100} label="Confidence"    color={getScoreColor(evaluation.confidence_score)} />
                  <ScoreRing score={Math.round(evaluation.communication_score)} max={100} label="Communication" color={getScoreColor(evaluation.communication_score)} />
                  {mode === "voice" && (
                    <ScoreRing score={Math.round(evaluation.fluency_score)} max={100} label="Fluency" color={getScoreColor(evaluation.fluency_score)} />
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Strengths */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4" /> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {evaluation.strengths.map((s, i) => (
                    <p key={i} className="text-slate-300 text-sm flex gap-2">
                      <span className="text-green-400 mt-0.5">✔</span>{s}
                    </p>
                  ))}
                </CardContent>
              </Card>

              {/* Improvements */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-orange-400 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" /> Improvements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {evaluation.improvements.map((s, i) => (
                    <p key={i} className="text-slate-300 text-sm flex gap-2">
                      <span className="text-orange-400 mt-0.5">→</span>{s}
                    </p>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Sample best answer */}
            <Card className="bg-slate-900 border-slate-800 mb-4">
              <button
                className="w-full p-4 text-left flex items-center justify-between"
                onClick={() => setShowSample(!showSample)}
              >
                <span className="text-purple-400 font-medium text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Sample Best Answer
                </span>
                {showSample ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showSample && (
                <CardContent className="pt-0 pb-4 px-4">
                  <p className="text-slate-300 text-sm leading-relaxed">{evaluation.sample_best_answer}</p>
                </CardContent>
              )}
            </Card>

            {/* Next / Finish */}
            <button
              onClick={nextQuestion}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              {currentIdx + 1 >= allQuestions.length ? (
                <><Trophy className="w-5 h-5" /> View Final Results</>
              ) : (
                <><SkipForward className="w-5 h-5" /> Next Question ({currentIdx + 2}/{allQuestions.length})</>
              )}
            </button>
          </>
        )}

        {/* ── PHASE: FINAL RESULT ── */}
        {phase === "final-result" && finalScores && (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-100 mb-2">Interview Complete!</h1>
              <p className="text-slate-400">
                {DIFFICULTY_CONFIG[difficulty].icon} {DIFFICULTY_CONFIG[difficulty].label} · {mode === "voice" ? "🎙 Voice" : "⌨ Text"} · {answers.length} answers
              </p>
            </div>

            {/* Overall score big card */}
            <Card className="bg-gradient-to-br from-blue-950/60 to-purple-950/60 border-blue-800 mb-4">
              <CardContent className="p-8 text-center">
                <p className="text-slate-400 text-sm mb-2">Overall Interview Score</p>
                <div className="text-7xl font-bold text-white mb-2">{Math.round(finalScores.overall)}</div>
                <div className="text-slate-300 text-sm mb-1">out of 100</div>
                <div className={`text-lg font-semibold ${getGrade(finalScores.overall).color}`}>
                  {getGrade(finalScores.overall).label}
                </div>
              </CardContent>
            </Card>

            {/* Score breakdown grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {[
                { label: "Technical",     score: Math.round(finalScores.tech), icon: <Code className="w-4 h-4" />,        color: "text-blue-400"   },
                { label: "HR",            score: Math.round(finalScores.hr),   icon: <Users className="w-4 h-4" />,       color: "text-green-400"  },
                { label: "Project",       score: Math.round(finalScores.proj), icon: <FolderOpen className="w-4 h-4" />, color: "text-purple-400" },
                { label: "Communication", score: Math.round(finalScores.comm), icon: <MessageSquare className="w-4 h-4" />, color: "text-cyan-400" },
                { label: "Confidence",    score: Math.round(finalScores.conf), icon: <Star className="w-4 h-4" />,       color: "text-yellow-400" },
                ...(mode === "voice" ? [{ label: "Fluency", score: Math.round(finalScores.flu), icon: <Mic className="w-4 h-4" />, color: "text-pink-400" }] : []),
              ].map(({ label, score, icon, color }) => (
                <Card key={label} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4 text-center">
                    <div className={`flex items-center justify-center gap-1 mb-2 ${color}`}>{icon}<span className="text-xs">{label}</span></div>
                    <div className={`text-2xl font-bold ${color}`}>{score}</div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-current transition-all" style={{ width: `${score}%` }} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Answer-by-answer recap */}
            <Card className="bg-slate-900 border-slate-800 mb-4">
              <CardHeader>
                <CardTitle className="text-slate-300 text-sm">Answer Recap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {answers.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex-1 mr-3">
                      <p className="text-slate-300 text-sm font-medium line-clamp-1">Q{i+1}. {a.question.question}</p>
                      <p className="text-slate-500 text-xs mt-0.5 capitalize">{a.question.category}</p>
                    </div>
                    <div className={`text-lg font-bold ${getScoreColor(a.evaluation.score, 10) === "#22c55e" ? "text-green-400" : a.evaluation.score >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                      {a.evaluation.score}/10
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={startMockInterview}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Retry Same Questions
              </button>
              <button
                onClick={restart}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> New Interview
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
