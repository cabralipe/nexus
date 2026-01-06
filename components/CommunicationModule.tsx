import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, Bell, Plus, Search, User, Send as SendIcon, X } from 'lucide-react';
import { generateInsight } from '../services/geminiService';
import { backend } from '../services/backendService';

type Tab = 'notices' | 'chat';

const CommunicationModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('notices');
    const [isWriting, setIsWriting] = useState(false);
    const [topic, setTopic] = useState('');
    const [generatedNotice, setGeneratedNotice] = useState('');
    const [notices, setNotices] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    // Chat State
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [chatMessage, setChatMessage] = useState('');
    const [messages, setMessages] = useState<{ sender: string, text: string, time: string }[]>([]);

    const [isCreatingNotice, setIsCreatingNotice] = useState(false);
    const [newNoticeTitle, setNewNoticeTitle] = useState('');
    const [newNoticeContent, setNewNoticeContent] = useState('');
    const [newNoticeType, setNewNoticeType] = useState('General');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [me, noticesData, studentsData, conversationsData] = await Promise.all([
                    backend.fetchMe(),
                    backend.fetchNotices(),
                    backend.fetchStudents(),
                    backend.fetchConversations(),
                ]);
                const role = String(me.role || '').toLowerCase();
                setCurrentUserRole(role || null);
                const filteredNotices = role === 'student'
                    ? noticesData.filter((notice: any) => String(notice.author_role || '').toLowerCase() === 'teacher')
                    : noticesData;
                setNotices(filteredNotices);
                setStudents(
                    studentsData.map((student: any) => ({
                        id: String(student.id),
                        name: [student.first_name, student.last_name].filter(Boolean).join(' ') || student.name,
                        grade: student.grade || '',
                    }))
                );
                setConversations(conversationsData);
            } catch (error) {
                console.error("Failed to load communication data", error);
            }
        };

        loadData();
    }, []);

    const handleDraftNotice = async () => {
        setIsWriting(true);
        const prompt = `Escreva um comunicado escolar formal sobre "${topic}". Inclua uma saudação educada, os detalhes principais e um encerramento. Formate como Markdown.`;
        const result = await generateInsight(prompt);
        setGeneratedNotice(result);
        setIsWriting(false);
    };

    const handleUseGeneratedNotice = () => {
        if (!generatedNotice) return;
        setNewNoticeTitle(topic || 'Comunicado');
        setNewNoticeContent(generatedNotice);
        setIsCreatingNotice(true);
    };

    const handleSendMessage = async () => {
        if (!selectedContactId || !selectedConversationId || !chatMessage) return;
        try {
            const created = await backend.sendMessage(selectedConversationId, {
                text: chatMessage,
                sender_type: 'school',
            });
            const newMessage = {
                sender: 'school',
                text: created.text,
                time: new Date(created.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages(prev => [...prev, newMessage]);
            setChatMessage('');
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    const handleSelectContact = async (studentId: string) => {
        setSelectedContactId(studentId);
        try {
            const existing = conversations.find((conv) => String(conv.student_id) === String(studentId));
            const conversation = existing || await backend.createConversation({ student_id: studentId });
            if (!existing) {
                setConversations((prev) => [...prev, conversation]);
            }
            setSelectedConversationId(String(conversation.id));
            const messagesData = await backend.fetchMessages(String(conversation.id));
            setMessages(
                messagesData.map((msg: any) => ({
                    sender: msg.sender_type,
                    text: msg.text,
                    time: new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }))
            );
        } catch (error) {
            console.error("Failed to load conversation", error);
        }
    };

    const handleSaveManualNotice = async () => {
        if (!newNoticeTitle || !newNoticeContent) return;
        try {
            const created = await backend.createNotice({
                title: newNoticeTitle,
                content: newNoticeContent,
                type: newNoticeType.toLowerCase(),
            });
            setNotices((prev) => [{ ...created, id: String(created.id) }, ...prev]);
            setIsCreatingNotice(false);
            setNewNoticeTitle('');
            setNewNoticeContent('');
            setNewNoticeType('General');
        } catch (error) {
            console.error("Failed to create notice", error);
        }
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
                        {currentUserRole !== 'student' && (
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setIsCreatingNotice(true)}
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    <Plus size={18} /> Novo Comunicado
                                </button>
                            </div>
                        )}
                        {notices.map((notice) => {
                            const normalizedType = String(notice.type || '').toLowerCase();
                            const label = normalizedType === 'urgent' ? 'Urgent' : normalizedType === 'academic' ? 'Academic' : 'General';
                            return (
                                <div key={notice.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex gap-4">
                                    <div className={`mt-1 p-3 rounded-full h-fit ${label === 'Urgent' ? 'bg-rose-100 text-rose-600' :
                                        label === 'Academic' ? 'bg-blue-100 text-blue-600' :
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
                                            <span className={`text-xs px-2 py-1 rounded font-medium border ${label === 'Urgent' ? 'border-rose-200 text-rose-700' :
                                                label === 'Academic' ? 'border-blue-200 text-blue-700' :
                                                    'border-slate-200 text-slate-700'
                                                }`}>
                                                {label}
                                            </span>
                                        </div>
                                        <div className="text-slate-600 text-sm leading-relaxed markdown-content">
                                            <ReactMarkdown
                                                components={{
                                                    strong: ({ node, ...props }) => <span className="font-bold text-slate-800" {...props} />,
                                                    h1: ({ node, ...props }) => <h3 className="text-base font-bold mb-2 text-slate-800" {...props} />,
                                                    h2: ({ node, ...props }) => <h4 className="text-sm font-bold mb-2 text-slate-800" {...props} />,
                                                    h3: ({ node, ...props }) => <h5 className="text-sm font-bold mb-1 text-slate-800" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 mb-2" {...props} />,
                                                    li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                    table: ({ node, ...props }) => <div className="overflow-x-auto mb-2"><table className="min-w-full text-left text-xs" {...props} /></div>,
                                                    th: ({ node, ...props }) => <th className="font-bold p-2 border-b border-slate-200 bg-slate-50" {...props} />,
                                                    td: ({ node, ...props }) => <td className="p-2 border-b border-slate-100" {...props} />,
                                                }}
                                            >
                                                {notice.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* AI Composer */}
                    {currentUserRole !== 'student' && (
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
                                        <ReactMarkdown
                                            components={{
                                                strong: ({ node, ...props }) => <span className="font-bold text-slate-800" {...props} />,
                                                h1: ({ node, ...props }) => <h3 className="text-sm font-bold mb-2 text-slate-800" {...props} />,
                                                h2: ({ node, ...props }) => <h4 className="text-xs font-bold mb-2 text-slate-800" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 mb-2" {...props} />,
                                                li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            }}
                                        >
                                            {generatedNotice}
                                        </ReactMarkdown>
                                    </div>
                                    <button
                                        onClick={handleUseGeneratedNotice}
                                        className="w-full mt-2 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700"
                                    >
                                        Usar este texto
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
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
                            {students.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => handleSelectContact(student.id)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center gap-3 transition-colors ${selectedContactId === student.id ? 'bg-indigo-50' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                        {student.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-semibold text-sm text-slate-800 truncate">{student.name}</h4>
                                            <span className="text-[10px] text-slate-400">10:05</span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">Responsável: Pai/Mãe</p>
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
                                            {students.find(s => s.id === selectedContactId)?.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm">{students.find(s => s.id === selectedContactId)?.name}</h3>
                                            <span className="text-xs text-slate-500 flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Online</span>
                                        </div>
                                    </div>
                                    <button className="text-slate-400 hover:text-indigo-600"><User size={20} /></button>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.sender === 'school' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-xl text-sm ${msg.sender === 'school' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                                                <p>{msg.text}</p>
                                                <span className={`text-[10px] block text-right mt-1 ${msg.sender === 'school' ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {!messages.length && (
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
            {isCreatingNotice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Novo Comunicado</h3>
                            <button onClick={() => setIsCreatingNotice(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                                <input 
                                    type="text" 
                                    value={newNoticeTitle}
                                    onChange={e => setNewNoticeTitle(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: Reunião de Pais"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                <div className="flex gap-2">
                                    {['General', 'Urgent', 'Academic'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setNewNoticeType(type as any)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                newNoticeType === type 
                                                ? type === 'Urgent' ? 'bg-rose-100 text-rose-700 border-rose-200'
                                                : type === 'Academic' ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                : 'bg-slate-100 text-slate-700 border-slate-200'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {type === 'Urgent' ? 'Urgente' : type === 'Academic' ? 'Acadêmico' : 'Geral'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo</label>
                                <textarea 
                                    value={newNoticeContent}
                                    onChange={e => setNewNoticeContent(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                                    placeholder="Digite o conteúdo do comunicado..."
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                            <button 
                                onClick={() => setIsCreatingNotice(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveManualNotice}
                                disabled={!newNoticeTitle || !newNoticeContent}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Publicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunicationModule;
