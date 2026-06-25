import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/auth-context';
import { Button } from './ui/button';
import {
  LayoutDashboard, User, LogOut,
  Briefcase, MessageSquare, FileEdit, ClipboardList, Shield
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleLogout = () => { logout(); navigate('/'); };

  const menuItems = [
    { path: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard'      },
    { path: '/profile',         icon: User,            label: 'Profile'        },
    { path: '/jobs',            icon: Briefcase,       label: 'Job Matches'    },
    { path: '/interview-prep',  icon: ClipboardList,   label: 'Interview Prep' },
    { path: '/live-interview',  icon: ClipboardList,   label: 'AI Recruiter'   },
    { path: '/career-chat',     icon: MessageSquare,   label: 'Career Mentor'  },
    { path: '/resume-builder',  icon: FileEdit,        label: 'Resume Builder' },
  ];

  const isAdmin = user?.role === 'admin';

  return (
    <div className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col sticky top-0">
      {/* User avatar */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAdmin ? 'bg-blue-600' : 'bg-blue-600'}`}>
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-slate-100 font-medium">{user?.username}</p>
            <div className="flex items-center gap-1.5">
              {isAdmin ? (
                <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-full flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" /> Admin
                </span>
              ) : (
                <span className="text-slate-500 text-sm">User</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Button
              key={path}
              variant={isActive ? 'secondary' : 'ghost'}
              className={`w-full justify-start ${
                isActive
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
              onClick={() => navigate(path)}
            >
              <Icon className="w-4 h-4 mr-3" />
              {label}
            </Button>
          );
        })}

        {/* Admin Panel — only for admin role */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs text-slate-600 px-2 font-medium uppercase tracking-wider">Administration</p>
            </div>
            <Button
              variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
              className={`w-full justify-start ${
                location.pathname === '/admin'
                  ? 'bg-blue-700 text-white hover:bg-blue-800'
                  : 'text-blue-400 hover:bg-blue-950/50 hover:text-blue-300'
              }`}
              onClick={() => navigate('/admin')}
            >
              <Shield className="w-4 h-4 mr-3" />
              Admin Panel
            </Button>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <Button
          variant="ghost"
          className="w-full justify-start text-red-400 hover:bg-red-950 hover:text-red-300"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
};
