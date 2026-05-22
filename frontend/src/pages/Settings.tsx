import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { Save, Bot, MessageSquare, Thermometer, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

export default function Settings() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => api.get('/api/settings/ai-config').then((r: any) => r.data.data),
  });

  const [form, setForm] = useState({
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 1500,
    welcomeMessage: '',
    transferMessage: '',
    maxMessages: 50,
    autoTransferScore: 70,
  });

  useEffect(() => {
    if (data) setForm({ ...form, ...data });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/settings/ai-config', form),
    onSuccess: () => toast.success('Configurações salvas com sucesso!'),
    onError: () => toast.error('Erro ao salvar configurações.'),
  });

  if (isLoading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      {/* AI Config */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-brand-500" />
          <h2 className="font-semibold text-gray-900">Configurações da IA</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prompt do Sistema</label>
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><AlertCircle size={12} /> Modifique com cuidado. Use {'{customerContext}'}, {'{productContext}'}, {'{conversationSummary}'} como variáveis.</p>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={12}
            className="input font-mono text-xs resize-y"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Thermometer size={14} /> Temperatura ({form.temperature})
            </label>
            <input
              type="range" min={0} max={1} step={0.05}
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Preciso</span><span>Criativo</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. Tokens de Resposta</label>
            <input
              type="number" min={200} max={4096} step={100}
              value={form.maxTokens}
              onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. Mensagens por Conversa</label>
            <input
              type="number" min={10} max={200}
              value={form.maxMessages}
              onChange={(e) => setForm({ ...form, maxMessages: parseInt(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Score de Transferência Automática</label>
            <input
              type="number" min={0} max={100}
              value={form.autoTransferScore}
              onChange={(e) => setForm({ ...form, autoTransferScore: parseInt(e.target.value) })}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Score acima desse valor cria lead automaticamente.</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-brand-500" />
          <h2 className="font-semibold text-gray-900">Mensagens Automáticas</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem de Boas-vindas</label>
          <textarea
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
            rows={4}
            className="input resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem de Transferência para Humano</label>
          <textarea
            value={form.transferMessage}
            onChange={(e) => setForm({ ...form, transferMessage: e.target.value })}
            rows={4}
            className="input resize-none"
          />
        </div>
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="btn-primary flex items-center gap-2 px-6"
      >
        <Save size={16} />
        {saveMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
