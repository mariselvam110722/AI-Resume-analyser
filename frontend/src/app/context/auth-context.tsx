import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface User {
  username: string;
  email: string;
}

interface Resume {
  id: string;
  score: number;
  dateAnalyzed: string;
  fileName: string;
}

interface AuthContextType {
  user: User | null;
  resumes: Resume[];
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  addResume: (resume: Resume) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);

  // Restore session on page load
  useEffect(() => {
    const saved = localStorage.getItem("username");
    if (saved) fetchProfile(saved);
  }, []);

  const fetchProfile = async (username: string) => {
    const res  = await fetch(`http://127.0.0.1:8000/profile/${username}`);
    const data = await res.json();
    setUser({ username: data.username, email: data.email });
  };

  const login = async (username: string, password: string) => {
    const res  = await fetch("http://127.0.0.1:8000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) throw new Error("Invalid credentials");
    localStorage.setItem("username", username);
    await fetchProfile(username);
  };

  const register = async (username: string, email: string, password: string) => {
    await fetch("http://127.0.0.1:8000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });
    localStorage.setItem("username", username);
    setUser({ username, email });
  };

  const logout = () => {
    setUser(null);
    setResumes([]);
    localStorage.clear();
  };

  const addResume = (resume: Resume) =>
    setResumes(prev => [resume, ...prev]);

  return (
    <AuthContext.Provider value={{ user, resumes, login, register, logout, addResume }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
