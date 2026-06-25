import React, { useMemo } from 'react';
import { Sidebar } from './sidebar';
import { useAuth } from '../context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  User, Mail, FileText, Calendar, TrendingUp,
  Trophy, Mic, Target, Activity, BarChart2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie
} from 'recharts';

// ─── Custom tooltip for charts ──────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl text-sm text-slate-200">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => {
        const itemColor = p.color || p.payload?.fill || '#e2e8f0';
        return (
          <p key={i} style={{ color: itemColor }} className="font-semibold">{p.name}: {p.value}</p>
        );
      })}
    </div>
  );
};

// ─── Stat card ──────────────────────────────────────────────
const StatCard: React.FC<{
  label: string; value: string | number; icon: React.ReactNode;
  color: string; sub?: string;
}> = ({ label, value, icon, color, sub }) => (
  <Card className="bg-slate-900 border-slate-800">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm mb-1">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-slate-800`}>{icon}</div>
      </div>
    </CardContent>
  </Card>
);

export const Profile: React.FC = () => {
  const { user, resumes, interviewSessions, liveInterviewHistory } = useAuth();

  // ─── Computed stats ───────────────────────────────────────
  const averageScore = resumes.length > 0
    ? Math.round(resumes.reduce((sum, r) => sum + r.score, 0) / resumes.length)
    : 0;

  const highestInterviewScore = interviewSessions.length > 0
    ? Math.max(...interviewSessions.map(s => Math.round(s.overall_score)))
    : 0;

  // ─── Chart data ───────────────────────────────────────────
  const resumeChartData = useMemo(() => {
    return [...resumes]
      .reverse()
      .slice(-10)
      .map(r => ({
        date:  r.dateAnalyzed ? new Date(r.dateAnalyzed).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : 'N/A',
        score: r.score,
      }));
  }, [resumes]);

  const lastSession = interviewSessions[0];
  const interviewBarData = lastSession ? [
    { name: 'Technical',     score: Math.round(lastSession.technical_score)     },
    { name: 'HR',            score: Math.round(lastSession.hr_score)            },
    { name: 'Project',       score: Math.round(lastSession.project_score)       },
    { name: 'Communication', score: Math.round(lastSession.communication_score) },
  ] : [];

  const BAR_COLORS = ['#3b82f6','#22c55e','#3b82f6','#06b6d4'];

  // ─── Difficulty distribution ──────────────────────────────
  const diffCounts = interviewSessions.reduce((acc, s) => {
    acc[s.difficulty_level] = (acc[s.difficulty_level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const diffData = [
    { name: 'Easy',   value: diffCounts['easy']   || 0, color: '#22c55e' },
    { name: 'Medium', value: diffCounts['medium']  || 0, color: '#eab308' },
    { name: 'Hard',   value: diffCounts['hard']    || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // ─── Score/communication trend ────────────────────────────
  const scoreTrendData = [...interviewSessions]
    .reverse()
    .slice(-8)
    .map((s, i) => ({
      session:  `#${i + 1}`,
      overall:  Math.round(s.overall_score),
      communication: Math.round(s.communication_score),
      confidence:    Math.round(s.confidence_score),
    }));

  // ─── Score color helpers ──────────────────────────────────
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // ─── Score badge ─────────────────────────────────────────────
  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-950 text-green-400 border-green-800';
    if (score >= 60) return 'bg-yellow-950 text-yellow-400 border-yellow-800';
    return 'bg-red-950 text-red-400 border-red-800';
  };

  const [showRealData, setShowRealData] = React.useState(false);

  const mockInterviewSessions: any[] = [
    { difficulty_level: 'easy', overall_score: 75, communication_score: 70, confidence_score: 72 },
    { difficulty_level: 'easy', overall_score: 82, communication_score: 78, confidence_score: 80 },
    { difficulty_level: 'medium', overall_score: 88, communication_score: 85, confidence_score: 82 },
    { difficulty_level: 'hard', overall_score: 70, communication_score: 65, confidence_score: 68 },
    { difficulty_level: 'medium', overall_score: 92, communication_score: 90, confidence_score: 88 },
  ];

  const graphInterviewSessions = showRealData ? interviewSessions : mockInterviewSessions;

  // ─── Difficulty distribution (Graph) ────────────────────────
  const graphDiffCounts = graphInterviewSessions.reduce((acc, s) => {
    acc[s.difficulty_level] = (acc[s.difficulty_level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const graphDiffData = [
    { name: 'Easy',   value: graphDiffCounts['easy']   || 0, color: '#22c55e' },
    { name: 'Medium', value: graphDiffCounts['medium']  || 0, color: '#eab308' },
    { name: 'Hard',   value: graphDiffCounts['hard']    || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // ─── Score/communication trend (Graph) ────────────────────
  const graphScoreTrendData = [...graphInterviewSessions]
    .reverse()
    .slice(-8)
    .map((s, i) => ({
      session:  `#${i + 1}`,
      overall:  Math.round(s.overall_score),
      communication: Math.round(s.communication_score),
      confidence:    Math.round(s.confidence_score),
    }));

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Profile</h1>
            <p className="text-slate-400">Your account details, resume history &amp; performance analytics</p>
          </div>

          {/* ── User details + Basic stats ── */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  User Details
                </CardTitle>
                <CardDescription className="text-slate-400">Your account information</CardDescription>
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
                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <Target className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Role</p>
                    <p className="text-slate-200 font-medium capitalize">{user?.role || 'user'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Total Resumes</p>
                  <p className="text-3xl font-bold text-slate-100">{resumes.length}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Average ATS Score</p>
                  <p className={`text-3xl font-bold ${getScoreColor(averageScore)}`}>{averageScore}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Interviews Done</p>
                  <p className="text-3xl font-bold text-blue-400">{interviewSessions.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Stats Cards row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Resumes"
              value={resumes.length}
              icon={<FileText className="w-5 h-5 text-blue-400" />}
              color="text-blue-400"
            />
            <StatCard
              label="Average ATS Score"
              value={`${averageScore}/100`}
              icon={<TrendingUp className="w-5 h-5 text-green-400" />}
              color={getScoreColor(averageScore)}
            />
            <StatCard
              label="Interviews Done"
              value={interviewSessions.length}
              icon={<Mic className="w-5 h-5 text-blue-400" />}
              color="text-blue-400"
              sub={`${interviewSessions.filter(s => s.mode === 'voice').length} voice`}
            />
            <StatCard
              label="Best Interview"
              value={`${highestInterviewScore}/100`}
              icon={<Trophy className="w-5 h-5 text-yellow-400" />}
              color="text-yellow-400"
            />
          </div>

          {/* ── Chart 1: Resume Score Progress ── */}
          <Card className="bg-slate-900 border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Resume Score Progress
              </CardTitle>
              <CardDescription className="text-slate-400">ATS scores across your resume uploads</CardDescription>
            </CardHeader>
            <CardContent>
              {resumeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={resumeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone" dataKey="score" name="ATS Score"
                      stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-600">
                  Upload resumes to see your score progress
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Chart 2: Interview Performance ── */}
          <Card className="bg-slate-900 border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-500" />
                Latest Interview Performance
              </CardTitle>
              <CardDescription className="text-slate-400">
                {lastSession
                  ? `${lastSession.difficulty_level} · ${lastSession.mode} · ${new Date(lastSession.created_at).toLocaleDateString()}`
                  : 'Complete a mock interview to see your scores'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {interviewBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={interviewBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="score" name="Score" radius={[4,4,0,0]}>
                      {interviewBarData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-600">
                  No interview sessions yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Chart 3 & 4 side-by-side: Score Trend + Difficulty Distribution ── */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowRealData(!showRealData)}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                showRealData 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {showRealData ? 'Show Sample Data' : 'Load Original Data'}
            </button>
          </div>
          {graphInterviewSessions.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Communication & Confidence Trend */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2 text-base">
                    <Activity className="w-4 h-4 text-cyan-400" /> Score Trends
                    {!showRealData && <span className="ml-2 px-1.5 py-0.5 bg-yellow-900/40 text-yellow-400 text-[10px] uppercase rounded border border-yellow-700">Sample</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {graphScoreTrendData.length > 1 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={graphScoreTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="session" stroke="#64748b" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="overall"       name="Overall"       stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="communication" name="Communication" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="confidence"    name="Confidence"    stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
                      Complete 2+ interviews to see trends
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Difficulty Distribution Pie */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2 text-base">
                    <Target className="w-4 h-4 text-yellow-400" /> Difficulty Breakdown
                    {!showRealData && <span className="ml-2 px-1.5 py-0.5 bg-yellow-900/40 text-yellow-400 text-[10px] uppercase rounded border border-yellow-700">Sample</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {graphDiffData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={graphDiffData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" outerRadius={70}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {graphDiffData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
                      No interview data yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Resume History ── */}
          <Card className="bg-slate-900 border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Resume History
              </CardTitle>
              <CardDescription className="text-slate-400">All your analyzed resumes</CardDescription>
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
                                month: 'short', day: 'numeric', year: 'numeric'
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
                  <p className="text-slate-600 text-sm mt-1">Upload a resume from the dashboard to get started</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Interview History ── */}
          {interviewSessions.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-blue-500" />
                  Interview History
                </CardTitle>
                <CardDescription className="text-slate-400">Your past mock interview sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {interviewSessions.slice(0, 10).map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          s.mode === 'voice' ? 'bg-blue-950' : 'bg-blue-950'
                        }`}>
                          {s.mode === 'voice' ? <Mic className="w-4 h-4 text-blue-400" /> : <FileText className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 text-sm font-medium capitalize">{s.mode} Interview</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              s.difficulty_level === 'easy'   ? 'bg-green-900/40 text-green-400' :
                              s.difficulty_level === 'hard'   ? 'bg-red-900/40 text-red-400' :
                              'bg-yellow-900/40 text-yellow-400'
                            }`}>{s.difficulty_level}</span>
                          </div>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {new Date(s.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${getScoreColor(s.overall_score)}`}>
                          {Math.round(s.overall_score)}
                        </p>
                        <p className="text-slate-500 text-xs">overall</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── AI Recruiter History ── */}
          {liveInterviewHistory && liveInterviewHistory.length > 0 && (
            <Card className="bg-slate-900 border-slate-800 mt-6">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-purple-500" />
                  AI Recruiter History
                </CardTitle>
                <CardDescription className="text-slate-400">Your past AI Recruiter live sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {liveInterviewHistory.slice(0, 10).map((s) => (
                    <div key={s.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-950">
                          <Activity className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 text-sm font-medium">Live Recruiter Session</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                              s.hiring_decision.includes('Strong') ? 'bg-green-900/40 text-green-400' :
                              s.hiring_decision.includes('Hire')   ? 'bg-blue-900/40 text-blue-400' :
                              s.hiring_decision.includes('Border') ? 'bg-yellow-900/40 text-yellow-400' :
                              'bg-red-900/40 text-red-400'
                            }`}>{s.hiring_decision}</span>
                          </div>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {new Date(s.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-slate-400 text-[10px] uppercase">Probability</p>
                          <p className={`text-xl font-bold ${getScoreColor(s.hiring_probability)}`}>
                            {s.hiring_probability}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-[10px] uppercase">Comm</p>
                          <p className={`text-lg font-bold ${getScoreColor(s.communication_score)}`}>
                            {s.communication_score}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-[10px] uppercase">Tech</p>
                          <p className={`text-lg font-bold ${getScoreColor(s.technical_score)}`}>
                            {s.technical_score}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
};
