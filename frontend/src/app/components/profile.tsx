import React from 'react';
import { Sidebar } from './sidebar';
import { useAuth } from '../context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { User, Mail, FileText, Calendar, TrendingUp } from 'lucide-react';
import { Badge } from './ui/badge';

export const Profile: React.FC = () => {
  const { user, resumes } = useAuth();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-950 text-green-400 border-green-800';
    if (score >= 60) return 'bg-yellow-950 text-yellow-400 border-yellow-800';
    return 'bg-red-950 text-red-400 border-red-800';
  };

  const averageScore = resumes.length > 0
    ? Math.round(resumes.reduce((sum, r) => sum + r.score, 0) / resumes.length)
    : 0;

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Profile</h1>
            <p className="text-slate-400">View your account details and resume history</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  User Details
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <User className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Username</p>
                    <p className="text-slate-200 font-medium">{user?.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="text-slate-200 font-medium">{user?.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Total Resumes</p>
                  <p className="text-3xl font-bold text-slate-100">{resumes.length}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Average Score</p>
                  <p className={`text-3xl font-bold ${getScoreColor(averageScore)}`}>
                    {averageScore}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Resume History
              </CardTitle>
              <CardDescription className="text-slate-400">
                All your analyzed resumes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resumes.length > 0 ? (
                <div className="space-y-3">
                  {resumes.map((resume) => (
                    <div
                      key={resume.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-blue-950 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-200 font-medium">{resume.fileName}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(resume.dateAnalyzed).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${getScoreBadge(resume.score)} px-3 py-1`}>
                        Score: {resume.score}/100
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400">No resumes analyzed yet</p>
                  <p className="text-slate-600 text-sm mt-1">
                    Upload a resume from the dashboard to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
