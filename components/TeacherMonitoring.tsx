import React from 'react';
import { Activity, Clock, FileText, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { MOCK_TEACHER_ACTIVITIES } from '../constants';

const TeacherMonitoring: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Monitoramento de Professores</h2>
                    <p className="text-slate-500">Acompanhamento em tempo real de acessos, diários e frequências.</p>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Em Dia</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {MOCK_TEACHER_ACTIVITIES.filter(t => t.status === 'Active').length} Professores
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Atenção Necessária</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                             {MOCK_TEACHER_ACTIVITIES.filter(t => t.status === 'Warning').length} Professores
                        </h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                        <XCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Sem Acesso Recente</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                             {MOCK_TEACHER_ACTIVITIES.filter(t => t.status === 'Idle').length} Professores
                        </h3>
                    </div>
                </div>
            </div>

            {/* Monitoring Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Activity size={20} className="text-indigo-600" />
                        Atividade Recente da Equipe
                    </h3>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                        <tr>
                            <th className="px-6 py-3 font-medium">Professor</th>
                            <th className="px-6 py-3 font-medium">Último Login</th>
                            <th className="px-6 py-3 font-medium text-center">Diário de Classe</th>
                            <th className="px-6 py-3 font-medium text-center">Chamada</th>
                            <th className="px-6 py-3 font-medium text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {MOCK_TEACHER_ACTIVITIES.map((teacher) => (
                            <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-800">{teacher.name}</div>
                                    <div className="text-xs text-slate-500">{teacher.subject}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                                    <Clock size={14} className="text-slate-400" />
                                    {teacher.lastLogin}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="text-slate-700 font-medium">{new Date(teacher.lastDiaryUpdate).toLocaleDateString('pt-BR')}</span>
                                        {/* Simple Logic for outdated diary */}
                                        {new Date(teacher.lastDiaryUpdate) < new Date('2023-10-20') ? (
                                            <span className="text-xs text-rose-500 font-bold">Atrasado</span>
                                        ) : (
                                            <span className="text-xs text-emerald-600">Em dia</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                     <div className="flex flex-col items-center">
                                        <span className="text-slate-700 font-medium">{new Date(teacher.lastAttendanceUpdate).toLocaleDateString('pt-BR')}</span>
                                         {new Date(teacher.lastAttendanceUpdate) < new Date('2023-10-20') ? (
                                            <span className="text-xs text-rose-500 font-bold">Atrasado</span>
                                        ) : (
                                            <span className="text-xs text-emerald-600">Em dia</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        teacher.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                                        teacher.status === 'Warning' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-rose-100 text-rose-700'
                                    }`}>
                                        {teacher.status === 'Active' ? 'Ativo' : teacher.status === 'Warning' ? 'Alerta' : 'Inativo'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TeacherMonitoring;
