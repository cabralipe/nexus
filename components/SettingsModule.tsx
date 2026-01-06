import React, { useState, useEffect } from 'react';
import { Save, Building, Shield, Activity, Lock, CreditCard, Upload } from 'lucide-react';
import { exportToCSV } from '../utils';
import { backend } from '../services/backendService';

type SettingsTab = 'institution' | 'security';


interface SettingsModuleProps {
    onLogoUpdate?: (logo: string | null) => void;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ onLogoUpdate }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('institution');
    const [saved, setSaved] = useState(false);
    const [schoolId, setSchoolId] = useState<string | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // Institution State
    const [instData, setInstData] = useState({
        name: 'Escola Exemplo SaaS',
        cnpj: '12.345.678/0001-90',
        address: 'Rua da Educação, 100',
        phone: '(11) 9999-9999',
        primaryColor: '#4F46E5',
        paymentGateway: 'Asaas',
        logo: '' as string | null
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [school, logs] = await Promise.all([
                    backend.fetchSchool(),
                    backend.fetchAuditLogs(),
                ]);
                if (school) {
                    setSchoolId(String(school.id));
                    setInstData(prev => ({
                        ...prev,
                        name: school.name || '',
                        cnpj: school.cnpj || '',
                        address: school.address_line1 || '',
                        phone: school.phone || '',
                        paymentGateway: school.payment_gateway || 'Manual',
                        primaryColor: school.primary_color || '#4F46E5',
                        logo: school.logo || null
                    }));
                }
                setAuditLogs(logs);
            } catch (error) {
                console.error("Failed to load settings", error);
            }
        };

        loadSettings();
    }, []);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity_type', 'school_logo');

        try {
            const result = await backend.uploadFile(formData);
            if (result && result.url) {
                setInstData(prev => ({ ...prev, logo: result.url }));
            }
        } catch (error) {
            console.error("Failed to upload logo", error);
            alert("Erro ao fazer upload da logo.");
        }
    };

    const handleSave = async () => {
        try {
            if (schoolId) {
                await backend.updateSchool(schoolId, {
                    name: instData.name,
                    cnpj: instData.cnpj,
                    phone: instData.phone,
                    address_line1: instData.address,
                    payment_gateway: instData.paymentGateway,
                    primary_color: instData.primaryColor,
                    logo: instData.logo
                });

                if (onLogoUpdate) {
                    onLogoUpdate(instData.logo);
                }
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error("Failed to save settings", error);
        }
    };

    const handleExportLogs = () => {
        exportToCSV(auditLogs, 'Auditoria_Logs');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Configurações do Sistema</h2>
                    <p className="text-slate-500">Painel mestre de controle da instituição.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('institution')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'institution' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Building size={16} /> Instituição
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'security' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Shield size={16} /> Auditoria & Logs
                    </button>
                </div>
            </div>

            {/* TAB: INSTITUTION */}
            {activeTab === 'institution' && (
                <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Building size={20} className="text-indigo-600" />
                                Dados da Escola (SaaS)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Fantasia da Instituição</label>
                                    <input
                                        type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={instData.name} onChange={e => setInstData({ ...instData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                    <input
                                        type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={instData.cnpj} onChange={e => setInstData({ ...instData, cnpj: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone Principal</label>
                                    <input
                                        type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={instData.phone} onChange={e => setInstData({ ...instData, phone: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Endereço Completo</label>
                                    <input
                                        type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={instData.address} onChange={e => setInstData({ ...instData, address: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <CreditCard size={20} className="text-indigo-600" />
                                Integração de Pagamento
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Gateway de Pagamento Ativo</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={instData.paymentGateway} onChange={e => setInstData({ ...instData, paymentGateway: e.target.value })}
                                    >
                                        <option value="Asaas">Asaas</option>
                                        <option value="Stripe">Stripe</option>
                                        <option value="PagarMe">Pagar.me</option>
                                        <option value="Manual">Manual (Sem integração)</option>
                                    </select>
                                </div>
                                {instData.paymentGateway !== 'Manual' && (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key (Produção)</label>
                                        <div className="flex gap-2">
                                            <input type="password" value="sk_live_******************" readOnly className="flex-1 bg-white border border-slate-300 rounded px-3 py-1 text-sm text-slate-500" />
                                            <button className="text-indigo-600 text-xs font-bold hover:underline">Alterar</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Upload size={20} className="text-indigo-600" />
                                Identidade Visual
                            </h3>
                            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleLogoUpload}
                                />
                                {instData.logo ? (
                                    <div className="w-24 h-24 mb-2 relative">
                                        <img src={instData.logo} alt="School Logo" className="w-full h-full object-contain" />
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-2">
                                        <Building size={32} className="text-indigo-300" />
                                    </div>
                                )}
                                <span className="text-sm font-medium text-slate-600">
                                    {instData.logo ? 'Alterar Logo' : 'Carregar Logo'}
                                </span>
                                <span className="text-xs text-slate-400">PNG ou JPG (Max 2MB)</span>
                            </div>
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Cor Principal</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={instData.primaryColor}
                                        onChange={(e) => setInstData({ ...instData, primaryColor: e.target.value })}
                                        className="h-10 w-10 p-1 rounded cursor-pointer border border-slate-200"
                                    />
                                    <span className="text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg font-mono">{instData.primaryColor}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 transition-colors shadow-md"
                        >
                            <Save size={18} />
                            {saved ? 'Dados Salvos!' : 'Salvar Configurações'}
                        </button>
                    </div>
                </div>
            )}

            {/* TAB: SECURITY & LOGS */}
            {activeTab === 'security' && (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Activity size={20} className="text-indigo-600" />
                                Logs de Auditoria
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExportLogs}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                                >
                                    Exportar CSV
                                </button>
                                <button className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                                    <Lock size={12} /> Configurar Acessos
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Data/Hora</th>
                                        <th className="px-6 py-3 font-medium">Usuário</th>
                                        <th className="px-6 py-3 font-medium">Ação</th>
                                        <th className="px-6 py-3 font-medium">Detalhes</th>
                                        <th className="px-6 py-3 font-medium">IP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-slate-600 font-mono text-xs">{log.created_at || log.date}</td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{log.user}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${log.action.includes('deleted') ? 'bg-rose-100 text-rose-700' :
                                                    log.action.includes('updated') ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{log.detail}</td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">{log.ip}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsModule;
