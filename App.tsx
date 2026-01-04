import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import FinancialModule from './components/FinancialModule';
import AcademicModule from './components/AcademicModule';
import CommunicationModule from './components/CommunicationModule';
import SettingsModule from './components/SettingsModule';
import TeacherMonitoring from './components/TeacherMonitoring';
import AbsenceJustification from './components/AbsenceJustification';
import PedagogicalCoordination from './components/PedagogicalCoordination';
import InventoryModule from './components/InventoryModule';
import RegistrationModule from './components/RegistrationModule';
import ClassAllocationModule from './components/ClassAllocationModule';
import ScheduleModule from './components/ScheduleModule';
import LoginScreen from './components/LoginScreen';
import { UserRole, ViewState } from './types';
import { NAV_ITEMS } from './constants';
import { Bell, Menu, Search, UserCircle } from 'lucide-react';
import { backend } from './services/backendService';

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(UserRole.ADMIN);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  const roleMapping = useMemo(() => {
    return {
      admin: UserRole.ADMIN,
      director: UserRole.ADMIN,
      coordinator: UserRole.ADMIN,
      finance: UserRole.ADMIN,
      staff: UserRole.ADMIN,
      support: UserRole.ADMIN,
      teacher: UserRole.TEACHER,
      student: UserRole.STUDENT,
    } as Record<string, UserRole>;
  }, []);

  // Mock Login/Role Switch functionality for SaaS Demo
  const switchRole = (role: UserRole) => {
    setUserRole(role);
    setCurrentView(ViewState.DASHBOARD); // Reset view on role change
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    // Specialized Views based on Nav Item
    if (currentView === ViewState.FINANCIAL) {
      return <FinancialModule />;
    }
    if (currentView === ViewState.ACADEMIC) {
      return <AcademicModule />;
    }
    if (currentView === ViewState.COMMUNICATION) {
      return <CommunicationModule />;
    }
    if (currentView === ViewState.SETTINGS) {
      return <SettingsModule onLogoUpdate={setSchoolLogo} />;
    }
    if (currentView === ViewState.TEACHER_MONITORING) {
      return <TeacherMonitoring />;
    }
    if (currentView === ViewState.ABSENCE_JUSTIFICATION) {
      return <AbsenceJustification />;
    }
    if (currentView === ViewState.PEDAGOGICAL) {
      return <PedagogicalCoordination />;
    }
    if (currentView === ViewState.INVENTORY) {
      return <InventoryModule />;
    }
    if (currentView === ViewState.REGISTRATION) {
      return <RegistrationModule />;
    }
    if (currentView === ViewState.CLASS_ALLOCATION) {
      return <ClassAllocationModule />;
    }
    if (currentView === ViewState.SCHEDULE) {
      return <ScheduleModule />;
    }

    // Default Dashboard Views based on Role
    if (currentView === ViewState.DASHBOARD) {
      switch (userRole) {
        case UserRole.ADMIN:
          return <AdminDashboard />;
        case UserRole.TEACHER:
          return <TeacherDashboard authRole={authRole} />;
        case UserRole.STUDENT:
          return <StudentDashboard />;
        default:
          return <div>Unknown Role</div>;
      }
    }

    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed">
        <div className="bg-slate-50 p-6 rounded-full mb-4">
          <UserCircle size={48} className="text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700">Módulo em Desenvolvimento</h3>
        <p className="text-slate-500 max-w-md mt-2">
          A tela <strong>{currentView}</strong> para o perfil <strong>{userRole}</strong> está sendo construída.
        </p>
      </div>
    );
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) return;
      setAuthLoading(true);
      try {
        const me = await backend.fetchMe();
        const normalizedRole = roleMapping[String(me.role || '').toLowerCase()] || UserRole.ADMIN;
        setUserRole(normalizedRole);
        setAuthRole(String(me.role || '').toLowerCase() || null);
        if (me.school && me.school.logo) {
          setSchoolLogo(me.school.logo);
        }
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setAuthRole(null);
        setSchoolLogo(null);
      } finally {
        setAuthLoading(false);
      }
    };
    bootstrap();
  }, [roleMapping]);

  const allowedViews = useMemo(() => {
    return new Set(
      NAV_ITEMS.filter((item) => item.roles.includes(userRole)).map((item) => item.id),
    );
  }, [userRole]);

  useEffect(() => {
    if (!allowedViews.has(currentView)) {
      setCurrentView(ViewState.DASHBOARD);
    }
  }, [allowedViews, currentView]);

  if (!isAuthenticated) {
    return (
      <LoginScreen
        errorMessage={authError}
        isLoading={authLoading}
        onLogin={async ({ usernameOrEmail, password, roleFallback }) => {
          setAuthLoading(true);
          setAuthError('');
          try {
            const response = await backend.login(usernameOrEmail, password);
            localStorage.setItem('authToken', response.token);
            const rawRole = String(response.user?.role || '').toLowerCase();
            const normalizedRole = roleMapping[rawRole] || roleFallback;
            setUserRole(normalizedRole);
            setAuthRole(rawRole || null);
            setIsAuthenticated(true);
            setCurrentView(ViewState.DASHBOARD);
            setIsSidebarOpen(false);
          } catch (error: any) {
            setAuthError(error?.message || 'Falha no login.');
            setIsAuthenticated(false);
            setAuthRole(null);
          } finally {
            setAuthLoading(false);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <Sidebar
        role={userRole}
        currentView={currentView}
        onChangeView={setCurrentView}
        onLogout={async () => {
          try {
            await backend.logout();
          } catch (error) {
            console.error('Logout failed', error);
          }
          localStorage.removeItem('authToken');
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          setAuthError('');
          setAuthRole(null);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        logo={schoolLogo}
      />

      <div className="md:ml-64 flex-1 flex flex-col">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
              aria-label="Abrir menu"
            >
              <Menu size={20} className="text-slate-600" />
            </button>
            <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 w-72 sm:w-96">
              <Search size={18} className="text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Buscar alunos, turmas ou pagamentos..."
                className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Role Switcher for Demo */}
            <select
              value={userRole}
              onChange={(e) => switchRole(e.target.value as UserRole)}
              className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded border border-slate-700 focus:outline-none"
            >
              <option value={UserRole.ADMIN}>Ver como Admin</option>
              <option value={UserRole.TEACHER}>Ver como Professor</option>
              <option value={UserRole.STUDENT}>Ver como Aluno</option>
            </select>

            <button className="relative p-2 hover:bg-slate-100 rounded-full transition-colors">
              <Bell size={20} className="text-slate-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"></span>
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-800">Roberto Santos</p>
                <p className="text-xs text-slate-500 capitalize">{userRole.toLowerCase()}</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">
                RS
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Scrollable Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
