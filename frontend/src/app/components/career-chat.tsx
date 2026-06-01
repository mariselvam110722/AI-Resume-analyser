/**
 * career-chat.tsx — AI Career Mentor Chatbot
 * - Renders AI markdown responses: tables, lists, bold, headings, code
 * - Messages clear on logout, reload on login per user
 */

import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./sidebar";
import { useAuth } from "../context/auth-context";
import { Bot, Send, User, Loader2, Sparkles, Trash2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  message: string;
  timestamp?: string;
}

const QUICK = [
  "What skills should I learn next?",
  "How can I improve my ATS score?",
  "Suggest a career path for me",
  "Give me interview tips",
  "What projects should I build?",
  "How do I negotiate salary?",
];

// ─────────────────────────────────────────────────────────────
// Markdown renderer — zero dependencies, handles:
//   ## headings  **bold**  `code`  tables  1. lists  - bullets
// ─────────────────────────────────────────────────────────────
const MarkdownMessage: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  const baseText = isUser ? "text-white" : "text-slate-200";

  // ── inline formatters ──────────────────────────────────────
  const parseInline = (raw: string, key: string | number) => {
    // Split on **bold**, *italic*, `code`
    const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
          if (part.startsWith("*") && part.endsWith("*"))
            return <em key={i} className="italic">{part.slice(1, -1)}</em>;
          if (part.startsWith("`") && part.endsWith("`"))
            return (
              <code key={i} className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                isUser ? "bg-blue-700/60" : "bg-slate-700 text-green-300"
              }`}>
                {part.slice(1, -1)}
              </code>
            );
          return part;
        })}
      </span>
    );
  };

  // ── block renderer ──────────────────────────────────────────
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── blank line ────────────────────────────────────────────
    if (line.trim() === "") { i++; continue; }

    // ── horizontal rule ───────────────────────────────────────
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push(<hr key={i} className="border-slate-600 my-2" />);
      i++; continue;
    }

    // ── heading ##  ───────────────────────────────────────────
    const headMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headMatch) {
      const level = headMatch[1].length;
      const sizeClass = level === 1 ? "text-base font-bold mt-2 mb-1"
                      : level === 2 ? "text-sm font-bold mt-2 mb-1 text-blue-300"
                      :               "text-sm font-semibold mt-1.5 mb-0.5 text-slate-300";
      blocks.push(
        <p key={i} className={sizeClass}>{parseInline(headMatch[2], i)}</p>
      );
      i++; continue;
    }

    // ── table (lines starting with |) ─────────────────────────
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Filter out separator rows (|---|---|)
      const rows = tableLines.filter(l => !/^\s*\|[\s\-:|]+\|\s*$/.test(l));
      if (rows.length > 0) {
        const cells = (row: string) =>
          row.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());

        blocks.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-3 rounded-lg border border-slate-700">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className={isUser ? "bg-blue-700/50" : "bg-slate-700/60"}>
                  {cells(rows[0]).map((cell, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-semibold border-b border-slate-600 whitespace-nowrap">
                      {parseInline(cell, ci)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0
                    ? (isUser ? "bg-blue-700/20" : "bg-slate-800/40")
                    : (isUser ? "bg-blue-700/10" : "bg-slate-800/20")
                  }>
                    {cells(row).map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border-b border-slate-700/50 leading-relaxed">
                        {parseInline(cell, ci)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // ── numbered list  1. 2. 3. ───────────────────────────────
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal list-outside ml-4 space-y-1 my-2 text-sm">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed pl-1">{parseInline(item, idx)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // ── bullet list  - or * or • ──────────────────────────────
    if (/^[-*•]\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="space-y-1 my-2 text-sm">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isUser ? "bg-blue-200" : "bg-blue-400"
              }`} />
              <span>{parseInline(item, idx)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── code block  ``` ───────────────────────────────────────
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <pre key={`code-${i}`} className="bg-slate-900 border border-slate-700 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-green-300 leading-relaxed">
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // ── plain paragraph ───────────────────────────────────────
    blocks.push(
      <p key={i} className={`text-sm leading-relaxed ${baseText}`}>
        {parseInline(line, i)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
};

// ─────────────────────────────────────────────────────────────
// Main CareerChat component
// ─────────────────────────────────────────────────────────────
export const CareerChat: React.FC = () => {
  const { user }                          = useAuth();
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef                         = useRef<HTMLDivElement>(null);
  const loadedForUser                     = useRef<string | null>(null);

  // ── clear on logout, reload on login ──────────────────────
  useEffect(() => {
    if (!user) {
      setMessages([]);
      setInput("");
      setHistoryLoaded(false);
      loadedForUser.current = null;
      return;
    }
    if (loadedForUser.current === user.username) return;
    setMessages([]);
    setHistoryLoaded(false);
    loadedForUser.current = user.username;

    fetch(`http://localhost:8000/api/career-chat/history/${user.username}`)
      .then(r => r.json())
      .then(data => {
        if (data.history?.length) setMessages(data.history);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: "user", message: text }]);
    setInput("");
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/career-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user?.username || "guest", message: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        message: data.reply || "Sorry, I could not respond."
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        message: "Connection error. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (!user) return;
    try {
      await fetch(`http://localhost:8000/api/career-chat/clear/${user.username}`, { method: "DELETE" });
    } catch {}
    setMessages([]);
    setHistoryLoaded(true);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">AI Career Mentor</h1>
            <p className="text-xs text-slate-500">Personalised guidance based on your resume</p>
          </div>
          <Sparkles className="ml-auto text-blue-500 w-5 h-5" />
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Clear chat"
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Welcome screen */}
        {historyLoaded && messages.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
            <p className="text-slate-300 mb-3 text-sm">
              👋 Hi <span className="font-semibold text-blue-400">{user?.username}</span>!
              I'm your AI Career Mentor. Ask me anything about your career.
            </p>
            <p className="text-slate-500 text-xs mb-3">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((p, i) => (
                <button key={i} onClick={() => send(p)}
                  className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-5 mb-4 pr-1">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>

              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 self-start mt-0.5 ${
                msg.role === "assistant" ? "bg-blue-600" : "bg-slate-600"
              }`}>
                {msg.role === "assistant"
                  ? <Bot  className="w-4 h-4 text-white" />
                  : <User className="w-4 h-4 text-slate-200" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "assistant"
                  ? "bg-slate-900 border border-slate-800 text-slate-200"
                  : "bg-blue-600 text-white"
              }`}>
                <MarkdownMessage text={msg.message} isUser={msg.role === "user"} />

                {msg.timestamp && (
                  <p className="text-xs opacity-40 mt-2 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts after first message */}
        {messages.length > 0 && !loading && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
            {QUICK.slice(0, 4).map((p, i) => (
              <button key={i} onClick={() => send(p)}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full border border-slate-700 transition whitespace-nowrap flex-shrink-0">
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask me anything about your career…"
            rows={1}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-600 resize-none"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-600 text-center mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
};