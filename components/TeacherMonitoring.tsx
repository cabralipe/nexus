import React, { useEffect, useState } from 'react';
import { Activity, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { backend } from '../services/backendService';

type TeacherActivity = {
    id: string;
    name: string;
    subject: string;
    lastLogin: string | null;
    lastDiaryUpdate: string | null;
    lastAttendanceUpdate: string | null;
    status: 'Active' | 'Warning' | 'Idle';
};

const TeacherMonitoring: React.FC = () => {
    const [activities, setActivities] = useState<TeacherActivity[]>([]);
    const [summary, setSummary] = useState({ active: 0, warning: 0, idle: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const loadActivities = async () => {
            setLoading(true);
            setErrorMessage('');
            try {
                const response = await backend.fetchTeacherActivities();
                setActivities(response.data || []);
                setSummary(response.summary || { active: 0, warning: 0, idle: 0, total: 0 });
            } catch (error) {
                console.error('Failed to load teacher activities', error);
                setErrorMessage('Nao foi possivel carregar o monitoramento.');
            } finally {
                setLoading(false);
            }
        };

        loadActivities();
    }, []);

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
                            {summary.active} Professores
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
                             {summary.warning} Professores
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
                             {summary.idle} Professores
                        </h3>
                    </div>
                </div>
            </div>

            {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                    {errorMessage}
                </div>
            )}

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
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                    Carregando atividades...
                                </td>
                            </tr>
                        ) : activities.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                    Nenhuma atividade encontrada.
                                </td>
                            </tr>
                        ) : (
                            activities.map((teacher) => (
                                <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-800">{teacher.name}</div>
                                        <div className="text-xs text-slate-500">{teacher.subject}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400" />
                                        {teacher.lastLogin ? new Date(teacher.lastLogin).toLocaleString('pt-BR') : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-slate-700 font-medium">
                                                {teacher.lastDiaryUpdate ? new Date(teacher.lastDiaryUpdate).toLocaleDateString('pt-BR') : '—'}
                                            </span>
                                            {teacher.lastDiaryUpdate ? (
                                                new Date(teacher.lastDiaryUpdate) < new Date(new Date().setDate(new Date().getDate() - 7)) ? (
                                                    <span className="text-xs text-rose-500 font-bold">Atrasado</span>
                                                ) : (
                                                    <span className="text-xs text-emerald-600">Em dia</span>
                                                )
                                            ) : (
                                                <span className="text-xs text-slate-400">Sem registro</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-slate-700 font-medium">
                                                {teacher.lastAttendanceUpdate ? new Date(teacher.lastAttendanceUpdate).toLocaleDateString('pt-BR') : '—'}
                                            </span>
                                            {teacher.lastAttendanceUpdate ? (
                                                new Date(teacher.lastAttendanceUpdate) < new Date(new Date().setDate(new Date().getDate() - 7)) ? (
                                                    <span className="text-xs text-rose-500 font-bold">Atrasado</span>
                                                ) : (
                                                    <span className="text-xs text-emerald-600">Em dia</span>
                                                )
                                            ) : (
                                                <span className="text-xs text-slate-400">Sem registro</span>
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TeacherMonitoring;
