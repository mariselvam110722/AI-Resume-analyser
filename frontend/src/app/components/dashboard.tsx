import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { UploadArea } from "./upload-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useAuth } from "../context/auth-context";
import {
  FileText, TrendingUp, AlertCircle, CheckCircle,
  Sparkles, AlertTriangle, Download
} from "lucide-react";
import jsPDF from "jspdf";

export const Dashboard: React.FC = () => {
  const { addResume, setLastAnalysis, lastAnalysis } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis,  setAnalysis]  = useState<any>(lastAnalysis);

  const handleResult = (data: any) => {
    setAnalyzing(false);
    setAnalysis(data);
    // Store full analysis in context (used by interview-prep and persistence)
    setLastAnalysis(data);
    addResume({
      id:           Date.now().toString(),
      score:        data.score,
      dateAnalyzed: new Date().toISOString().split("T")[0],
      fileName:     data.file_name,
    });
  };

  const handleClear = async () => {
    setAnalysis(null);
    setLastAnalysis(null);
    try {
      const username = localStorage.getItem("username") || "guest";
      await fetch(`http://localhost:8000/api/clear-resume?username=${username}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("Failed to clear resume history", e);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Professional PDF Report — fully font-safe, no monospace leak
  // ─────────────────────────────────────────────────────────
  const downloadPDF = () => {
    if (!analysis) return;

    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const PW  = 210;
    const PH  = 297;
    const ML  = 18;
    const MR  = 18;
    const MB  = 20;
    const TW  = PW - ML - MR;
    const LH  = 6.2;
    let   y   = 18;

    const safe = (t: string) =>
      (t || "")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u2026]/g, "...")
        .replace(/[\u00A0]/g, " ")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const F = (style: "bold" | "normal" | "italic" = "normal", size = 10.5) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
    };

    const checkPage = (need = LH) => {
      if (y + need > PH - MB) {
        doc.addPage();
        y = 18;
        pageBorder();
        pageFooter();
      }
    };

    const pageBorder = () => {
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.4);
      doc.rect(8, 8, PW - 16, PH - 16);
    };

    const pageFooter = () => {
      const pg = (doc as any).internal.getCurrentPageInfo().pageNumber;
      F("normal", 8);
      doc.setTextColor(160, 160, 170);
      doc.text(`AI Resume Analyzer  -  Page ${pg}`, PW / 2, PH - 9, { align: "center" });
    };

    const divider = (r = 210, g = 215, b = 225) => {
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.25);
      doc.line(ML, y, PW - MR, y);
      y += 3.5;
    };

    const para = (text: string, size = 10.5, r = 40, g = 42, b = 54) => {
      F("normal", size);
      doc.setTextColor(r, g, b);
      const lines: string[] = doc.splitTextToSize(safe(text), TW);
      lines.forEach((ln) => {
        checkPage(LH);
        F("normal", size);
        doc.setTextColor(r, g, b);
        doc.text(ln, ML, y);
        y += LH;
      });
    };

    const heading = (label: string, r: number, g: number, b: number) => {
      checkPage(16);
      y += 7;
      doc.setFillColor(r, g, b);
      doc.rect(ML, y - 5, 3.5, 7, "F");
      F("bold", 11.5);
      doc.setTextColor(r, g, b);
      doc.text(label.toUpperCase(), ML + 6, y);
      y += 2.5;
      divider(r, g, b);
      doc.setTextColor(40, 42, 54);
    };

    const bullet = (text: string, r: number, g: number, b: number) => {
      F("normal", 10.5);
      doc.setTextColor(40, 42, 54);
      const lines: string[] = doc.splitTextToSize(safe(text), TW - 7);
      lines.forEach((ln, i) => {
        checkPage(LH);
        F("normal", 10.5);
        doc.setTextColor(40, 42, 54);
        if (i === 0) {
          doc.setFillColor(r, g, b);
          doc.circle(ML + 2.5, y - 1.3, 1.1, "F");
        }
        doc.text(ln, ML + 7, y);
        y += LH;
      });
      y += 0.8;
    };

    pageBorder();
    pageFooter();

    doc.setFillColor(23, 37, 84);
    doc.rect(8, 8, PW - 16, 30, "F");
    doc.setFillColor(37, 99, 235);
    doc.rect(8, 34, PW - 16, 4, "F");

    F("bold", 20);
    doc.setTextColor(255, 255, 255);
    doc.text("AI Resume Analysis Report", PW / 2, 24, { align: "center" });

    F("normal", 9);
    doc.setTextColor(180, 210, 255);
    const nowStr = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
    doc.text(`Generated on ${nowStr}`, PW / 2, 32, { align: "center" });

    doc.setTextColor(40, 42, 54);
    y = 48;

    const score = analysis.score ?? 0;
    const [sr, sg, sb]: [number,number,number] =
      score >= 80 ? [22, 163, 74] : score >= 60 ? [180, 120, 0] : [200, 30, 30];
    const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Improvement";

    doc.setFillColor(244, 246, 252);
    doc.roundedRect(ML, y, TW, 24, 3, 3, "F");
    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, TW, 24, 3, 3, "S");

    F("bold", 10);
    doc.setTextColor(90, 95, 115);
    doc.text("ATS Score", ML + 5, y + 8);

    F("bold", 24);
    doc.setTextColor(sr, sg, sb);
    doc.text(String(score), ML + 5, y + 19);

    F("normal", 10);
    doc.setTextColor(100, 100, 120);
    const scoreW = doc.getTextWidth(String(score));
    doc.text("/ 100", ML + 8 + scoreW, y + 19);

    doc.setFillColor(sr, sg, sb);
    doc.roundedRect(PW - MR - 36, y + 6, 32, 11, 2, 2, "F");
    F("bold", 8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(scoreLabel, PW - MR - 20, y + 13.5, { align: "center" });

    const bx = ML + 42;
    const bw = TW - 82;
    const by = y + 14;
    doc.setFillColor(215, 220, 232);
    doc.roundedRect(bx, by - 3, bw, 5, 2, 2, "F");
    const filled = Math.max(0, Math.min(1, score / 100));
    if (filled > 0) {
      doc.setFillColor(sr, sg, sb);
      doc.roundedRect(bx, by - 3, bw * filled, 5, 2, 2, "F");
    }

    y += 30;

    if (analysis.summary) {
      heading("Professional Summary", 23, 37, 84);
      para(analysis.summary, 10.5, 35, 38, 55);
    }

    if (analysis.skills?.length > 0) {
      heading("Skills", 37, 99, 235);
      const tPad = 3.5;
      const tH   = 7.5;
      let   tx   = ML;
      doc.setFillColor(237, 244, 255);

      analysis.skills.forEach((sk: string) => {
        F("normal", 9);
        doc.setTextColor(30, 64, 175);
        const cleanSk = safe(sk);
        const tw = doc.getTextWidth(cleanSk) + tPad * 2 + 1;
        if (tx + tw > PW - MR - 2) {
          tx  = ML;
          y  += tH + 2.5;
          checkPage(tH + 2.5);
        }
        doc.setFillColor(237, 244, 255);
        doc.setDrawColor(147, 197, 253);
        doc.setLineWidth(0.2);
        doc.roundedRect(tx, y - 5.5, tw, tH, 1.5, 1.5, "FD");
        F("normal", 9);
        doc.setTextColor(30, 64, 175);
        doc.text(cleanSk, tx + tPad, y + 0.3);
        tx += tw + 2.5;
      });
      y += tH + 3;
    }

    if (analysis.strengths?.length > 0) {
      heading("Strengths", 21, 128, 61);
      analysis.strengths.forEach((s: string) => bullet(s, 21, 128, 61));
    }

    if (analysis.weaknesses?.length > 0) {
      heading("Weaknesses", 180, 120, 0);
      analysis.weaknesses.forEach((s: string) => bullet(s, 180, 120, 0));
    }

    if (analysis.missing_skills?.length > 0) {
      heading("Missing Skills (ATS Gap)", 200, 30, 30);
      analysis.missing_skills.forEach((s: string) => bullet(s, 200, 30, 30));
    }

    if (analysis.improvements?.length > 0) {
      heading("Improvement Suggestions", 109, 40, 217);
      analysis.improvements.forEach((s: string) => bullet(s, 109, 40, 217));
    }

    checkPage(14);
    y += 6;
    doc.setFillColor(244, 246, 252);
    doc.rect(ML, y, TW, 10, "F");
    F("italic", 8);
    doc.setTextColor(110, 120, 150);
    doc.text(
      "This report was generated by AI Resume Analyzer. Use it as a guide to improve your resume.",
      PW / 2, y + 6.5, { align: "center" }
    );

    doc.save("Resume_Analysis_Report.pdf");
  };

  // ─────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />

      <div className="flex-1 p-8 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-100 mb-4">Resume Analyzer</h1>

        <UploadArea
          onResult={(data) => {
            setAnalyzing(true);
            handleResult(data);
          }}
        />

        {/* Loading */}
        {analyzing && (
          <Card className="mt-6 bg-slate-900 border-slate-800">
            <CardContent className="p-6 flex gap-4 items-center">
              <Sparkles className="text-blue-500 animate-pulse" />
              <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-3 bg-blue-500 w-2/3 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        )}

        {analysis && (
          <>
            {/* SCORE CARD */}
            <Card className="mt-6 bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex gap-2 text-slate-100">
                  <TrendingUp /> Resume Score
                </CardTitle>
                <CardDescription>Overall ATS quality</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl font-bold text-blue-500">{analysis.score}/100</div>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    analysis.score >= 80 ? "bg-green-900/50 text-green-400"
                    : analysis.score >= 60 ? "bg-yellow-900/50 text-yellow-400"
                    : "bg-red-900/50 text-red-400"
                  }`}>
                    {analysis.score >= 80 ? "Excellent" : analysis.score >= 60 ? "Good" : "Needs Improvement"}
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden mb-6">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-700 ${
                      analysis.score >= 80 ? "bg-green-400"
                      : analysis.score >= 60 ? "bg-yellow-400" : "bg-red-400"
                    }`}
                    style={{ width: `${analysis.score}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={downloadPDF}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition font-medium text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download Professional Report PDF
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-red-900/40 hover:text-red-400 hover:border-red-800 text-slate-300 rounded-xl transition font-medium text-sm border border-slate-700"
                  >
                    Clear Results
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* SUMMARY */}
            {analysis.summary && (
              <Card className="mt-4 bg-slate-900 border-slate-800">
                <CardHeader><CardTitle className="text-blue-400">Summary</CardTitle></CardHeader>
                <CardContent><p className="text-slate-300 leading-relaxed">{analysis.summary}</p></CardContent>
              </Card>
            )}

            {/* SKILLS */}
            {analysis.skills?.length > 0 && (
              <Card className="mt-4 bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex gap-2"><FileText className="w-5 h-5" /> Skills</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {analysis.skills.map((s: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-blue-900/40 border border-blue-700/40 text-blue-300 text-sm rounded-full">{s}</span>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* STRENGTHS */}
            {analysis.strengths?.length > 0 && (
              <Card className="mt-4 bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-green-400 flex gap-2"><CheckCircle className="w-5 h-5" /> Strengths</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.strengths.map((s: string, i: number) => (
                    <p key={i} className="text-slate-300 flex gap-2"><span className="text-green-400 mt-0.5">✔</span>{s}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* WEAKNESSES */}
            {analysis.weaknesses?.length > 0 && (
              <Card className="mt-4 bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-yellow-400 flex gap-2"><AlertCircle className="w-5 h-5" /> Weaknesses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.weaknesses.map((s: string, i: number) => (
                    <p key={i} className="text-slate-300 flex gap-2"><span className="text-yellow-400 mt-0.5">⚠</span>{s}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* MISSING SKILLS */}
            {analysis.missing_skills?.length > 0 && (
              <Card className="mt-4 bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-red-400 flex gap-2"><AlertTriangle className="w-5 h-5" /> Missing Skills (ATS Gap)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.missing_skills.map((s: string, i: number) => (
                    <p key={i} className="text-slate-300 flex gap-2"><span className="text-red-400 mt-0.5">✗</span>{s}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* IMPROVEMENTS */}
            {analysis.improvements?.length > 0 && (
              <Card className="mt-4 bg-slate-900 border-slate-800 mb-8">
                <CardHeader>
                  <CardTitle className="text-purple-400">💡 Improvement Suggestions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.improvements.map((s: string, i: number) => (
                    <p key={i} className="text-slate-300 flex gap-2"><span className="text-purple-400 mt-0.5">→</span>{s}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};