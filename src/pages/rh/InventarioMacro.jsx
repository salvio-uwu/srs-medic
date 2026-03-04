// src/pages/rh/InventarioMacro.jsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Package, AlertTriangle, MapPin, TrendingUp, Search, Activity, Box, Truck } from 'lucide-react';

const InventarioMacro = () => {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  const [metricas, setMetricas] = useState({
    totalUnidades: 0,
    valorInventario: 0,
    alertasCriticas: 0,
    distribucion: {
      "Sucursal Central": 0,
      "Sucursal Norte": 0,
      "Sucursal Sur": 0,
      "Sucursal Este": 0,
      "Almacén": 0
    }
  });

  useEffect(() => {
    const auditarInventario = async () => {
      try {
        setLoading(true);
        const snapInv = await getDocs(collection(db, "inventario"));
        
        let totalUnidades = 0;
        let valorTotal = 0;
        let criticos = 0;
        const dist = { "Sucursal Central": 0, "Sucursal Norte": 0, "Sucursal Sur": 0, "Sucursal Este": 0, "Almacén": 0 };
        const listaAgrupada = {};

        snapInv.forEach(doc => {
          const data = doc.data();
          const nombre = data.nombre || data.medicamento || 'Sin Nombre';
          const stock = parseInt(data.stock) || 0;
          const costo = parseFloat(data.costo || data.precio) || 0;
          const sucursal = data.sucursal || 'Almacén';
          const minimo = parseInt(data.stockMinimo) || 5;

          totalUnidades += stock;
          valorTotal += (stock * costo);
          
          if (stock <= minimo) criticos++;
          if (dist[sucursal] !== undefined) dist[sucursal] += stock;
          else dist['Almacén'] += stock; // Si no tiene sucursal, asumimos almacén

          // Agrupar por medicamento para la tabla Macro
          if (!listaAgrupada[nombre]) {
            listaAgrupada[nombre] = { nombre, stockGlobal: 0, costoPromedio: costo, sucursales: {} };
          }
          listaAgrupada[nombre].stockGlobal += stock;
          listaAgrupada[nombre].sucursales[sucursal] = (listaAgrupada[nombre].sucursales[sucursal] || 0) + stock;
        });

        setMetricas({ totalUnidades, valorInventario: valorTotal, alertasCriticas: criticos, distribucion: dist });
        setInventario(Object.values(listaAgrupada).sort((a, b) => b.stockGlobal - a.stockGlobal));
        
      } catch (error) {
        console.error("Error cargando macro inventario:", error);
      } finally {
        setLoading(false);
      }
    };

    auditarInventario();
  }, []);

  const mxn = (cantidad) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cantidad);

  const filtrados = inventario.filter(item => item.nombre.toLowerCase().includes(busqueda.toLowerCase()));

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
        
        .glass-card { background: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px -10px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.03); }
        .stripe-bg { background-image: repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(15,23,42,0.01) 18px, rgba(15,23,42,0.01) 19px); }
      `}</style>

      <div className="min-h-screen bg-[#f4f7f9] p-6 md:p-10 font-inter pb-20">
        
        {/* --- HEADER --- */}
        <div className="fade-up flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <h1 className="font-jakarta text-3xl font-extrabold text-[#0f172a] flex items-center gap-3 tracking-tight">
              Monitor de Almacén Central
            </h1>
            <p className="text-[13px] text-[#64748b] font-medium mt-1">
              Auditoría macro del "Corazón" logístico y distribución en 4 sucursales.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-[#cbd5e1] shadow-sm text-[12px] font-bold text-[#64748b] uppercase tracking-wider">
            <Package size={14} className="text-emerald-500" />
            Control Logístico Global
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 fade-up">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
            <p className="text-[#64748b] font-medium text-sm tracking-wide">Cuantificando inventario global...</p>
          </div>
        ) : (
          <>
            {/* --- KPIs --- */}
            <div className="fade-up delay-1 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass-card stripe-bg p-6 border-l-4 border-blue-500 flex justify-between items-center group">
                 <div>
                   <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Box size={12}/> Unidades Totales</p>
                   <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{metricas.totalUnidades.toLocaleString()}</p>
                 </div>
                 <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Box size={20}/></div>
              </div>

              <div className="glass-card stripe-bg p-6 border-l-4 border-emerald-500 flex justify-between items-center group">
                 <div>
                   <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1 flex items-center gap-1.5"><TrendingUp size={12}/> Capital Inmovilizado</p>
                   <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{mxn(metricas.valorInventario)}</p>
                 </div>
                 <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingUp size={20}/></div>
              </div>

              <div className="glass-card stripe-bg p-6 border-l-4 border-[#e11d48] flex justify-between items-center group">
                 <div>
                   <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1 flex items-center gap-1.5"><AlertTriangle size={12}/> Focos Rojos Globales</p>
                   <p className="font-jakarta text-3xl font-extrabold text-[#e11d48]">{metricas.alertasCriticas}</p>
                 </div>
                 <div className="w-12 h-12 rounded-xl bg-[#fff1f2] text-[#e11d48] flex items-center justify-center group-hover:scale-110 transition-transform"><AlertTriangle size={20}/></div>
              </div>
            </div>

            <div className="fade-up delay-2 grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* --- PANEL IZQUIERDO: DISTRIBUCIÓN SUCURSALES --- */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-card p-6 border-t-4 border-[#0f172a]">
                   <h2 className="font-jakarta font-bold text-[#0f172a] flex items-center gap-2 mb-6">
                     <MapPin size={18} className="text-blue-500" /> Distribución
                   </h2>
                   <div className="space-y-4">
                     {Object.entries(metricas.distribucion).map(([nombre, cant], idx) => {
                       // Calculamos el % de llenado para la barrita visual
                       const porcentaje = metricas.totalUnidades > 0 ? (cant / metricas.totalUnidades) * 100 : 0;
                       return (
                         <div key={idx}>
                           <div className="flex justify-between text-[12px] font-bold text-[#0f172a] mb-1">
                             <span className="flex items-center gap-1.5">
                               {nombre === 'Almacén' ? <Box size={12} className="text-amber-500"/> : <Activity size={12} className="text-[#64748b]"/>} 
                               {nombre}
                             </span>
                             <span>{cant.toLocaleString()} pzas</span>
                           </div>
                           <div className="w-full bg-[#f1f5f9] rounded-full h-1.5">
                             <div className={`h-1.5 rounded-full ${nombre === 'Almacén' ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${porcentaje}%` }}></div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                </div>

                <div className="glass-card p-6 bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white">
                   <Truck size={24} className="text-blue-400 mb-3" />
                   <h3 className="font-jakarta font-bold text-lg mb-1">Logística</h3>
                   <p className="text-[11px] text-[#94a3b8] leading-relaxed mb-4">
                     Para mover inventario del Almacén a las sucursales, utilice el módulo administrativo estándar.
                   </p>
                   <button className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[12px] font-bold transition-colors">
                     Ver Bitácora de Traspasos
                   </button>
                </div>
              </div>

              {/* --- PANEL DERECHO: TABLA MACRO DE INVENTARIO --- */}
              <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
                <div className="p-6 border-b border-[#f1f5f9] flex flex-col md:flex-row justify-between items-center gap-4">
                  <h2 className="font-jakarta text-lg font-bold text-[#0f172a]">Kardex Macro</h2>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar medicamento..." 
                      className="w-full pl-9 pr-4 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[13px] font-medium text-[#0f172a] outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[10px] uppercase tracking-widest text-[#64748b] font-bold">
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-4 py-4 text-center">Stock Global</th>
                        <th className="px-4 py-4 text-center">Desglose (Sucursales)</th>
                        <th className="px-6 py-4 text-right">Valor Aprox.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {filtrados.length === 0 ? (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-[13px] font-medium text-[#64748b]">No se encontraron productos.</td></tr>
                      ) : (
                        filtrados.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-[#0f172a] text-[14px]">{item.nombre}</p>
                              <p className="text-[11px] text-[#64748b] mt-0.5">Costo Unit: {mxn(item.costoPromedio)}</p>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-3 py-1.5 rounded-lg text-[12px] font-bold ${item.stockGlobal <= 10 ? 'bg-[#fff1f2] text-[#e11d48] border border-[#ffe4e6]' : 'bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]'}`}>
                                {item.stockGlobal} pzas
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap justify-center gap-1.5">
                                {Object.entries(item.sucursales).map(([suc, cant], i) => (
                                  <span key={i} className="text-[9px] font-bold text-[#64748b] bg-white border border-[#cbd5e1] px-2 py-0.5 rounded shadow-sm" title={suc}>
                                    {suc.replace('Sucursal', '').trim().substring(0,3).toUpperCase()}: {cant}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="font-jakarta font-bold text-[#0f172a] text-[14px]">
                                {mxn(item.stockGlobal * item.costoPromedio)}
                              </p>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default InventarioMacro;