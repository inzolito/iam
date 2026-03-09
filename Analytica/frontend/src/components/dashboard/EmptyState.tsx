"use client";

import { motion } from "framer-motion";
import { Plus, Terminal } from "lucide-react";
import React, { useState } from "react";
import ConnectModal from "./ConnectModal";

export default function EmptyState() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <ConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          duration: 0.8, 
          ease: [0.16, 1, 0.3, 1] 
        }}
        className="w-24 h-24 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center mb-10 shadow-2xl shadow-amber-500/5"
      >
        <Terminal className="w-12 h-12 text-amber-500/80" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.8, 
          delay: 0.2, 
          ease: [0.16, 1, 0.3, 1] 
        }}
        className="space-y-6"
      >
        <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Bienvenido, <span className="text-amber-500">msalas</span>. <br />
          <span className="text-white/90">Tu terminal de datos está lista.</span>
        </h2>
        
        <p className="text-slate-400 max-w-xl mx-auto text-lg md:text-xl font-medium leading-relaxed opacity-80">
          Para comenzar a revelar la verdad de tu operativa, vincula tu cuenta de MetaTrader 5.
        </p>

        <div className="pt-10">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group relative px-10 py-5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl font-bold text-slate-950 flex items-center gap-4 mx-auto transition-all duration-500 hover:shadow-[0_0_50px_rgba(245,158,11,0.4)] hover:-translate-y-1 active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            <Plus className="w-6 h-6 relative z-10" />
            <span className="text-lg relative z-10 uppercase tracking-wider">+ Vincular Cuenta MT5</span>
          </button>
        </div>
      </motion.div>

      {/* Decorative background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      </div>
    </>
  );
}
