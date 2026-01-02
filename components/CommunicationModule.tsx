import React, { useState } from 'react';
import { MessageCircle, Bell, Plus, Search, User, Send as SendIcon } from 'lucide-react';
import { MOCK_NOTICES, MOCK_STUDENTS } from '../constants';
import { generateInsight } from '../services/geminiService';

type Tab = 'notices' | 'chat';

const CommunicationModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('notices');
    const [isWriting, setIsWriting] = useState(false);
    const [topic, setTopic] = useState('');
    const [generatedNotice, setGeneratedNotice] = useState('');

    // Chat State
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [chatMessage, setChatMessage] = useState('');
    const [chats, setChats] = useState<Record<string, { sender: string, text: string, time: string }[]>>({
        '1': [{ sender: 'school', text: 'Olá, mãe da Alice. Tudo bem?', time: '10:00' }, { sender: 'parent', text: 'Tudo ótimo! Recebi o boleto.', time: '10:05' }],
        '2': [{ sender: 'school', text: 'Sr. Bruno precisa trazer o documento pendente.', time: '09:00' }]
    });

    const handleDraftNotice = async () => {
        setIsWriting(true);
        const prompt = `Write a formal school announcement about "${topic}". Include a polite greeting, the main details, and a closing. Format as Markdown.`;
        const result = await generateInsight(prompt);
        setGeneratedNotice(result);
        setIsWriting(false);
    };

    const handleSendMessage = () => {
        if (!selectedContactId || !chatMessage) return;
        const currentChat = chats[selectedContactId] || [];
        const newMessage = { sender: 'school', text: chatMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setChats({ ...chats, [selectedContactId]: [...currentChat, newMessage] });
        setChatMessage('');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Comunicação</h2>
                    <p className="text-slate-500">Mural de avisos e chat direto com responsáveis.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('notices')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'notices' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Bell size={16} /> Mural de Avisos
                    </button>
                    <button 
                        onClick={() => setActiveTab('chat')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <MessageCircle size={16} /> Chat Direto
                    </button>
                </div>
            </div>

            {activeTab === 'notices' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    {/* Notices Feed */}
                    <div className="lg:col-span-2 space-y-4">
                         <div className="flex justify-end">
                            <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                                <Plus size={18} /> Novo Comunicado
                            </button>
                         </div>
                        {MOCK_NOTICES.map((notice) => (
                            <div key={notice.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex gap-4">
                                <div className={`mt-1 p-3 rounded-full h-fit ${
                                    notice.type === 'Urgent' ? 'bg-rose-100 text-rose-600' :
                                    notice.type === 'Academic' ? 'bg-blue-100 text-blue-600' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    <Bell size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg">{notice.title}</h3>
                                            <span className="text-xs text-slate-400">
                                                Enviado por {notice.author} • {new Date(notice.date).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded font-medium border ${
                                             notice.type === 'Urgent' ? 'border-rose-200 text-rose-700' :
                                             notice.type === 'Academic' ? 'border-blue-200 text-blue-700' :
                                             'border-slate-200 text-slate-700'
                                        }`}>
                                            {notice.type}
                                        </span>
                                    </div>
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        {notice.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* AI Composer */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <MessageCircle size={20} className="text-indigo-600" />
                            Assistente de Redação
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Use a IA para redigir comunicados claros e profissionais para pais e alunos.
                        </p>
                        
                        <div className="space-y-3">
                            <input 
                                type="text" 
                                placeholder="Sobre o que é o comunicado?" 
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                            <button 
                                onClick={handleDraftNotice}
                                disabled={isWriting || !topic}
                                className="w-full bg-indigo-50 text-indigo-700 font-medium py-2 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                            >
                                {isWriting ? 'Escrevendo...' : 'Gerar Rascunho'}
                            </button>
                        </div>

                        {generatedNotice && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Sugestão da IA</div>
                                <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-700 h-64 overflow-y-auto markdown-content border border-slate-200">
                                    <div dangerouslySetInnerHTML={{__html: generatedNotice.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}} />
                                </div>
                                <button className="w-full mt-2 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700">
                                    Usar este texto
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)] animate-fade-in bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    {/* Contacts List */}
                    <div className="col-span-4 border-r border-slate-100 flex flex-col">
                        <div className="p-4 border-b border-slate-100">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Buscar aluno..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {MOCK_STUDENTS.map(student => (
                                <button 
                                    key={student.id}
                                    onClick={() => setSelectedContactId(student.id)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center gap-3 transition-colors ${selectedContactId === student.id ? 'bg-indigo-50' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                        {student.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-semibold text-sm text-slate-800 truncate">{student.name}</h4>
                                            <span className="text-[10px] text-slate-400">10:05</span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">Responsável: {student.name === 'Alice Ferreira' ? 'Maria' : 'Pai/Mãe'}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="col-span-8 flex flex-col bg-slate-50/50">
                        {selectedContactId ? (
                            <>
                                <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                            {MOCK_STUDENTS.find(s => s.id === selectedContactId)?.name.substring(0,2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm">{MOCK_STUDENTS.find(s => s.id === selectedContactId)?.name}</h3>
                                            <span className="text-xs text-slate-500 flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Online</span>
                                        </div>
                                    </div>
                                    <button className="text-slate-400 hover:text-indigo-600"><User size={20} /></button>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                    {chats[selectedContactId]?.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.sender === 'school' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-xl text-sm ${msg.sender === 'school' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                                                <p>{msg.text}</p>
                                                <span className={`text-[10px] block text-right mt-1 ${msg.sender === 'school' ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {!chats[selectedContactId] && (
                                        <div className="text-center text-slate-400 text-sm mt-10">Nenhuma mensagem anterior.</div>
                                    )}
                                </div>
                                <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                                    <input 
                                        type="text" 
                                        className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Digite sua mensagem..."
                                        value={chatMessage}
                                        onChange={(e) => setChatMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                    <button 
                                        onClick={handleSendMessage}
                                        className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        <SendIcon size={20} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                <MessageCircle size={48} className="mb-4 text-slate-300" />
                                <p>Selecione uma conversa para iniciar.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunicationModule;