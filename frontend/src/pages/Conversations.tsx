import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '../api/conversations';
import { Link } from 'react-router-dom';
import { MessageSquare, Clock, User, Bot, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';

const STATUS_CONFIG = {
  BOT:      { label: 'Bot', className: 'badge-bot', icon: Bot },
  WAITING:  { label: 'Aguardando', className: 'badge-waiting', icon: Clock },
  HUMAN:    { label: 'Humano', className: 'badge-human', icon: User },
  RESOLVED: { label: 'Resolvida', className: 'badge-resolved', icon: MessageSquare },
  ABANDONED:{ label: 'Abandonada', className: 'badge-resolved', icon: MessageSquare },
};

const FILTERS = ['Todas', 'BOT', 'WAITING', 'HUMAN', 'RESOLVED'];

export default function Conversations() {
  const [filter, setFilter] = useState('Todas');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['conversations', filter, page],
    queryFn: () =>
      conversationsApi
        .list({ page, limit: 20, ...(filter !== 'Todas' && { status: filter }) })
        .then((r) => r.data),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === f ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data?.data?.length === 0 && (
              <p className="text-center text-gray-400 py-12">Nenhuma conversa encontrada.</p>
            )}
            {data?.data?.map((conv: {
              id: string; status: keyof typeof STATUS_CONFIG; customer?: { name?: string; phone: string };
              store?: { name: string; code: string }; createdAt: string; updatedAt: string;
              messages?: Array<{ content: string }>; _count?: { messages: number };
              qualificationScore?: number;
            }) => {
              const cfg = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.BOT;
              const StatusIcon = cfg.icon;
              const lastMsg = conv.messages?.[0]?.content ?? '';

              return (
                <Link
                  key={conv.id}
                  to={`/conversations/${conv.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold flex-shrink-0">
                    {conv.customer?.name?.charAt(0)?.toUpperCase() ?? '#'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {conv.customer?.name ?? conv.customer?.phone ?? 'Cliente anônimo'}
                      </p>
                      <span className={cfg.className}>
                        <StatusIcon size={10} className="mr-1" />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{lastMsg}</p>
                  </div>

                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-xs text-gray-400">
                      {format(new Date(conv.updatedAt), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                    {conv.qualificationScore != null && (
                      <p className="text-xs font-semibold text-brand-600 mt-1">
                        Score: {conv.qualificationScore}
                      </p>
                    )}
                    <p className="text-xs text-gray-300">{conv.store?.code}</p>
                  </div>

                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-400">
              {data.total} conversas · Página {data.page} de {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs px-3 py-1">← Anterior</button>
              <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="btn-secondary text-xs px-3 py-1">Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
