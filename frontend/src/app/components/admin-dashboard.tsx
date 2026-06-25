/**
 * admin-dashboard.tsx — Admin Panel
 * Requires role === 'admin'. Auto-polls /admin/stats every 30s.
 * Sections: Stats cards, Revenue, Analytics tables.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Users, FileText, Mic, DollarSign, Activity,
  Wifi, WifiOff, TrendingUp, BarChart2, PieChart as PieChartIcon,
  RefreshCw, Shield, ArrowUp, Trophy, MessageSquare
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const API = 'http://localhost:8000';

// ─── Custom tooltip ──────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl text-sm text-slate-200">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => {
        const itemColor = p.color || p.payload?.fill || '#e2e8f0';
        return (
          <p key={i} style={{ color: itemColor }} className="font-semibold">
            {p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('revenue')
              ? `$${p.value.toFixed(2)}`
              : p.value}
          </p>
        );
      })}
    </div>
  );
};

// ─── Stat card ──────────────────────────────────────────────
const MetricCard: React.FC<{
  label:   string;
  value:   string | number;
  icon:    React.ReactNode;
  accent:  string;
  sub?:    string;
  trend?:  string;
}> = ({ label, value, icon, accent, sub, trend }) => (
  <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
    <CardContent className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${accent}`}>{icon}</div>
        {trend && (
          <span className="text-xs text-green-400 flex items-center gap-0.5">
            <ArrowUp className="w-3 h-3" />{trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-100 mb-0.5">{value}</p>
      <p className="text-slate-400 text-sm">{label}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

// ─── Table component ─────────────────────────────────────────
const DataTable: React.FC<{
  headers: string[];
  rows:    React.ReactNode[][];
  empty:   string;
}> = ({ headers, rows, empty }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-800">
          {headers.map(h => (
            <th key={h} className="text-left p-3 text-slate-500 font-medium text-xs uppercase tracking-wider">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((row, i) => (
          <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className="p-3 text-slate-300">{cell}</td>
            ))}
          </tr>
        )) : (
          <tr>
            <td colSpan={headers.length} className="p-8 text-center text-slate-600">{empty}</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// ─── Score badge ─────────────────────────────────────────────
const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const color = score >= 80 ? 'bg-green-900/40 text-green-400 border-green-800'
               : score >= 60 ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800'
               : 'bg-red-900/40 text-red-400 border-red-800';
  return <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${color}`}>{score}</span>;
};

// ─── Difficulty badge ────────────────────────────────────────
const DiffBadge: React.FC<{ level: string }> = ({ level }) => {
  const color = level === 'easy' ? 'bg-green-900/40 text-green-400'
               : level === 'hard'  ? 'bg-red-900/40 text-red-400'
               : 'bg-yellow-900/40 text-yellow-400';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${color}`}>{level}</span>;
};

// ─── Mode badge ──────────────────────────────────────────────
const ModeBadge: React.FC<{ mode: string }> = ({ mode }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
    mode === 'voice' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-900/40 text-blue-300'
  }`}>
    {mode === 'voice' ? '🎙 Voice' : '⌨ Text'}
  </span>
);

// ─── Online indicator ────────────────────────────────────────
const OnlineDot: React.FC<{ online: boolean }> = ({ online }) => (
  <span className="flex items-center gap-1.5">
    <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
    <span className={online ? 'text-green-400' : 'text-slate-500'}>{online ? 'Online' : 'Offline'}</span>
  </span>
);

// ─── Plan badge ──────────────────────────────────────────────
const PlanBadge: React.FC<{ plan: string }> = ({ plan }) => {
  const styles: Record<string, string> = {
    premium: 'bg-blue-900/40 text-blue-300 border-blue-700',
    basic:   'bg-blue-900/40 text-blue-300 border-blue-700',
    free:    'bg-slate-800 text-slate-400 border-slate-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${styles[plan] || styles.free}`}>
      {plan}
    </span>
  );
};

const PIE_COLORS  = ['#3b82f6', '#3b82f6', '#22c55e'];
const DIFF_COLORS = { easy: '#22c55e', medium: '#eab308', hard: '#ef4444' };

// ─── Main Component ──────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const [stats,       setStats]       = useState<any>(null);
  const [revenue,     setRevenue]     = useState<any>(null);
  const [usersData,   setUsersData]   = useState<any>(null);
  const [interviews,  setInterviews]  = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab,   setActiveTab]   = useState<'overview'|'revenue'|'users'|'interviews'>('overview');
  const [showRealData, setShowRealData] = useState(false);

  // Mock Data
  const mockStats = {
    totalUsers: 1542,
    activeUsers: 342,
    onlineUsers: 45,
    totalResumes: 8904,
    totalInterviews: 4521,
    voiceInterviews: 3102,
    totalRevenue: 24500.50,
    avgCommunication: 78,
    avgConfidence: 82,
    difficultyDistribution: { easy: 1200, medium: 2300, hard: 1021 },
  };

  const mockRevenue = {
    monthlyRevenue: 4500.00,
    yearlyRevenue: 54000.00,
    totalRevenue: 124500.50,
    monthlyChart: [
      { month: 'Jan', revenue: 3200 }, { month: 'Feb', revenue: 3800 },
      { month: 'Mar', revenue: 4100 }, { month: 'Apr', revenue: 3900 },
      { month: 'May', revenue: 4500 }, { month: 'Jun', revenue: 5100 },
      { month: 'Jul', revenue: 5400 },
    ],
    subscriptionDist: [
      { plan: 'premium', count: 450 },
      { plan: 'basic', count: 1200 },
      { plan: 'free', count: 8500 },
    ]
  };

  const mockUsersData = {
    users: [
      { username: 'john_doe', email: 'john@example.com', role: 'user', joinDate: '2023-01-15T00:00:00Z', lastActive: '2023-10-01T12:00:00Z', isOnline: true },
      { username: 'jane_smith', email: 'jane@example.com', role: 'admin', joinDate: '2022-11-20T00:00:00Z', lastActive: '2023-10-01T10:30:00Z', isOnline: false },
      { username: 'alex_j', email: 'alex@example.com', role: 'user', joinDate: '2023-05-10T00:00:00Z', lastActive: '2023-10-01T11:45:00Z', isOnline: true },
    ],
    recentResumes: [
      { username: 'john_doe', fileName: 'John_Doe_Resume_2023.pdf', score: 85, uploadDate: '2023-10-01T09:00:00Z' },
      { username: 'alex_j', fileName: 'Alex_J_CV.pdf', score: 92, uploadDate: '2023-09-30T14:20:00Z' },
      { username: 'sarah_m', fileName: 'Sarah_Marketing_Resume.pdf', score: 78, uploadDate: '2023-09-29T16:45:00Z' },
    ]
  };

  const mockInterviews = [
    { id: 1, username: 'john_doe', mode: 'voice', difficulty: 'medium', technical: 85, hr: 90, project: 80, overall: 85, date: '2023-10-01T10:00:00Z' },
    { id: 2, username: 'jane_smith', mode: 'text', difficulty: 'hard', technical: 92, hr: 88, project: 95, overall: 92, date: '2023-09-30T15:30:00Z' },
    { id: 3, username: 'alex_j', mode: 'voice', difficulty: 'easy', technical: 75, hr: 80, project: 70, overall: 75, date: '2023-09-29T09:15:00Z' },
    { id: 4, username: 'sarah_m', mode: 'voice', difficulty: 'medium', technical: 88, hr: 85, project: 90, overall: 88, date: '2023-09-28T14:00:00Z' },
    { id: 5, username: 'mike_t', mode: 'text', difficulty: 'easy', technical: 80, hr: 85, project: 75, overall: 80, date: '2023-09-27T11:45:00Z' },
  ];

  const fetchAll = useCallback(async () => {
    if (!showRealData) {
      setStats(mockStats);
      setRevenue(mockRevenue);
      setUsersData(mockUsersData);
      setInterviews(mockInterviews);
      setLoading(false);
      setLastRefresh(new Date());
      return;
    }

    setLoading(true);
    try {
      const [statsRes, revRes, usersRes, intRes] = await Promise.all([
        fetch(`${API}/admin/stats`),
        fetch(`${API}/admin/revenue`),
        fetch(`${API}/admin/users`),
        fetch(`${API}/admin/interviews`),
      ]);
      const [s, r, u, i] = await Promise.all([
        statsRes.json(), revRes.json(), usersRes.json(), intRes.json()
      ]);
      setStats(s);
      setRevenue(r);
      setUsersData(u);
      setInterviews(i.interviews || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Admin fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [showRealData]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Difficulty distribution from stats
  const diffData = stats?.difficultyDistribution
    ? Object.entries(stats.difficultyDistribution).map(([k, v]) => ({
        name: k.charAt(0).toUpperCase() + k.slice(1),
        value: v as number,
        color: (DIFF_COLORS as any)[k] || '#64748b',
      }))
    : [];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-100 mb-1 flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-400" />
                Admin Panel
                {!showRealData && <span className="ml-3 px-2 py-1 bg-yellow-900/40 text-yellow-400 text-xs font-semibold rounded-lg uppercase tracking-wide border border-yellow-700">Sample Data</span>}
              </h1>
              <p className="text-slate-400">
                Platform overview · Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRealData(!showRealData)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition font-medium border ${
                  showRealData 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {showRealData ? 'Show Sample Data' : 'Load Original Data'}
              </button>
              <button
                onClick={fetchAll}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-400 flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" /> Loading admin data…
              </div>
            </div>
          ) : (
            <>
              {/* ── Tab Nav ── */}
              <div className="flex gap-1 mb-6 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit">
                {(['overview','revenue','users','interviews'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                      activeTab === tab
                        ? 'bg-blue-700 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* ══════════════════════════════════════════
                  TAB: OVERVIEW
              ══════════════════════════════════════════ */}
              {activeTab === 'overview' && stats && (
                <>
                  {/* Top metric cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                    <MetricCard
                      label="Total Users"
                      value={stats.totalUsers}
                      icon={<Users className="w-5 h-5 text-blue-400" />}
                      accent="bg-blue-900/30"
                    />
                    <MetricCard
                      label="Active (24h)"
                      value={stats.activeUsers}
                      icon={<Activity className="w-5 h-5 text-green-400" />}
                      accent="bg-green-900/30"
                      sub="Last 24 hours"
                    />
                    <MetricCard
                      label="Online Now"
                      value={stats.onlineUsers}
                      icon={<Wifi className="w-5 h-5 text-cyan-400" />}
                      accent="bg-cyan-900/30"
                    />
                    <MetricCard
                      label="Total Resumes"
                      value={stats.totalResumes}
                      icon={<FileText className="w-5 h-5 text-yellow-400" />}
                      accent="bg-yellow-900/30"
                    />
                    <MetricCard
                      label="Interviews"
                      value={stats.totalInterviews}
                      icon={<Mic className="w-5 h-5 text-blue-400" />}
                      accent="bg-blue-900/30"
                      sub={`${stats.voiceInterviews} voice`}
                    />
                    <MetricCard
                      label="Total Revenue"
                      value={`$${stats.totalRevenue?.toFixed(2) || '0.00'}`}
                      icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
                      accent="bg-emerald-900/30"
                    />
                  </div>

                  {/* Secondary metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard
                      label="Voice Interviews"
                      value={stats.voiceInterviews}
                      icon={<Mic className="w-5 h-5 text-blue-400" />}
                      accent="bg-blue-900/30"
                    />
                    <MetricCard
                      label="Avg Communication"
                      value={`${stats.avgCommunication}%`}
                      icon={<MessageSquare className="w-5 h-5 text-cyan-400" />}
                      accent="bg-cyan-900/30"
                    />
                    <MetricCard
                      label="Avg Confidence"
                      value={`${stats.avgConfidence}%`}
                      icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                      accent="bg-yellow-900/30"
                    />
                    <MetricCard
                      label="Revenue Total"
                      value={`$${revenue?.totalRevenue?.toFixed(2) || '0.00'}`}
                      icon={<TrendingUp className="w-5 h-5 text-green-400" />}
                      accent="bg-green-900/30"
                    />
                  </div>

                  {/* Difficulty distribution */}
                  {diffData.length > 0 && (
                    <Card className="bg-slate-900 border-slate-800 mb-6">
                      <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                          <PieChartIcon className="w-5 h-5 text-yellow-400" />
                          Difficulty Distribution
                        </CardTitle>
                        <CardDescription className="text-slate-400">Interview sessions by difficulty</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-8">
                          <ResponsiveContainer width={200} height={200}>
                            <PieChart>
                              <Pie data={diffData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ percent }) => `${(percent*100).toFixed(0)}%`}>
                                {diffData.map((d, i) => <Cell key={i} fill={d.color} />)}
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-3">
                            {diffData.map((d, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                <span className="text-slate-300 text-sm">{d.name}</span>
                                <span className="text-slate-500 text-sm font-mono">{d.value} sessions</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* ══════════════════════════════════════════
                  TAB: REVENUE
              ══════════════════════════════════════════ */}
              {activeTab === 'revenue' && revenue && (
                <>
                  {/* Revenue cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard
                      label="Monthly Revenue"
                      value={`$${revenue.monthlyRevenue?.toFixed(2)}`}
                      icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
                      accent="bg-blue-900/30"
                    />
                    <MetricCard
                      label="Yearly Revenue"
                      value={`$${revenue.yearlyRevenue?.toFixed(2)}`}
                      icon={<BarChart2 className="w-5 h-5 text-blue-400" />}
                      accent="bg-blue-900/30"
                    />
                    <MetricCard
                      label="Total Revenue"
                      value={`$${revenue.totalRevenue?.toFixed(2)}`}
                      icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
                      accent="bg-emerald-900/30"
                    />
                  </div>

                  {/* Revenue Growth Line Chart */}
                  <Card className="bg-slate-900 border-slate-800 mb-6">
                    <CardHeader>
                      <CardTitle className="text-slate-100 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" /> Revenue Growth
                      </CardTitle>
                      <CardDescription className="text-slate-400">Last 12 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={revenue.monthlyChart || []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                          <Tooltip content={<ChartTooltip />} />
                          <Line
                            type="monotone" dataKey="revenue" name="Revenue ($)"
                            stroke="#3b82f6" strokeWidth={2.5}
                            dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Subscription Distribution Pie */}
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-blue-400" /> Subscription Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center gap-10">
                        <ResponsiveContainer width={240} height={240}>
                          <PieChart>
                            <Pie
                              data={revenue.subscriptionDist || []}
                              dataKey="count" nameKey="plan"
                              cx="50%" cy="50%" outerRadius={100}
                              label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {(revenue.subscriptionDist || []).map((_: any, i: number) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-4">
                          {(revenue.subscriptionDist || []).map((d: any, i: number) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-slate-200 capitalize font-medium">{d.plan}</span>
                              <span className="text-slate-500">{d.count} users</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* ══════════════════════════════════════════
                  TAB: USERS
              ══════════════════════════════════════════ */}
              {activeTab === 'users' && usersData && (
                <>
                  {/* Recent Users */}
                  <Card className="bg-slate-900 border-slate-800 mb-6">
                    <CardHeader>
                      <CardTitle className="text-slate-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-400" /> Recent Users
                      </CardTitle>
                      <CardDescription className="text-slate-400">{usersData.users?.length || 0} most recent accounts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DataTable
                        headers={['Name', 'Email', 'Role', 'Join Date', 'Last Active', 'Status']}
                        empty="No users found"
                        rows={(usersData.users || []).map((u: any) => [
                          <span className="font-medium text-slate-200">{u.username}</span>,
                          <span className="text-slate-400">{u.email || '—'}</span>,
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            u.role === 'admin' ? 'bg-blue-900/40 text-blue-300' : 'bg-slate-800 text-slate-400'
                          }`}>{u.role}</span>,
                          <span className="text-slate-500 text-xs">{u.joinDate ? new Date(u.joinDate).toLocaleDateString() : '—'}</span>,
                          <span className="text-slate-500 text-xs">{u.lastActive ? new Date(u.lastActive).toLocaleString() : '—'}</span>,
                          <OnlineDot online={u.isOnline} />,
                        ])}
                      />
                    </CardContent>
                  </Card>

                  {/* Recent Resume Uploads */}
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-yellow-400" /> Recent Resume Uploads
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DataTable
                        headers={['User', 'Resume Name', 'ATS Score', 'Upload Date']}
                        empty="No resumes found"
                        rows={(usersData.recentResumes || []).map((r: any) => [
                          <span className="font-medium text-slate-200">{r.username}</span>,
                          <span className="text-slate-400 text-xs">{r.fileName}</span>,
                          <ScoreBadge score={r.score} />,
                          <span className="text-slate-500 text-xs">{r.uploadDate ? new Date(r.uploadDate).toLocaleDateString() : '—'}</span>,
                        ])}
                      />
                    </CardContent>
                  </Card>
                </>
              )}

              {/* ══════════════════════════════════════════
                  TAB: INTERVIEWS
              ══════════════════════════════════════════ */}
              {activeTab === 'interviews' && (
                <>
                  {/* Interview performance chart */}
                  {interviews.length > 0 && (
                    <Card className="bg-slate-900 border-slate-800 mb-6">
                      <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                          <BarChart2 className="w-5 h-5 text-blue-400" /> Score Overview (last 20 sessions)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart
                            data={interviews.slice(0, 20).map((iv, i) => ({
                              session:   `#${interviews.length - i}`,
                              technical: iv.technical,
                              hr:        iv.hr,
                              project:   iv.project,
                            }))}
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="session" stroke="#64748b" tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="technical" name="Technical" fill="#3b82f6" radius={[2,2,0,0]} />
                            <Bar dataKey="hr"        name="HR"        fill="#22c55e" radius={[2,2,0,0]} />
                            <Bar dataKey="project"   name="Project"   fill="#3b82f6" radius={[2,2,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Interviews table */}
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 flex items-center gap-2">
                        <Mic className="w-5 h-5 text-blue-400" /> Recent Mock Interviews
                      </CardTitle>
                      <CardDescription className="text-slate-400">{interviews.length} sessions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DataTable
                        headers={['User', 'Mode', 'Difficulty', 'Technical', 'HR', 'Project', 'Overall', 'Date']}
                        empty="No interview sessions found"
                        rows={interviews.map(iv => [
                          <span className="font-medium text-slate-200">{iv.username}</span>,
                          <ModeBadge mode={iv.mode} />,
                          <DiffBadge level={iv.difficulty} />,
                          <ScoreBadge score={iv.technical} />,
                          <ScoreBadge score={iv.hr} />,
                          <ScoreBadge score={iv.project} />,
                          <ScoreBadge score={iv.overall} />,
                          <span className="text-slate-500 text-xs">{iv.date ? new Date(iv.date).toLocaleDateString() : '—'}</span>,
                        ])}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
