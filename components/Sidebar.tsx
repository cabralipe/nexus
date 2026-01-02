import React from 'react';
import { UserRole, ViewState } from '../types';
import { NAV_ITEMS } from '../constants';
import { GraduationCap, LogOut } from 'lucide-react';

interface SidebarProps {
  role: UserRole;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, currentView, onChangeView, onLogout }) => {
  // Filter nav items could be implemented here based on Role if we had defined role-specific navs in constants
  // For demo simplicity, we use the same structure but you would typically filter:
  // const items = NAV_ITEMS.filter(item => item.roles.includes(role));

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 shadow-xl z-10">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-indigo-600 p-2 rounded-lg">
             <GraduationCap size={24} className="text-white" />
        </div>
        <div>
            <h1 className="font-bold text-lg tracking-tight">EduSaaS</h1>
            <p className="text-xs text-slate-400">School Management</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentView === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 mb-3">
             <p className="text-xs text-slate-400 uppercase font-bold mb-1">Perfil Atual</p>
             <p className="text-sm font-medium text-white">{role}</p>
        </div>
        <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <LogOut size={16} />
          Sair do Sistema
        </button>
      </div>
    </div>
  );
};
