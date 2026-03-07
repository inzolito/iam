"use client";

import ConstellationBackground from "../../components/ConstellationBackground";

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-black overflow-hidden relative">
      <ConstellationBackground />
      
      <div 
        className="glass-card w-full max-w-sm relative z-10 p-10 rounded-2xl flex flex-col gap-8 animate-fadeIn"
      >
        {/* Branding */}
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-white m-0">
            Analytica
          </h1>
          <p className="text-white/50 text-sm font-medium italic">
            "E pur si muove"
          </p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold px-1">Email</label>
            <input 
              type="email" 
              placeholder="trader@analytica.io"
              className="bg-transparent border-b border-white/10 py-2 px-1 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500 transition-colors duration-300"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold px-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              className="bg-transparent border-b border-white/10 py-2 px-1 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500 transition-colors duration-300"
            />
          </div>

          <button
            className="mt-4 py-3 px-6 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            ENTRAR AL TERMINAL
          </button>
        </form>

        <div className="flex justify-between items-center text-[10px] text-white/30 uppercase tracking-widest font-bold">
          <a href="#" className="hover:text-amber-500 transition-colors">Olvidé mi clave</a>
          <a href="#" className="hover:text-amber-500 transition-colors">Solicitar Acceso</a>
        </div>
      </div>
    </main>
  );
}
