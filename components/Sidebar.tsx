import React from 'react';
import { UserRole, ViewState } from '../types';
import { NAV_ITEMS } from '../constants';
import { GraduationCap, LogOut, X } from 'lucide-react';

interface SidebarProps {
  role: UserRole;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  pendingLessonPlansCount?: number;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  logo?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  currentView,
  onChangeView,
  pendingLessonPlansCount = 0,
  onLogout,
  isOpen,
  onClose,
  logo,
}) => {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 z-20 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        aria-hidden={!isOpen}
        tabIndex={-1}
      />
      <div
        className={`h-screen min-h-[100dvh] w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 shadow-xl z-30 transform transition-transform md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          {logo ? (
            <img src={logo} alt="School Logo" className="w-10 h-10 object-contain bg-white rounded-lg p-1" />
          ) : (
            <div className="bg-indigo-600 p-2 rounded-lg">
              <GraduationCap size={24} className="text-white" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg tracking-tight">EduSaaS</h1>
            <p className="text-xs text-slate-400">School Management</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onChangeView(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${currentView === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === ViewState.LESSON_PLANS && pendingLessonPlansCount > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {pendingLessonPlansCount}
                </span>
              )}
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
    </>
  );
};
