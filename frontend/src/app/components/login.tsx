import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../api";
import { useAuth } from "../context/auth-context";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Lock, User, AlertCircle } from "lucide-react";

export const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) { setError("Please enter your username."); return; }
    if (!password)        { setError("Please enter your password."); return; }

    setLoading(true);
    try {
      const res = await loginUser(username.trim(), password);
      if (res.success) {
        localStorage.setItem("user", username.trim());
        await login(username.trim(), password);
        navigate("/dashboard");
      } else {
        // Show exact server message: "Username not found" or "Incorrect password"
        setError(res.message || "Invalid username or password. Please try again.");
      }
    } catch {
      setError("Connection error. Make sure the backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4">
      <Card className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Resume Analyzer
          </CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to analyze your resume
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Error message box */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <Label className="text-slate-300">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  className="pl-10 bg-slate-800 text-white placeholder:text-slate-400 border border-slate-700 focus:border-blue-500 focus:ring-0"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  className="pl-10 bg-slate-800 text-white placeholder:text-slate-400 border border-slate-700 focus:border-blue-500 focus:ring-0"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => navigate("/register")}
            >
              Don't have an account? Register
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
};
