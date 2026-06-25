import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface User {
  username: string;
  email: string;
  role: string;
}

interface Resume {
  id: string;
  score: number;
  dateAnalyzed: string;
  fileName: string;
}

export interface InterviewSession {
  id: number;
  mode: string;
  difficulty_level: string;
  technical_score: number;
  hr_score: number;
  project_score: number;
  communication_score: number;
  fluency_score: number;
  confidence_score: number;
  overall_score: number;
  created_at: string;
}

export interface LiveInterviewSession {
  id: number;
  communication_score: number;
  confidence_score: number;
  technical_score: number;
  professionalism_score: number;
  body_language_score: number;
  hiring_probability: number;
  hiring_decision: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  resumes: Resume[];
  lastAnalysis: any | null;
  interviewSessions: InterviewSession[];
  liveInterviewHistory: LiveInterviewSession[];
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  addResume: (resume: Resume) => void;
  setLastAnalysis: (data: any) => void;
  addInterviewSession: (session: InterviewSession) => void;
  refreshLiveHistory: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser]                         = useState<User | null>(null);
  const [resumes, setResumes]                   = useState<Resume[]>([]);
  const [lastAnalysis, setLastAnalysisState]    = useState<any | null>(null);
  const [interviewSessions, setInterviewSessions] = useState<InterviewSession[]>([]);
  const [liveInterviewHistory, setLiveInterviewHistory] = useState<LiveInterviewSession[]>([]);

  // Restore session on page load
  useEffect(() => {
    const saved = localStorage.getItem('username');
    if (saved) {
      fetchProfile(saved);
      refreshLiveHistoryData(saved);
    }

    // Restore last analysis
    const savedAnalysis = localStorage.getItem('lastAnalysis');
    if (savedAnalysis) {
      try { setLastAnalysisState(JSON.parse(savedAnalysis)); } catch {}
    }

    // Restore interview sessions
    const savedSessions = localStorage.getItem('interviewSessions');
    if (savedSessions) {
      try { setInterviewSessions(JSON.parse(savedSessions)); } catch {}
    }

    // Restore resume history
    const savedResumes = localStorage.getItem('resumeHistory');
    if (savedResumes) {
      try { setResumes(JSON.parse(savedResumes)); } catch {}
    }
  }, []);

  const refreshLiveHistoryData = async (username: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/live-interview/history/${username}`);
      const data = await res.json();
      if (data.success && data.sessions) {
        setLiveInterviewHistory(data.sessions);
      }
    } catch {}
  };

  const refreshLiveHistory = async () => {
    if (user?.username) {
      await refreshLiveHistoryData(user.username);
    }
  };

  const fetchProfile = async (username: string) => {
    try {
      const res  = await fetch(`http://127.0.0.1:8000/profile/${username}`);
      const data = await res.json();
      setUser({ username: data.username, email: data.email, role: data.role || 'user' });
    } catch {}
  };

  const login = async (username: string, password: string) => {
    const res  = await fetch('http://127.0.0.1:8000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) throw new Error('Invalid credentials');
    localStorage.setItem('username', username);
    await fetchProfile(username);
    await refreshLiveHistoryData(username);
    // Update activity
    fetch('http://127.0.0.1:8000/user/activity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, is_online: true }),
    }).catch(() => {});
  };

  const register = async (username: string, email: string, password: string) => {
    await fetch('http://127.0.0.1:8000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    localStorage.setItem('username', username);
    setUser({ username, email, role: 'user' });
  };

  const logout = () => {
    const username = localStorage.getItem('username');
    if (username) {
      fetch('http://127.0.0.1:8000/user/activity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, is_online: false }),
      }).catch(() => {});
    }
    setUser(null);
    setResumes([]);
    setLastAnalysisState(null);
    setInterviewSessions([]);
    setLiveInterviewHistory([]);
    localStorage.clear();
  };

  const addResume = (resume: Resume) => {
    setResumes(prev => {
      const updated = [resume, ...prev];
      localStorage.setItem('resumeHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const setLastAnalysis = (data: any) => {
    setLastAnalysisState(data);
    localStorage.setItem('lastAnalysis', JSON.stringify(data));
  };

  const addInterviewSession = (session: InterviewSession) => {
    setInterviewSessions(prev => {
      const updated = [session, ...prev];
      localStorage.setItem('interviewSessions', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{
      user, resumes, lastAnalysis, interviewSessions, liveInterviewHistory,
      login, register, logout, addResume, setLastAnalysis, addInterviewSession, refreshLiveHistory
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
