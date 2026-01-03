import React, { useState } from 'react';
import { GraduationCap, Lock, Mail, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

const roleOptions = [
  { value: UserRole.ADMIN, label: 'Gestor(a) / Admin' },
  { value: UserRole.TEACHER, label: 'Professor(a)' },
  { value: UserRole.STUDENT, label: 'Aluno(a)' },
];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-24 -left-16 w-80 h-80 bg-indigo-500/20 blur-3xl rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-emerald-500/10 blur-3xl rounded-full"></div>
      </div>

      <div className="relative w-full max-w-5xl grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-full px-4 py-2 text-sm text-slate-300">
            <ShieldCheck size={16} className="text-emerald-400" />
            Acesso seguro para gestão escolar
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-400/30">
                <GraduationCap size={28} className="text-indigo-300" />
              </span>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">EduSaaS Nexus</p>
                <h1 className="text-4xl md:text-5xl font-semibold text-white leading-tight">
                  Centralize sua escola em um painel inteligente.
                </h1>
              </div>
            </div>
            <p className="text-slate-300 text-lg leading-relaxed">
              Organize matrículas, acadêmico, financeiro e comunicação em um único ambiente. Faça login
              para acessar módulos personalizados para cada perfil.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <p className="text-sm text-slate-400">Indicadores</p>
              <p className="text-xl font-semibold text-white">+120 insights</p>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <p className="text-sm text-slate-400">Matrículas</p>
              <p className="text-xl font-semibold text-white">2 min por aluno</p>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <p className="text-sm text-slate-400">Comunicação</p>
              <p className="text-xl font-semibold text-white">95% engajamento</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">Acesse a plataforma</h2>
            <p className="text-sm text-slate-400">Use suas credenciais institucionais para continuar.</p>
          </div>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              onLogin(role);
            }}
          >
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Email</span>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <Mail size={18} className="text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="voce@escola.com"
                  className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Senha</span>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <Lock size={18} className="text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="Sua senha"
                  className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Perfil</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 outline-none"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value} className="text-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-slate-700 bg-slate-900" />
                Manter conectado
              </label>
              <button type="button" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 transition-colors"
            >
              Entrar no painel
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-500">
            Precisa de ajuda? Fale com a secretaria ou com o suporte interno.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
