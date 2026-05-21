import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../api/conversations';
import { ArrowLeft, Send, UserCheck, CheckCircle, Bot, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import clsx from 'clsx';

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationsApi.getById(id!).then((r) => r.data.data),
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => conversationsApi.sendMessage(id!, msg),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversation', id] }); setMessage(''); },
    onError: () => toast.error('Erro ao enviar mensagem.'),
  });

  const transferMutation = useMutation({
    mutationFn: () => conversationsApi.transferToHuman(id!),
    onSuccess: () => { toast.success('Conversa assumida!'); qc.invalidateQueries({ queryKey: ['conversation', id] }); },
  });

  const resolveMutation = useMutation({
    mutationFn: () => conversationsApi.resolve(id!),
    onSuccess: () => { toast.success('Conversa resolvida!'); navigate('/conversations'); },
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data?.messages]);

  if (isLoading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>;

  const conv = data;
  if (!conv) return null;

  return (
    <div className="h-full flex flex-col max-h-[calc(100vh-9rem)]">
      {/* Header */}
      <div className="card p-4 flex items-center gap-3 mb-4 flex-shrink-0">
        <button onClick={() => navigate('/conversations')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">
          {conv.customer?.name?.charAt(0)?.toUpperCase() ?? '#'}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{conv.customer?.name ?? conv.customer?.phone ?? 'Cliente anônimo'}</p>
          <p className="text-xs text-gray-400">{conv.channel} · {conv.store?.name} · Score: {conv.qualificationScore ?? '—'}</p>
        </div>
        <div className="flex gap-2">
          {conv.status !== 'HUMAN' && conv.status !== 'RESOLVED' && (
            <button onClick={() => transferMutation.mutate()} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
              <UserCheck size={14} /> Assumir
            </button>
          )}
          {conv.status !== 'RESOLVED' && (
            <button onClick={() => resolveMutation.mutate()} className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
              <CheckCircle size={14} /> Resolver
            </button>
          )}
        </div>
      </div>

      {/* Summary (se disponível) */}
      {conv.summary && (
        <div className="card p-4 mb-4 bg-yellow-50 border-yellow-200 flex-shrink-0">
          <p className="text-xs font-semibold text-yellow-700 mb-1">📋 Resumo do Atendimento (IA)</p>
          <p className="text-sm text-yellow-800 whitespace-pre-wrap">{(() => { try { const s = JSON.parse(conv.summary); return s.project ?? conv.summary; } catch { return conv.summary; } })()}</p>
        </div>
      )}

      {/* Messages */}
      <div className="card flex-1 overflow-y-auto p-4 space-y-3">
        {conv.messages?.map((msg: { id: string; role: string; content: string; isFromBot: boolean; createdAt: string }) => (
          <div key={msg.id} className={clsx('flex gap-2', msg.role === 'USER' ? 'justify-start' : 'justify-end')}>
            {msg.role === 'USER' && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-gray-500" />
              </div>
            )}
            <div className={clsx(
              'max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
              msg.role === 'USER'
                ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                : msg.isFromBot
                  ? 'bg-brand-500 text-white rounded-tr-sm'
                  : 'bg-gray-800 text-white rounded-tr-sm',
            )}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <p className={clsx('text-xs mt-1', msg.role === 'USER' ? 'text-gray-400' : 'text-white/70')}>
                {format(new Date(msg.createdAt), 'HH:mm', { locale: ptBR })}
                {msg.isFromBot && <Bot size={10} className="inline ml-1" />}
              </p>
            </div>
            {msg.role !== 'USER' && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-brand-100">
                {msg.isFromBot ? <Bot size={14} className="text-brand-600" /> : <User size={14} className="text-gray-600" />}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {conv.status === 'HUMAN' && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (message.trim()) sendMutation.mutate(message.trim()); }}
          className="flex gap-2 mt-4 flex-shrink-0"
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="input flex-1"
            disabled={sendMutation.isPending}
          />
          <button type="submit" disabled={!message.trim() || sendMutation.isPending} className="btn-primary px-4">
            <Send size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
