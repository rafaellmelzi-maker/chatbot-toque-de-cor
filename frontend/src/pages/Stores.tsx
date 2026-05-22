import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Store, Wifi, WifiOff, QrCode, Phone, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import clsx from 'clsx';

export default function Stores() {
  const [qrData, setQrData] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => api.get('/api/stores').then((r: any) => r.data.data),
  });

  const { data: waStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.get('/api/stores/whatsapp/status').then((r: any) => r.data.data),
    refetchInterval: 10000,
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await api.post('/api/stores/whatsapp/connect');
      const res = await api.get('/api/stores/whatsapp/qr');
      setQrData(res.data.data?.qrCode ?? null);
      refetchStatus();
      toast.success('QR Code gerado! Escaneie com o WhatsApp Business.');
    } catch {
      toast.error('Erro ao conectar WhatsApp.');
    } finally {
      setConnecting(false);
    }
  };

  const handleShowQR = async () => {
    if (qrData) { setQrData(null); return; }
    try {
      const res = await api.get('/api/stores/whatsapp/qr');
      setQrData(res.data.data?.qrCode ?? null);
      if (!res.data.data?.qrCode) toast.info('Clique em "Conectar" primeiro para gerar o QR Code.');
    } catch {
      toast.error('Instância não encontrada. Clique em "Conectar" primeiro.');
    }
  };

  const isConnected = waStatus?.connected === true;

  return (
    <div className="space-y-6">
      {/* ── Painel WhatsApp Global ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.286 7.03L.787 23.267l4.347-1.474A11.957 11.957 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.369l-.359-.214-3.722 1.262 1.275-3.641-.234-.374A9.818 9.818 0 1112 21.818z"/></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">WhatsApp – Número Único</p>
              <p className="text-xs text-gray-500">Um número para todas as lojas. O cliente escolhe a loja no chat.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx('flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', isConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
            {!isConnected && (
              <button onClick={handleConnect} disabled={connecting} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                {connecting ? <RefreshCw size={12} className="animate-spin" /> : <QrCode size={12} />}
                {connecting ? 'Aguarde...' : 'Conectar'}
              </button>
            )}
            {isConnected && (
              <button onClick={() => { setQrData(null); refetchStatus(); }} className="btn-secondary text-xs py-1.5 px-3">
                <RefreshCw size={12} />
              </button>
            )}
            {!isConnected && (
              <button onClick={handleShowQR} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <QrCode size={12} /> {qrData ? 'Fechar QR' : 'Ver QR'}
              </button>
            )}
          </div>
        </div>

        {qrData && !isConnected && (
          <div className="mt-4 flex flex-col items-center p-4 bg-white border border-gray-200 rounded-xl">
            <p className="text-xs text-gray-500 mb-3">Abra o WhatsApp Business → Dispositivos vinculados → Vincular dispositivo</p>
            <img src={qrData} alt="QR Code WhatsApp" className="w-48 h-48" />
          </div>
        )}
      </div>

      {/* ── Lista de Lojas ── */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{data?.length ?? 0} lojas cadastradas</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((store: {
            id: string; name: string; code: string; city: string; state: string;
            phone?: string; address?: string;
          }) => (
            <div key={store.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Store size={18} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-mono">{store.code}</p>
                    <p className="text-sm font-semibold text-gray-900">{store.name.replace('Toque de Cor – ', '')}</p>
                  </div>
                </div>
                <span className={clsx('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', isConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {isConnected ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>{store.city}, {store.state}</p>
                {store.phone && <p className="flex items-center gap-1"><Phone size={11} /> {store.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
