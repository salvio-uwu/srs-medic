// src/pages/rh/FinanzasRH.jsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  DollarSign, TrendingUp, Wallet, Building, 
  CreditCard, PieChart, ArrowRight, ShieldCheck 
} from 'lucide-react';

const FinanzasRH = () => {
  const [loading, setLoading] = useState(true);
  const [finanzas, setFinanzas] = useState({
    ingresosBrutos: 0,
    nominaEstimada: 0,
    utilidadBruta: 0,
    capitalInventario: 0,
  });
  const [rendimientoSucursales, setRendimientoSucursales] = useState([]);
  const [nominaMedicos, setNominaMedicos] = useState([]);

  // Porcentaje de comisión para honorarios médicos (Ej: 30%)
  const PORCENTAJE_HONORARIOS = 0.30;

  useEffect(() => {
    const calcularFinanzas = async () => {
      try {
        setLoading(true);
        
        // 1. Traer Consultas (Ingresos)
        const snapConsultas = await getDocs(collection(db, "consultas"));
        let ingresosTotales = 0;
        const mapaSucursales = {};
        const mapaMedicos = {};

        snapConsultas.forEach(doc => {
          const data = doc.data();
          const costo = parseFloat(data.costo || data.precio) || 0;
          const sucursal = data.sucursal || 'Sucursal Central'; // Fallback
          const doctorNombre = data.doctorNombre || 'Médico General';

          ingresosTotales += costo;

          // Agrupar por Sucursal
          if (!mapaSucursales[sucursal]) mapaSucursales[sucursal] = 0;
          mapaSucursales[sucursal] += costo;

          // Agrupar por Médico para Honorarios
          if (!mapaMedicos[doctorNombre]) mapaMedicos[doctorNombre] = { consultas: 0, generado: 0 };
          mapaMedicos[doctorNombre].consultas += 1;
          mapaMedicos[doctorNombre].generado += costo;
        });

        // 2. Traer Inventario (Capital Inmovilizado)
        const snapInv = await getDocs(collection(db, "inventario"));
        let capitalInventario = 0;
        snapInv.forEach(doc => {
          const data = doc.data();
          const stock = parseInt(data.stock) || 0;
          const costoInv = parseFloat(data.costo || data.precio) || 0;
          capitalInventario += (stock * costoInv);
        });

        // 3. Procesar Nómina
        let totalNomina = 0;
        const arrayNomina = Object.keys(mapaMedicos).map(nombre => {
          const generado = mapaMedicos[nombre].generado;
          const honorarios = generado * PORCENTAJE_HONORARIOS;
          totalNomina += honorarios;
          return {
            nombre,
            consultas: mapaMedicos[nombre].consultas,
            generado,
            honorarios
          };
        }).sort((a, b) => b.honorarios - a.honorarios);

        // 4. Procesar Sucursales
        const arraySucursales = Object.keys(mapaSucursales).map(nombre => ({
          nombre,
          ingresos: mapaSucursales[nombre]
        })).sort((a, b) => b.ingresos - a.ingresos);

        setFinanzas({
          ingresosBrutos: ingresosTotales,
          nominaEstimada: totalNomina,
          utilidadBruta: ingresosTotales - totalNomina,
          capitalInventario
        });

        setRendimientoSucursales(arraySucursales);
        setNominaMedicos(arrayNomina);

      } catch (error) {
        console.error("Error calculando finanzas:", error);
      } finally {
        setLoading(false);
      }
    };

    calcularFinanzas();
  }, []);

  const mxn = (cantidad) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cantidad);

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
              Finanzas y Nómina
            </h1>
            <p className="text-[13px] text-[#64748b] font-medium mt-1">
              Control de ingresos, rentabilidad por sucursal y cálculo de honorarios médicos.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#f0fdf4] px-5 py-2.5 rounded-full border border-[#bbf7d0] shadow-sm text-[12px] font-bold text-[#16a34a] uppercase tracking-wider">
            <ShieldCheck size={16} />
            Datos Financieros Cifrados
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 fade-up">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-[#64748b] font-medium text-sm tracking-wide">Calculando flujos de caja...</p>
          </div>
        ) : (
          <>
            {/* --- KPIs FINANCIEROS --- */}
            <div className="fade-up delay-1 grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
              
              <div className="glass-card stripe-bg p-6 border-l-4 border-blue-500 flex flex-col justify-between">
                 <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2 flex items-center gap-1.5"><DollarSign size={14}/> Ingresos Brutos</p>
                 <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{mxn(finanzas.ingresosBrutos)}</p>
                 <p className="text-[11px] text-[#64748b] font-medium mt-2">Facturación total de clínicas</p>
              </div>

              <div className="glass-card stripe-bg p-6 border-l-4 border-amber-500 flex flex-col justify-between">
                 <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2 flex items-center gap-1.5"><CreditCard size={14}/> Nómina Médicos</p>
                 <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{mxn(finanzas.nominaEstimada)}</p>
                 <p className="text-[11px] text-amber-600 font-bold mt-2">Cálculo al {PORCENTAJE_HONORARIOS * 100}%</p>
              </div>

              <div className="glass-card p-6 bg-[#0f172a] text-white border-l-4 border-emerald-400 flex flex-col justify-between shadow-lg shadow-slate-800/20">
                 <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-400"/> Utilidad Clínica</p>
                 <p className="font-jakarta text-3xl font-extrabold text-white">{mxn(finanzas.utilidadBruta)}</p>
                 <p className="text-[11px] text-emerald-400 font-medium mt-2">Ingresos menos nómina</p>
              </div>

              <div className="glass-card stripe-bg p-6 border-l-4 border-purple-500 flex flex-col justify-between">
                 <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2 flex items-center gap-1.5"><Wallet size={14}/> Activo Inventario</p>
                 <p className="font-jakarta text-3xl font-extrabold text-[#0f172a]">{mxn(finanzas.capitalInventario)}</p>
                 <p className="text-[11px] text-[#64748b] font-medium mt-2">Valor de medicinas en almacén</p>
              </div>

            </div>

            <div className="fade-up delay-2 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* --- PANEL IZQUIERDO: RENTABILIDAD POR SUCURSAL --- */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-card p-6">
                   <h2 className="font-jakarta font-bold text-[#0f172a] flex items-center gap-2 mb-6 border-b border-[#f1f5f9] pb-4">
                     <Building size={18} className="text-blue-500" /> Rentabilidad Sucursales
                   </h2>
                   <div className="space-y-5">
                     {rendimientoSucursales.length === 0 ? (
                       <p className="text-sm text-[#64748b]">No hay ingresos registrados.</p>
                     ) : (
                       rendimientoSucursales.map((sucursal, idx) => {
                         const porcentaje = finanzas.ingresosBrutos > 0 ? (sucursal.ingresos / finanzas.ingresosBrutos) * 100 : 0;
                         return (
                           <div key={idx} className="group">
                             <div className="flex justify-between items-end mb-1.5">
                               <div>
                                 <p className="text-[13px] font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors">{sucursal.nombre}</p>
                                 <p className="text-[10px] font-bold text-[#64748b] mt-0.5">{porcentaje.toFixed(1)}% del total</p>
                               </div>
                               <span className="font-jakarta text-[14px] font-bold text-emerald-600">{mxn(sucursal.ingresos)}</span>
                             </div>
                             <div className="w-full bg-[#f1f5f9] rounded-full h-2 overflow-hidden">
                               <div className="h-full bg-blue-500 rounded-full" style={{ width: `${porcentaje}%` }}></div>
                             </div>
                           </div>
                         );
                       })
                     )}
                   </div>
                </div>

                <div className="glass-card p-6 bg-[#f8fafc] border border-[#e2e8f0]">
                   <PieChart size={24} className="text-[#64748b] mb-3" />
                   <h3 className="font-jakarta font-bold text-sm text-[#0f172a] mb-2">Exportación Contable</h3>
                   <p className="text-[11px] text-[#64748b] leading-relaxed mb-4">
                     El sistema prepara automáticamente las pólizas para su exportación al sistema del contador.
                   </p>
                   <button className="w-full py-2 bg-white border border-[#cbd5e1] rounded-xl text-[12px] font-bold text-[#0f172a] hover:border-blue-500 hover:text-blue-600 transition-colors shadow-sm flex justify-center items-center gap-2">
                     Descargar Excel (CSV) <ArrowRight size={14}/>
                   </button>
                </div>
              </div>

              {/* --- PANEL DERECHO: CÁLCULO DE NÓMINA MÉDICA --- */}
              <div className="lg:col-span-2 glass-card overflow-hidden flex flex-col">
                <div className="p-6 border-b border-[#f1f5f9] bg-white flex justify-between items-center">
                  <div>
                    <h2 className="font-jakarta text-lg font-bold text-[#0f172a]">Cálculo de Honorarios (Nómina)</h2>
                    <p className="text-[12px] text-[#64748b] mt-1">Cálculo automatizado en base a la productividad individual.</p>
                  </div>
                  <div className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase rounded-lg">
                    Tasa: {PORCENTAJE_HONORARIOS * 100}%
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[10px] uppercase tracking-widest text-[#64748b] font-bold">
                        <th className="px-6 py-4">Personal Médico</th>
                        <th className="px-4 py-4 text-center">Consultas</th>
                        <th className="px-4 py-4 text-right">Generado (Clínica)</th>
                        <th className="px-6 py-4 text-right">Honorarios a Pagar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {nominaMedicos.length === 0 ? (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-[13px] font-medium text-[#64748b]">No hay actividad médica registrada.</td></tr>
                      ) : (
                        nominaMedicos.map((medico, idx) => (
                          <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                  {medico.nombre.charAt(0).toUpperCase()}
                                </div>
                                <p className="font-bold text-[#0f172a] text-[14px]">{medico.nombre}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-[12px] font-bold text-[#64748b] bg-[#f1f5f9] px-3 py-1 rounded-md">
                                {medico.consultas}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <p className="text-[13px] font-medium text-[#64748b]">
                                {mxn(medico.generado)}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="font-jakarta font-bold text-amber-600 text-[15px]">
                                {mxn(medico.honorarios)}
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

export default FinanzasRH;