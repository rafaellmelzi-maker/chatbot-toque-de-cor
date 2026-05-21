import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Store, Wifi, WifiOff, QrCode, Phone } from 'lucide-react';
import { toast } from 'react-toastify';
import clsx from 'clsx';

export default function Stores() {
  const [qrStoreId, setQrStoreId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => api.get('/stores').then((r) => r.data.data),
  });

  const handleQR = async (storeId: string) => {
    if (qrStoreId === storeId) { setQrStoreId(null); setQrData(null); return; }
    try {
      const res = await api.get(`/stores/${storeId}/whatsapp/qrcode`);
      setQrStoreId(storeId);
      setQrData(res.data.data?.qrcode ?? null);
    } catch {
      toast.error('Erro ao buscar QR Code. Certifique-se de ter configurado a instância WhatsApp.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{data?.length ?? 0} lojas cadastradas</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((store: {
            id: string; name: string; code: string; city: string; state: string;
            phone?: string; address?: string; whatsappInstances?: Array<{ status: string; phoneNumber?: string }>;
          }) => {
            const instance = store.whatsappInstances?.[0];
            const isConnected = instance?.status === 'CONNECTED';
            const showQr = qrStoreId === store.id;

            return (
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
                    {isConnected ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>{store.city}, {store.state}</p>
                  {store.phone && <p className="flex items-center gap-1"><Phone size={11} /> {store.phone}</p>}
                  {instance?.phoneNumber && <p className="text-green-600 font-medium">WA: {instance.phoneNumber}</p>}
                </div>

                {showQr && qrData && (
                  <div className="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-500 mb-2">Escaneie com o WhatsApp</p>
                    <img src={qrData} alt="QR Code WhatsApp" className="w-40 h-40" />
                  </div>
                )}

                <button
                  onClick={() => handleQR(store.id)}
                  className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2"
                >
                  <QrCode size={14} />
                  {showQr ? 'Fechar QR Code' : 'Conectar WhatsApp'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
