"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConstellationBackground from "../../components/ConstellationBackground";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // The backend is on Cloud Run. For now, we point to the public URL.
  const BACKEND_URL = "https://analytica-backend-419965139801.us-central1.run.app";

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    const token = localStorage.getItem("analytica_token");
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Create FormData for the OAuth2 login
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const response = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Email o contraseña incorrectos");
        }
        throw new Error("Error de conexión con el servidor");
      }

      const data = await response.json();
      
      // Store token
      localStorage.setItem("analytica_token", data.access_token);
      
      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError("Error de red: No se pudo conectar con el servidor de Analytica");
      } else {
        setError(err.message || "Ocurrió un error inesperado");
      }
    } finally {
      setIsLoading(false);
    }
  };

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
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] p-2 rounded uppercase tracking-wider text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold px-1 text-left">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maikol.salas.m@gmail.com"
              required
              className="bg-transparent border-b border-white/10 py-2 px-1 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500 transition-colors duration-300"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold px-1 text-left">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-transparent border-b border-white/10 py-2 px-1 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500 transition-colors duration-300"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`mt-4 py-3 px-6 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? "Cargando..." : "ENTRAR AL TERMINAL"}
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
