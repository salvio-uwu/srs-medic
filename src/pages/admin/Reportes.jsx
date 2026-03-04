// src/pages/admin/Reportes.jsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { TrendingUp, DollarSign, Users, Activity, Calendar as CalIcon, Award } from 'lucide-react';

const Reportes = () => {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    ingresosTotales: 0,
    citasTotales: 0,
    ticketPromedio: 0,
  });
  const [tendencia, setTendencia] = useState([]);
  const [topMedicos, setTopMedicos] = useState([]);

  useEffect(() => {
    const auditarDatos = async () => {
      try {
        setLoading(true);
        // Traemos TODAS las consultas para el reporte macro
        const qConsultas = query(collection(db, "consultas"));
        const snapConsultas = await getDocs(qConsultas);
        
        let dinero = 0;
        let citas = 0;
        const mapaFechas = {};
        const mapaDoctores = {};

        snapConsultas.forEach(doc => {
          const data = doc.data();
          citas++;
          
          // Limpieza del costo (evitar NaN)
          const costo = parseFloat(data.costo) || 0;
          dinero += costo;

          // Agrupar por fecha para la gráfica
          const fecha = data.fechaBusqueda || data.fecha || new Date().toLocaleDateString('en-CA');
          if (!mapaFechas[fecha]) mapaFechas[fecha] = { fecha, totalCitas: 0, ingresos: 0 };
          mapaFechas[fecha].totalCitas += 1;
          mapaFechas[fecha].ingresos += costo;

          // Agrupar por Doctor para el Ranking
          const doctorId = data.doctorId || 'Desconocido';
          const doctorNombre = data.doctorNombre || doctorId;
          if (!mapaDoctores[doctorId]) mapaDoctores[doctorId] = { nombre: doctorNombre, ingresos: 0, citas: 0 };
          mapaDoctores[doctorId].ingresos += costo;
          mapaDoctores[doctorId].citas += 1;
        });

        // Formatear Tendencia (Gráfica de los últimos 7 días)
        const tendenciaArray = Object.values(mapaFechas)
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
          .slice(-7); // Tomar solo los últimos 7 días con datos

        // Formatear Top Médicos
        const doctoresArray = Object.values(mapaDoctores)
          .sort((a, b) => b.ingresos - a.ingresos)
          .slice(0, 5); // Top 5

        setMetricas({
          ingresosTotales: dinero,
          citasTotales: citas,
          ticketPromedio: citas > 0 ? (dinero / citas) : 0
        });
        setTendencia(tendenciaArray);
        setTopMedicos(doctoresArray);

      } catch (error) {
        console.error("Error al auditar base de datos:", error);
      } finally {
        setLoading(false);
      }
    };

    auditarDatos();
  }, []);

  // Formateador de moneda
  const mxn = (cantidad) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cantidad);

  // Calcular el valor máximo para escalar la gráfica
  const maxConsultas = Math.max(...tendencia.map(t => t.totalCitas), 1);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        
        .font-jakarta { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .font-inter { font-family: 'Inter', system-ui, sans-serif; }
        
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        
        .glass-card {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 10px 30px -10px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.03);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .glass-card:hover {
          box-shadow: 0 20px 40px -10px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.05);
        }

        .stripe-bg {
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(15,23,42,0.01) 18px, rgba(15,23,42,0.01) 19px);
        }

        /* Chart Bar Animation */
        .bar-grow { animation: barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; transform-origin: bottom; scale: 1 0; }
        @keyframes barGrow { to { scale: 1 1; } }
      `}</style>

      <div className="min-h-screen bg-[#f4f7f9] p-6 md:p-10 font-inter">
        
        {/* HEADER DIRECTIVO */}
        <div className="fade-up flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="font-jakarta text-3xl font-extrabold text-[#0f172a] flex items-center gap-3">
              Inteligencia de Negocios
            </h1>
            <p className="text-[13px] text-[#64748b] font-medium mt-1">
              Auditoría financiera y rendimiento operativo en tiempo real.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-[#cbd5e1] shadow-sm text-[12px] font-bold text-[#64748b] uppercase tracking-wider">
            <Activity size={14} className="text-blue-500" />
            Sincronizado con Base de Datos
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 fade-up">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-[#64748b] font-medium text-sm tracking-wide animate-pulse">Procesando volúmenes de datos...</p>
          </div>
        ) : (
          <>
            {/* KPIs PRINCIPALES (MACROS) */}
            <div className="fade-up delay-1 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              
              <div className="glass-card stripe-bg p-6 relative overflow-hidden flex items-center justify-between group border-l-4 border-emerald-500">
                <div>
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1 flex items-center gap-1.5"><DollarSign size={12}/> Ingresos Brutos</p>
                  <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{mxn(metricas.ingresosTotales)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="glass-card stripe-bg p-6 relative overflow-hidden flex items-center justify-between group border-l-4 border-blue-500">
                <div>
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Users size={12}/> Consultas Totales</p>
                  <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{metricas.citasTotales}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity size={20} />
                </div>
              </div>

              <div className="glass-card stripe-bg p-6 relative overflow-hidden flex items-center justify-between group border-l-4 border-purple-500">
                <div>
                  <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Activity size={12}/> Ticket Promedio</p>
                  <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{mxn(metricas.ticketPromedio)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <DollarSign size={20} />
                </div>
              </div>

            </div>

            <div className="fade-up delay-2 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* GRÁFICA DE TENDENCIA (CSS PURO, UI PREMIUM) */}
              <div className="lg:col-span-2 glass-card p-8">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-jakarta text-lg font-bold text-[#0f172a]">Tendencia Operativa</h2>
                    <p className="text-[12px] text-[#64748b] mt-1">Volumen de pacientes en los últimos 7 días activos.</p>
                  </div>
                  <CalIcon size={20} className="text-[#94a3b8]" />
                </div>
                
                {tendencia.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No hay suficientes datos registrados.</div>
                ) : (
                  <div className="flex items-end justify-between h-56 gap-2 pt-4">
                    {tendencia.map((dia, idx) => {
                      const altura = `${(dia.totalCitas / maxConsultas) * 100}%`;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-3 group w-full relative">
                          {/* Tooltip Hover */}
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f172a] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-lg whitespace-nowrap pointer-events-none z-10">
                            {dia.totalCitas} citas / {mxn(dia.ingresos)}
                          </div>
                          {/* Barra */}
                          <div className="w-full max-w-[40px] bg-slate-100 rounded-t-md h-full relative flex items-end justify-center">
                            <div 
                              className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md bar-grow transition-all group-hover:from-blue-500 group-hover:to-blue-300 shadow-[0_0_15px_rgba(37,99,235,0.2)]" 
                              style={{ height: altura, animationDelay: `${idx * 0.1}s` }}
                            ></div>
                          </div>
                          {/* Etiqueta */}
                          <span className="text-[10px] font-bold text-[#64748b] uppercase">
                            {dia.fecha.split('-').slice(1).reverse().join('/')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RANKING DE MÉDICOS (TOP PERFORMERS) */}
              <div className="glass-card overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-[#f8fafc]">
                  <h2 className="font-jakarta text-lg font-bold text-[#0f172a] flex items-center gap-2">
                    <Award size={18} className="text-amber-500" />
                    Top Rendimiento
                  </h2>
                  <p className="text-[12px] text-[#64748b] mt-1">Médicos con mayor facturación global.</p>
                </div>
                
                <div className="p-2 flex-1">
                  {topMedicos.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">Sin registros.</div>
                  ) : (
                    topMedicos.map((medico, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-[#0f172a] text-[13px]">{medico.nombre}</p>
                            <p className="text-[11px] text-[#64748b] mt-0.5">{medico.citas} pacientes atendidos</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-jakarta font-bold text-emerald-600 text-[14px]">{mxn(medico.ingresos)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </>
  );
};

export default Reportes;