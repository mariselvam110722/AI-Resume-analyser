/**
 * resume-builder.tsx - ATS Resume Builder
 * PDF is generated directly from previewData using jsPDF
 * so summary ALWAYS appears regardless of DOM/state timing.
 */

import React, { useState, useRef, useMemo } from "react";
import { Sidebar } from "./sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useAuth } from "../context/auth-context";
import { Plus, Trash2, Loader2, Download, Eye, FileText, Sparkles } from "lucide-react";

// -- Dynamic list field ------------------------------------
const ArrayField: React.FC<{
  label: string;
  placeholder: string;
  items: string[];
  onChange: (v: string[]) => void;
}> = ({ label, placeholder, items, onChange }) => {
  const add    = ()                     => onChange([...items, ""]);
  const upd    = (i: number, v: string) => { const c = [...items]; c[i] = v; onChange(c); };
  const remove = (i: number)            => onChange(items.filter((_, j) => j !== i));
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={e => upd(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-600"
            />
            <button onClick={() => remove(i)} className="p-2 text-slate-500 hover:text-red-400 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition">
          <Plus className="w-4 h-4" /> Add {label.toLowerCase()}
        </button>
      </div>
    </div>
  );
};

// -- Resume Preview (live, inline styles for WYSIWYG) ------
const Preview = React.forwardRef<HTMLDivElement, { s: any }>(({ s }, ref) => {
  const hasContent = s.name || s.summary || s.skills?.some((x: string) => x);
  if (!hasContent) {
    return (
      <div ref={ref} style={{
        background: "#fff", padding: "40px", minHeight: "300px",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#aaa", fontFamily: "Georgia, serif", fontSize: "13pt",
        borderRadius: "8px", boxShadow: "0 4px 24px rgba(0,0,0,0.3)", width: "100%",
      }}>
        Fill in your details to see the preview
      </div>
    );
  }

  const SecHead = ({ title }: { title: string }) => (
    <div style={{ marginBottom: "14px" }}>
      <h2 style={{
        fontWeight: "bold", textTransform: "uppercase", fontSize: "9pt",
        letterSpacing: "1.5px", color: "#333", marginBottom: "4px",
        fontFamily: "Georgia, serif",
      }}>{title}</h2>
      <hr style={{ borderColor: "#bbb", borderWidth: "0.5px", margin: 0 }} />
    </div>
  );

  return (
    <div ref={ref} id="resume-preview" style={{
      background: "#ffffff", color: "#1a1a2e",
      padding: "40px 44px", fontFamily: "'Times New Roman', Times, Georgia, serif",
      fontSize: "10pt", lineHeight: "1.65", minHeight: "842px",
      width: "100%", maxWidth: "680px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.3)", borderRadius: "8px",
    }}>

      {/* Name */}
      <h1 style={{
        fontSize: "20pt", fontWeight: "bold", textTransform: "uppercase",
        letterSpacing: "2px", textAlign: "center", marginBottom: "4px",
        color: "#1a1a2e", fontFamily: "Georgia, serif",
      }}>{s.name || "YOUR NAME"}</h1>

      {/* Contact */}
      {(s.email || s.phone) && (
        <p style={{ textAlign: "center", fontSize: "9pt", color: "#555", marginBottom: "12px" }}>
          {[s.email, s.phone].filter(Boolean).join("  |  ")}
        </p>
      )}

      {/* Divider */}
      <hr style={{ borderColor: "#1a1a2e", borderWidth: "1.5px", marginBottom: "16px" }} />

      {/* PROFESSIONAL SUMMARY - always shown if present */}
      {s.summary && s.summary.trim() && (
        <div style={{ marginBottom: "18px" }}>
          <SecHead title="Professional Summary" />
          <p style={{ fontSize: "10pt", lineHeight: "1.65", color: "#222", margin: 0 }}>
            {s.summary}
          </p>
        </div>
      )}

      {/* SKILLS */}
      {s.skills?.filter((x: string) => x.trim()).length > 0 && (
        <div style={{ marginBottom: "18px" }}>
          <SecHead title="Skills" />
          <p style={{ fontSize: "10pt", color: "#222", margin: 0 }}>
            {s.skills.filter((x: string) => x.trim()).join("   |   ")}
          </p>
        </div>
      )}

      {/* WORK EXPERIENCE */}
      {s.experience?.filter((x: string) => x.trim()).length > 0 && (
        <div style={{ marginBottom: "18px" }}>
          <SecHead title="Work Experience" />
          {s.experience.filter((x: string) => x.trim()).map((e: string, i: number) => (
            <p key={i} style={{ fontSize: "10pt", color: "#222", margin: "0 0 5px 0" }}>* {e}</p>
          ))}
        </div>
      )}

      {/* EDUCATION */}
      {s.education?.filter((x: string) => x.trim()).length > 0 && (
        <div style={{ marginBottom: "18px" }}>
          <SecHead title="Education" />
          {s.education.filter((x: string) => x.trim()).map((e: string, i: number) => (
            <p key={i} style={{ fontSize: "10pt", color: "#222", margin: "0 0 5px 0" }}>* {e}</p>
          ))}
        </div>
      )}

      {/* PROJECTS */}
      {s.projects?.filter((x: string) => x.trim()).length > 0 && (
        <div style={{ marginBottom: "18px" }}>
          <SecHead title="Projects" />
          {s.projects.filter((x: string) => x.trim()).map((p: string, i: number) => (
            <p key={i} style={{ fontSize: "10pt", color: "#222", margin: "0 0 5px 0" }}>* {p}</p>
          ))}
        </div>
      )}
    </div>
  );
});
Preview.displayName = "Preview";

// -- Main component ----------------------------------------
export const ResumeBuilder: React.FC = () => {
  const { user }                    = useAuth();
  const [tab, setTab]               = useState<"form" | "preview">("form");
  const [loading, setLoading]       = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [error, setError]           = useState("");
  const [aiSummary, setAiSummary]   = useState("");
  const previewRef                  = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "", email: user?.email || "", phone: "",
    summary: "",
    skills: [""], education: [""], projects: [""], experience: [""],
  });

  const set  = (field: string) => (val: any) => setForm(p => ({ ...p, [field]: val }));
  const setF = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  // Live preview data - summary always shows form value OR ai-polished value
  const previewData = useMemo(() => ({
    name:       form.name,
    email:      form.email,
    phone:      form.phone,
    summary:    aiSummary || form.summary,  // KEY: always use something
    skills:     form.skills.filter(Boolean),
    experience: form.experience.filter(Boolean),
    education:  form.education.filter(Boolean),
    projects:   form.projects.filter(Boolean),
  }), [form, aiSummary]);

  // -- Generate resume via backend --------------------------
  const submit = async () => {
    if (!form.name) { setError("Please enter your name."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("http://localhost:8000/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username:   user?.username || "guest",
          name:       form.name,
          email:      form.email,
          phone:      form.phone,
          summary:    form.summary,
          skills:     form.skills.filter(Boolean),
          education:  form.education.filter(Boolean),
          projects:   form.projects.filter(Boolean),
          experience: form.experience.filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        const polished = (data.polished_summary || data.sections?.summary || "").trim();
        setAiSummary(polished || form.summary);
        setTab("preview");
      } else {
        setError("Failed to generate resume. Please retry.");
      }
    } catch {
      setError("Server error. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // -- PDF - built directly from previewData using jsPDF ----
  // This guarantees summary always appears because we read from
  // state (previewData) directly, NOT from the DOM snapshot.
  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const mod   = await import("jspdf");
      const jsPDF = (mod as any).default || (mod as any).jsPDF;
      const doc   = new jsPDF({ unit: "mm", format: "a4" });

      const PW = 210, PH = 297, ML = 20, MR = 20, MB = 20;
      const TW = PW - ML - MR;
      const LH = 6.5;
      let   y  = 20;

      // strip non-ASCII to prevent font switching to Courier
      const safe = (t: string) =>
        (t || "").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " ").trim();

      // always call F() before drawing text
      const F = (style: "bold" | "normal" | "italic" = "normal", size = 10.5) => {
        doc.setFont("helvetica", style);
        doc.setFontSize(size);
      };

      const checkPage = (need = LH) => {
        if (y + need > PH - MB) { doc.addPage(); y = 20; }
      };

      const drawSection = (title: string) => {
        checkPage(14);
        y += 5;
        F("bold", 9.5);
        doc.setTextColor(30, 30, 50);
        doc.text(title.toUpperCase(), ML, y);
        y += 2.5;
        doc.setDrawColor(180, 185, 200);
        doc.setLineWidth(0.3);
        doc.line(ML, y, PW - MR, y);
        y += 5;
        doc.setTextColor(35, 35, 45);
      };

      const writePara = (text: string) => {
        F("normal", 10.5);
        doc.setTextColor(35, 35, 45);
        const lines: string[] = doc.splitTextToSize(safe(text), TW);
        lines.forEach(ln => {
          checkPage(LH);
          F("normal", 10.5);
          doc.setTextColor(35, 35, 45);
          doc.text(ln, ML, y);
          y += LH;
        });
      };

      const writeBullet = (text: string) => {
        F("normal", 10.5);
        doc.setTextColor(35, 35, 45);
        const lines: string[] = doc.splitTextToSize(safe(text), TW - 6);
        lines.forEach((ln, i) => {
          checkPage(LH);
          F("normal", 10.5);
          doc.setTextColor(35, 35, 45);
          if (i === 0) {
            doc.setFillColor(35, 35, 45);
            doc.circle(ML + 2, y - 1.3, 1, "F");
          }
          doc.text(ln, ML + 6, y);
          y += LH;
        });
        y += 1;
      };

      const d = previewData;

      // The summary to use - read directly from state, not DOM
      const summaryText = (aiSummary || form.summary || "").trim();

      // ---- NAME ----
      F("bold", 20);
      doc.setTextColor(20, 20, 40);
      doc.text(safe(d.name || "YOUR NAME").toUpperCase(), PW / 2, y, { align: "center" });
      y += 7;

      // ---- CONTACT ----
      const contactLine = [d.email, d.phone].filter(Boolean).map(safe).join("  |  ");
      if (contactLine) {
        F("normal", 9);
        doc.setTextColor(80, 80, 100);
        doc.text(contactLine, PW / 2, y, { align: "center" });
        y += 6;
      }

      // ---- THICK DIVIDER ----
      doc.setDrawColor(20, 20, 40);
      doc.setLineWidth(1.2);
      doc.line(ML, y, PW - MR, y);
      y += 8;

      // ---- PROFESSIONAL SUMMARY (always included if not empty) ----
      if (summaryText) {
        drawSection("Professional Summary");
        writePara(summaryText);
        y += 3;
      }

      // ---- SKILLS ----
      const skills = (d.skills || []).filter((s: string) => s.trim());
      if (skills.length > 0) {
        drawSection("Skills");
        F("normal", 10.5);
        doc.setTextColor(35, 35, 45);
        const skillStr = skills.map(safe).join("   |   ");
        const sLines: string[] = doc.splitTextToSize(skillStr, TW);
        sLines.forEach(ln => {
          checkPage(LH);
          F("normal", 10.5);
          doc.setTextColor(35, 35, 45);
          doc.text(ln, ML, y);
          y += LH;
        });
        y += 3;
      }

      // ---- WORK EXPERIENCE ----
      const exp = (d.experience || []).filter((s: string) => s.trim());
      if (exp.length > 0) {
        drawSection("Work Experience");
        exp.forEach(writeBullet);
        y += 2;
      }

      // ---- EDUCATION ----
      const edu = (d.education || []).filter((s: string) => s.trim());
      if (edu.length > 0) {
        drawSection("Education");
        edu.forEach(writeBullet);
        y += 2;
      }

      // ---- PROJECTS ----
      const proj = (d.projects || []).filter((s: string) => s.trim());
      if (proj.length > 0) {
        drawSection("Projects");
        proj.forEach(writeBullet);
      }

      const safeName = safe(form.name || "resume").replace(/\s+/g, "_") || "resume";
      doc.save(`${safeName}_resume.pdf`);

    } catch (err) {
      console.error("PDF generation error:", err);
      if (result?.download_url) {
        window.open(`http://localhost:8000${result.download_url}`, "_blank");
      }
    } finally {
      setPdfLoading(false);
    }
  };

  // -- UI ----------------------------------------------------
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 p-8 max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold text-slate-100 mb-1">ATS Resume Builder</h1>
        <p className="text-slate-400 mb-6 text-sm">
          Fill in your details. AI polishes your summary and builds a clean PDF.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["form", "preview"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}>
              {t === "form" ? <><FileText className="w-4 h-4" />Edit</> : <><Eye className="w-4 h-4" />Preview</>}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500 self-center">Live preview updates as you type</span>
        </div>

        {/* ---- FORM TAB ---- */}
        <div className={tab === "form" ? "" : "hidden"}>

          {/* Basic info */}
          <Card className="bg-slate-900 border-slate-800 mb-5">
            <CardHeader><CardTitle className="text-slate-100 text-base">Basic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Full Name *", field: "name",  placeholder: "e.g. Mariselvam"  },
                { label: "Email",       field: "email", placeholder: "Mariselvam@email.com"    },
                { label: "Phone",       field: "phone", placeholder: "+916381398639"         },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
                  <input
                    value={(form as any)[field]}
                    onChange={setF(field)}
                    placeholder={placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-600"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Professional Summary */}
          <Card className="bg-slate-900 border-slate-800 mb-5">
            <CardHeader>
              <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                Professional Summary
                <span className="text-xs font-normal text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full">
                  Shows at top of resume
                </span>
              </CardTitle>
              <p className="text-slate-400 text-xs mt-1">
                Appears directly below your name. AI will polish it when you generate.
              </p>
            </CardHeader>
            <CardContent>
              <textarea
                value={form.summary}
                onChange={setF("summary")}
                rows={4}
                placeholder="e.g. Computer Science graduate with expertise in Python and React. Strong background in cloud services and web development. Seeking a software engineering role to build scalable, impactful applications."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                AI will enhance this on Generate. Leave blank to auto-generate from your skills.
              </p>
              {form.summary.trim() && (
                <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Preview:</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{form.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Array fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {[
              { title: "Skills",          field: "skills",     ph: "e.g. Python, React, SQL"           },
              { title: "Education",       field: "education",  ph: "B.Tech CSE, Anna University, 2024" },
              { title: "Work Experience", field: "experience", ph: "Software Engineer at TCS, 2022-24" },
              { title: "Projects",        field: "projects",   ph: "AI Resume Analyzer - React+FastAPI" },
            ].map(({ title, field, ph }) => (
              <Card key={field} className="bg-slate-900 border-slate-800">
                <CardHeader><CardTitle className="text-slate-100 text-base">{title}</CardTitle></CardHeader>
                <CardContent>
                  <ArrayField label={title} placeholder={ph}
                    items={(form as any)[field]} onChange={set(field)} />
                </CardContent>
              </Card>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 items-center">
            <button onClick={submit} disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-medium transition">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                : <><Sparkles className="w-4 h-4" />Generate ATS Resume</>}
            </button>
            <button onClick={() => setTab("preview")}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition">
              Live Preview
            </button>
          </div>
        </div>

        {/* ---- PREVIEW TAB ---- */}
        {tab === "preview" && (
          <div>
            {/* AI-polished summary badge */}
            {aiSummary && aiSummary !== form.summary && (
              <Card className="mb-4 bg-blue-950/30 border-blue-800">
                <CardContent className="p-4">
                  <p className="text-blue-300 text-sm font-medium mb-1">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1" />AI-Polished Summary
                  </p>
                  <p className="text-slate-300 text-sm leading-relaxed">{aiSummary}</p>
                </CardContent>
              </Card>
            )}

            {!result && (
              <div className="mb-4 p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-400 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
                Live preview. Click <strong className="text-white mx-1">Generate ATS Resume</strong> in Edit tab to AI-polish your summary and enable PDF download.
              </div>
            )}

            <div className="overflow-x-auto mb-5 flex justify-center">
              <Preview ref={previewRef} s={previewData} />
            </div>

            {result && (
              <div className="flex items-center gap-3">
                <button onClick={downloadPDF} disabled={pdfLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl font-medium transition">
                  {pdfLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Generating PDF...</>
                    : <><Download className="w-4 h-4" />Download PDF Resume</>}
                </button>
                <p className="text-slate-500 text-xs">Summary, skills and all sections included</p>
              </div>
            )}

            {!result && (
              <button onClick={() => setTab("form")}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition text-sm">
                <Sparkles className="w-4 h-4" /> Go to Edit to Generate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};