import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/auth-context';

// Pages
import Landing        from './components/landing';
import { Login }      from './components/login';
import { Register }   from './components/register';
import { Dashboard }  from './components/dashboard';
import { Profile }    from './components/profile';

// Feature pages
import { RecommendedJobs }  from './components/recommended-jobs';
import { InterviewPrep }    from './components/interview-prep';
import { CareerChat }       from './components/career-chat';
import { ResumeBuilder }    from './components/resume-builder';
import { AIRecruiter }      from './components/ai-recruiter';
import { AdminDashboard }   from './components/admin-dashboard';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/"         element={<Landing />} />
      <Route path="/login"    element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />

      {/* Protected */}
      <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/profile"       element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/jobs"          element={<PrivateRoute><RecommendedJobs /></PrivateRoute>} />
      <Route path="/interview-prep" element={<PrivateRoute><InterviewPrep /></PrivateRoute>} />
      <Route path="/live-interview" element={<PrivateRoute><AIRecruiter /></PrivateRoute>} />
      <Route path="/career-chat"   element={<PrivateRoute><CareerChat /></PrivateRoute>} />
      <Route path="/resume-builder" element={<PrivateRoute><ResumeBuilder /></PrivateRoute>} />

      {/* Admin only */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
