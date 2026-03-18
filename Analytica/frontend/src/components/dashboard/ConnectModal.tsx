'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Server, User, Lock, Activity, CheckCircle2, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../../config';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SuccessData {
  client_id: string;
  client_secret: string;
  ingest_url: string;
}

const ConnectModal: React.FC<ConnectModalProps> = ({ isOpen, onClose }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    broker_server: '',
    mt5_login: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    
    try {
      const token = localStorage.getItem("analytica_token") ?? "";
      const response = await fetch(`${API_BASE}/api/v1/accounts/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          platform: 'MT5',
          currency: 'USD',
          balance_initial: 0
        }),
      });
      
      if (!response.ok) throw new Error('Error al vincular');
      
      const data = await response.json();
      setSuccessData({
        client_id: data.client_id,
        client_secret: data.client_secret,
        ingest_url: data.ingest_url
      });
    } catch (error) {
      console.error(error);
      alert('Error en la vinculación. Inténtalo de nuevo.');
    } finally {
      setIsConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Podríamos añadir un toast aquí
  };

  const handleClose = () => {
    setSuccessData(null);
    setFormData({ name: '', broker_server: '', mt5_login: '' });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative w-full ${successData ? 'max-w-xl' : 'max-w-lg'} bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 transition-all duration-500`}
          >
            {/* Header */}
            <div className="relative p-6 border-b border-white/5 bg-gradient-to-r from-amber-500/5 to-transparent">
              <button
                onClick={handleClose}
                className="absolute right-6 top-6 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  {successData ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Activity className="w-5 h-5 text-amber-500" />}
                </div>
                <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                  {successData ? 'Vínculo Generado Exitosamente' : 'Generar Vínculo MT5'}
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                {successData ? 'Copia estas credenciales en tu EA de Analytica para MT5.' : 'Configura una ingesta pasiva de datos sin compartir tus contraseñas.'}
              </p>
            </div>

            {successData ? (
              /* Success View */
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  {/* API Key (X-API-KEY Header format) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={12} className="text-green-500/50" />
                      API KEY (Combinada)
                    </label>
                    <div className="relative group">
                      <div className="w-full bg-slate-950/80 border border-green-500/20 rounded-xl px-4 py-4 text-sm font-mono text-green-400 break-all pr-12">
                        {successData.client_id}:{successData.client_secret}
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${successData.client_id}:${successData.client_secret}`)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-500 italic">Este secreto solo se muestra una vez. Guárdalo en un lugar seguro.</p>
                  </div>

                  {/* URL de Ingesta */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ExternalLink size={12} className="text-amber-500/50" />
                      URL de Ingesta
                    </label>
                    <div className="relative">
                      <div className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-xs font-mono text-slate-300 pr-12 truncate">
                        {successData.ingest_url}
                      </div>
                      <button
                        onClick={() => copyToClipboard(successData.ingest_url)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                  <p className="text-xs text-amber-500/80 leading-relaxed italic">
                    Analytica nunca te pedirá tu contraseña de inversor. El vínculo es unidireccional y de solo lectura de operaciones.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Entendido y Guardado
                </button>
              </div>
            ) : (
              /* Form View */
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <User size={12} className="text-amber-500/50" />
                      Nombre de la Cuenta
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Auditoría Principal"
                      className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-medium"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Server size={12} className="text-amber-500/50" />
                        Servidor Broker
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Ej: Darwinex-Live"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all"
                        value={formData.broker_server}
                        onChange={(e) => setFormData({...formData, broker_server: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Lock size={12} className="text-amber-500/50" />
                        ID MT5
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="12345678"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all"
                        value={formData.mt5_login}
                        onChange={(e) => setFormData({...formData, mt5_login: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <button
                  disabled={isConnecting}
                  type="submit"
                  className="w-full relative group overflow-hidden bg-gradient-to-r from-amber-600 to-amber-500 p-px rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50"
                >
                  <div className="bg-slate-950 rounded-[11px] py-4 px-6 flex items-center justify-center gap-2 transition-all duration-300 group-hover:bg-transparent">
                    {isConnecting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full"
                      />
                    ) : (
                      <span className="text-white font-bold uppercase tracking-widest text-xs">Generar Vínculo de Ingesta</span>
                    )}
                  </div>
                </button>
              </form>
            )}

            <div className="p-4 bg-slate-950/50 border-t border-white/5 text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                Protocolo de Ingesta Pasiva Analytica v0.3.0
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConnectModal;
