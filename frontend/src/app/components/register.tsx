import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../../api";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { User, Mail, Lock, AlertCircle, CheckCircle } from "lucide-react";

export const Register: React.FC = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");

    // Client-side validation
    if (!username.trim()) { setError("Username is required."); return; }
    if (username.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (!email.trim())    { setError("Email is required."); return; }
    if (!password)        { setError("Password is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await registerUser(username.trim(), email.trim(), password);
      if (res.success) {
        setSuccess("Account created successfully! Redirecting to login…");
        setTimeout(() => navigate("/login"), 1500);
      } else {
        // Show exact server message (e.g. "Username already exists")
        setError(res.message || "Registration failed. Please try again.");
      }
    } catch {
      setError("Connection error. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4">
      <Card className="w-full max-w-md bg-slate-900/80 border-slate-800 backdrop-blur-sm shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Create Account
          </CardTitle>
          <CardDescription className="text-slate-400">
            Register to start analyzing resumes
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-950/50 border border-green-800 text-green-300 text-sm">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <Label className="text-slate-300">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Choose a username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  placeholder="Create a password (min 6 chars)"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label className="text-slate-300">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(""); }}
                  className={`pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500 ${
                    confirm && password !== confirm ? "border-red-500" : ""
                  }`}
                  required
                />
              </div>
              {confirm && password !== confirm && (
                <p className="text-red-400 text-xs">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create Account"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => navigate("/login")}
            >
              Already have an account? Login
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
};
