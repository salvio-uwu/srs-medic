// src/pages/enfermeria/DashboardJefaEnfermeria.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Thermometer, Droplet, Droplets,
  CheckCircle2, Search,
  Printer, Clock, Sparkles, X, Package, ShieldAlert,
  ChevronDown, Activity, Calendar,
  Clipboard, Shield, MapPin, LayoutDashboard,
  ClipboardList, Stethoscope, Plus, Filter, Eye, ChevronUp, ChevronRight, Gauge, CalendarX
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, onSnapshot, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo_azul.png';
import FiltroBitacorasJefaturaModal from '../../components/FiltroBitacorasJefaturaModal';
import CatalogoPedidoManager from '../../components/CatalogoPedidoManager';
import TraspasoSucursalModal from '../../components/TraspasoSucursalModal';
import CarroRojoJefatura from './CarroRojoJefatura';
import AlmacenJefatura from './AlmacenJefatura';
import KritJefatura from './KritJefatura';
import AutoclaveJefatura from './AutoclaveJefatura';
import CaducidadesJefatura from './CaducidadesJefatura';

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-lg border text-sm font-semibold animate-in slide-in-from-top-4 print:hidden ${
    type === 'error'   ? 'bg-red-50/90 border-red-200 text-red-700' :
    type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-700' :
                         'bg-emerald-50/90 border-emerald-200 text-emerald-700'
  }`}>
    {type === 'error'   ? <AlertTriangle size={20}/> :
     type === 'warning' ? <Clock size={20}/> :
                          <CheckCircle2 size={20}/>}
    <span className="font-bold">{msg}</span>
    <button onClick={onClose} className="ml-3 opacity-50 hover:opacity-100 p-1 bg-black/5 rounded-full"><X size={14}/></button>
  </div>
);

const LIMPIEZA_AREAS = {
  "Rayos X":          ["Limpieza y acomodo de mobiliario","Limpieza de cuarto de control","Piso barrido y trapeado","Recolección de basura"],
  "Tomas de muestra": ["Limpieza Silla, cajón de insumos","Limpieza centrifugadora, estantes, paredes","Piso barrido y trapeado","Recolección de basura"],
  "Aplicaciones":     ["Limpieza Silla, repisa, mesa, cajón de insumos","Limpieza de cajón de pinzas, paredes y puerta","Piso barrido y trapeado","Recolección de basura"],
  "Observación":      ["Lavado de manos (Limpieza y surtido de insumos)","Limpieza de carro rojo, camas, trípie, mesa, etc.","Piso barrido y trapeado","Recolección de basura"],
  "Salas y Recepción":["Lavado de manos (Limpieza y surtido de insumos)","Sala de espera, puertas y ventanas","Piso barrido y trapeado","Recolección de basura"],
  "Sanitarios":       ["Sanitario y estación de lavado (Limpieza y surtido)","Surtido de insumos","Piso barrido y trapeado","Recolección de basura"],
  "Consultorios":     ["Estación de lavado (Limpieza y surtido de insumos)","Limpieza de consultorio en general (escritorio, sillas, repisas, etc.)","Piso barrido y trapeado","Recolección de basura"]
};

const VIEW_META = {
  dashboard:    { label: 'Resumen',    icon: LayoutDashboard, color: 'blue'   },
  temperaturas: { label: 'Temperaturas',       icon: Thermometer,     color: 'indigo' },
  cloro:        { label: 'Cloro Residual',     icon: Droplet,         color: 'cyan'   },
  limpieza:     { label: 'Limpieza y Desinf.', icon: Sparkles,        color: 'teal'   },
  recepcion:    { label: 'Recepción Insumos',  icon: Package,         color: 'violet' },
  es:           { label: 'Entradas y Salidas', icon: Activity,        color: 'indigo' },
  carro_rojo:   { label: 'Carro Rojo',         icon: ShieldAlert,     color: 'rose'   },
  krit:          { label: 'Solución KRIT',      icon: Droplets,        color: 'teal'   },
  autoclave:    { label: 'Autoclave',           icon: Gauge,           color: 'violet' },
  almacen:      { label: 'Almacén',            icon: Package,         color: 'amber'  },
  caducidades:  { label: 'Caducidades',        icon: CalendarX,     color: 'rose'   },
  pedidos:      { label: 'Pedidos Sucursales', icon: ClipboardList,   color: 'blue'   },
  alertas:      { label: 'Centro de Alertas',  icon: AlertTriangle,   color: 'rose'   },
};

const Badge = ({ children, variant = 'default' }) => {
  const styles = {
    default:    'bg-slate-50 text-slate-600 border border-slate-200',
    critical:   'bg-rose-50 text-rose-600 font-bold border border-rose-200 shadow-sm',
    preventive: 'bg-amber-50 text-amber-600 font-bold border border-amber-200',
    ok:         'bg-emerald-50 text-emerald-600 font-bold border border-emerald-200',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest font-black ${styles[variant]}`}>
      {children}
    </span>
  );
};

const Check = ({ ok }) => ok
  ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-teal-50 text-teal-600 border border-teal-100 font-black text-xs shadow-sm">✓</span>
  : <span className="text-slate-300 font-bold">—</span>;

const sumCantidadFarmacia = (regs = []) =>
  regs.reduce((acc, r) => acc + (Number(r?.detalles?.cantidad) || 0), 0);

const normalizeMovimientoArea = (area = '') => {
  const a = String(area || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (a.startsWith('recepcion')) return 'Recepción';
  if (a.startsWith('entrada')) return 'Entrada';
  if (a.startsWith('salida')) return 'Salida';
  return String(area || '').trim();
};

/** Resolves approval: only explicit jefatura decision counts as approved/rejected. */
const resolveEstadoAprobacion = (reg) => {
  if (reg?.estadoAprobacion === 'aprobado' || reg?.estadoAprobacion === 'rechazado') {
    return reg.estadoAprobacion;
  }
  return 'pendiente';
};

const readCriterio = (det = {}, key, legacyKeys = []) => {
  if (typeof det[key] === 'boolean') return det[key];
  for (const k of legacyKeys) {
    if (typeof det[k] === 'boolean') return det[k];
  }
  // Si no hay dato explícito, no asumir cumplimiento
  if (det[key] === 0 || det[key] === '0' || det[key] === 'false' || det[key] === false) return false;
  if (det[key] === 1 || det[key] === '1' || det[key] === 'true' || det[key] === true) return true;
  return null;
};

const DashboardJefaEnfermeria = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Navegación interna 100% por estado (evita remounts / ofuscador de rutas)
  const [activeView, setActiveViewRaw] = useState('dashboard');
  const setActiveView = useCallback((id) => {
    if (VIEW_META[id]) setActiveViewRaw(id);
  }, []);

  const [areaLimpieza,  setAreaLimpieza]  = useState('Consultorios');
  const [currentTime,   setCurrentTime]   = useState(new Date());
  const [busqueda,      setBusqueda]      = useState('');
  const [toast,         setToast]         = useState({ show:false, msg:'', type:'info' });
  const [alertasCaducidad, setAlertasCaducidad] = useState([]);
  const [inventarioItems,  setInventarioItems]  = useState([]);
  const [traspasoItem,     setTraspasoItem]     = useState(null);
  const [bitacorasMes,     setBitacorasMes]     = useState([]);
  const [sucursalFiltro,   setSucursalFiltro]   = useState('');
  const [showFiltroBitacoras, setShowFiltroBitacoras] = useState(false);
  const [pedidosSucursales, setPedidosSucursales] = useState([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [pedidosBusqueda, setPedidosBusqueda] = useState('');
  const [pedidoExpandido, setPedidoExpandido] = useState(null);
  const [pedidoFiltroSucursal, setPedidoFiltroSucursal] = useState('');
  const [pedidoModoCatalogo, setPedidoModoCatalogo] = useState(false);
  const [catalogoSucursalesJefa, setCatalogoSucursalesJefa] = useState([]);
  const [pedidoMesActual, setPedidoMesActual] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [pedidoDiaExpandido, setPedidoDiaExpandido] = useState(null);
  const [kritRegistros, setKritRegistros] = useState([]);
  const [autoclaveRegistros, setAutoclaveRegistros] = useState([]);

  const showToast = (msg, type = 'info') => {
    setToast({ show:true, msg, type });
    setTimeout(() => setToast({ show:false, msg:'', type:'info' }), 4000);
  };

  const [aprobandoId, setAprobandoId] = useState(null);
  const [integrandoId, setIntegrandoId] = useState(null);

  const handleAprobarFarmacia = async (reg, decision) => {
    if (!reg?.id) return;
    if (!['aprobado', 'rechazado'].includes(decision)) return;
    if (reg.estadoAprobacion === decision) return;
    const nombre = user?.nombre || user?.displayName || user?.email || 'Jefatura';
    setAprobandoId(reg.id);
    try {
      await updateDoc(doc(db, 'bitacoras_operativas', reg.id), {
        estadoAprobacion: decision,
        aprobadoPor: user?.uid || user?.id || null,
        aprobadoPorNombre: nombre,
        aprobadoAt: serverTimestamp()
      });

      let entradaCreada = null;
      let salidaDescontada = false;
      const areaNorm = normalizeMovimientoArea(reg.area);
      const det = reg.detalles || {};

      // Salida aprobada = traspaso: descuenta stock del origen una sola vez
      if (decision === 'aprobado' && areaNorm === 'Salida' && !reg.stockDescontado) {
        const cantidad = Number(det.cantidad) || 0;
        const sucursalOrigen = det.sucursalOrigen || reg.sucursal || '';
        if (cantidad > 0 && det.medicamentoId && sucursalOrigen) {
          const invSnap = await getDocs(query(
            collection(db, 'inventario'),
            where('medicamentoId', '==', det.medicamentoId)
          ));
          const invDoc = invSnap.docs.find((d) => {
            const data = d.data() || {};
            return String(data.lote || '') === String(det.lote || '')
              && String(data.sucursal || data.sucursalNombre || '') === String(sucursalOrigen);
          });
          if (invDoc) {
            await updateDoc(invDoc.ref, {
              stock: increment(-cantidad),
              existencias: increment(-cantidad),
              actualizadoAt: serverTimestamp(),
              actualizadoPor: nombre
            });
            salidaDescontada = true;
            await updateDoc(doc(db, 'bitacoras_operativas', reg.id), { stockDescontado: true });
          } else {
            showToast(`No se encontró stock de "${det.compuesto}" (lote ${det.lote || 'S/N'}) en ${sucursalOrigen}. La salida quedó aprobada sin descontar.`, 'warning');
          }
        }
      }

      // Recepción o Salida aprobada genera Entrada en el destino (una sola vez)
      const generaEntrada = decision === 'aprobado'
        && !reg.entradaGeneradaId
        && (areaNorm === 'Recepción' || (areaNorm === 'Salida' && (det.sucursalDestino || '').trim()));

      if (generaEntrada) {
        const sucursalDestino = det.sucursalDestino || (areaNorm === 'Recepción' ? reg.sucursal : '') || '';
        const sucursalOrigen = areaNorm === 'Salida'
          ? (det.sucursalOrigen || reg.sucursal || '')
          : (det.proveedor || det.sucursalOrigen || 'Recepción proveedor');
        const payloadEntrada = {
          fecha: serverTimestamp(),
          fechaString: reg.fechaString || new Date().toLocaleDateString('en-CA'),
          responsableNombre: reg.responsableNombre || nombre,
          sucursal: sucursalDestino || 'Sin asignar',
          estado: 'completado',
          tipo: 'Farmacia',
          area: 'Entrada',
          origenRecepcionId: reg.id,
          estadoAprobacion: 'aprobado',
          estadoInventario: 'pendiente',
          aprobadoPor: user?.uid || user?.id || null,
          aprobadoPorNombre: nombre,
          aprobadoAt: serverTimestamp(),
          detalles: {
            ...det,
            tipo_movimiento: 'Entrada',
            criterio_empaque: !!det.criterio_empaque,
            criterio_etiqueta: !!det.criterio_etiqueta,
            sucursalOrigen,
            sucursalDestino,
            origenRecepcionId: reg.id
          }
        };
        const refEntrada = await addDoc(collection(db, 'bitacoras_operativas'), payloadEntrada);
        entradaCreada = { id: refEntrada.id, ...payloadEntrada };
        await updateDoc(doc(db, 'bitacoras_operativas', reg.id), {
          entradaGeneradaId: refEntrada.id
        });
      }

      setBitacorasMes((prev) => {
        const next = prev.map((b) => (
          b.id === reg.id
            ? {
                ...b,
                estadoAprobacion: decision,
                aprobadoPor: user?.uid || user?.id || null,
                aprobadoPorNombre: nombre,
                stockDescontado: salidaDescontada || b.stockDescontado || false,
                entradaGeneradaId: entradaCreada?.id || b.entradaGeneradaId || null
              }
            : b
        ));
        return entradaCreada ? [entradaCreada, ...next] : next;
      });

      const successMsg = areaNorm === 'Recepción' && entradaCreada
        ? 'Recepción aprobada. Se generó la Entrada pendiente de inventario.'
        : areaNorm === 'Salida' && entradaCreada
          ? `Traspaso aprobado: ${salidaDescontada ? 'stock descontado del origen y ' : ''}Entrada generada en ${det.sucursalDestino}.`
          : 'Movimiento aprobado.';

      showToast(
        decision === 'aprobado' ? successMsg : 'Movimiento no aprobado.',
        decision === 'aprobado' ? 'success' : 'warning'
      );
    } catch (err) {
      console.error(err);
      showToast('No se pudo actualizar la aprobación.', 'error');
    } finally {
      setAprobandoId(null);
    }
  };

  const handleIntegrarInventario = async (reg) => {
    if (!reg?.id) return;
    if (reg.estadoInventario === 'integrado') {
      showToast('Esta entrada ya está integrada al inventario.', 'warning');
      return;
    }
    const det = reg.detalles || {};
    const cantidad = Number(det.cantidad) || 0;
    if (!cantidad) {
      showToast('La entrada no tiene cantidad válida.', 'error');
      return;
    }
    const sucursalDestino = det.sucursalDestino || reg.sucursal || '';
    const nombre = user?.nombre || user?.displayName || user?.email || 'Jefatura';
    setIntegrandoId(reg.id);
    try {
      let invDoc = null;
      // Una sola igualdad evita depender de índice compuesto en Firestore
      if (det.medicamentoId) {
        const invSnap = await getDocs(query(
          collection(db, 'inventario'),
          where('medicamentoId', '==', det.medicamentoId)
        ));
        invDoc = invSnap.docs.find((d) => {
          const data = d.data() || {};
          return String(data.lote || '') === String(det.lote || '')
            && String(data.sucursal || data.sucursalNombre || '') === String(sucursalDestino || '');
        }) || null;
      }

      if (invDoc) {
        await updateDoc(invDoc.ref, {
          stock: increment(cantidad),
          existencias: increment(cantidad),
          caducidad: det.caducidad || invDoc.data().caducidad || null,
          actualizadoAt: serverTimestamp(),
          actualizadoPor: nombre
        });
      } else {
        await addDoc(collection(db, 'inventario'), {
          medicamentoId: det.medicamentoId || null,
          medicamento: det.compuesto || '',
          nombreComercial: det.compuesto || '',
          descripcion: det.compuesto || '',
          presentacion: det.presentacion || '',
          forma: det.forma || '',
          lote: det.lote || '',
          caducidad: det.caducidad || null,
          stock: cantidad,
          existencias: cantidad,
          sucursal: sucursalDestino,
          sucursalNombre: sucursalDestino,
          numeroAcomodo: det.numeroAcomodo || '',
          marca: det.marca || '',
          laboratorio: det.laboratorio || '',
          activo: true,
          origenBitacoraId: reg.id,
          creadoAt: serverTimestamp(),
          creadoPor: nombre
        });
      }

      await updateDoc(doc(db, 'bitacoras_operativas', reg.id), {
        estadoInventario: 'integrado',
        integradoAt: serverTimestamp(),
        integradoPor: user?.uid || user?.id || null,
        integradoPorNombre: nombre
      });

      setBitacorasMes((prev) => prev.map((b) => (
        b.id === reg.id
          ? { ...b, estadoInventario: 'integrado', integradoPorNombre: nombre }
          : b
      )));

      showToast('Entrada aceptada e integrada al inventario.', 'success');
    } catch (err) {
      console.error(err);
      showToast('No se pudo integrar al inventario.', 'error');
    } finally {
      setIntegrandoId(null);
    }
  };

  const handleTraspasoDone = ({ msg, cantidad, inventarioId }) => {
    if (inventarioId) {
      setInventarioItems((prev) => prev.map((i) => (
        i.id === inventarioId
          ? { ...i, stock: (Number(i.stock) || 0) - cantidad, existencias: (Number(i.existencias) || 0) - cantidad }
          : i
      )));
      setAlertasCaducidad((prev) => prev
        .map((a) => (a.id === inventarioId ? { ...a, stock: (Number(a.stock) || 0) - cantidad } : a))
        .filter((a) => (Number(a.stock) || 0) > 0));
    }
    showToast(msg, 'success');
  };

  /** Existencia actual de un insumo de pedido en una sucursal (empate por nombre). */
  const existenciaDeInsumo = (nombreInsumo, sucursalNombre) => {
    const term = String(nombreInsumo || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!term) return null;
    const suc = String(sucursalNombre || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const matches = inventarioItems.filter((i) => {
      const iSuc = String(i.sucursal || i.sucursalNombre || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (suc && iSuc !== suc) return false;
      const nombre = String(i.medicamento || i.nombreComercial || i.descripcion || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      return nombre && (nombre.includes(term) || term.includes(nombre));
    });
    if (matches.length === 0) return null;
    return matches.reduce((acc, i) => acc + (Number(i.stock ?? i.existencias) || 0), 0);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [inventarioSnap, bitacorasSnap] = await Promise.all([
          getDocs(collection(db, 'inventario')),
          getDocs(
            query(
              collection(db, 'bitacoras_operativas'),
              where('fechaString', '>=', new Date(currentTime.getFullYear(), currentTime.getMonth(), 1).toLocaleDateString('en-CA')),
              where('fechaString', '<=', new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).toLocaleDateString('en-CA'))
            )
          )
        ]);
        if (!isMounted) return;

        const hoy = new Date();
        const limit = new Date();
        limit.setMonth(hoy.getMonth() + 3);
        const alertas = [];
        const invItems = [];
        inventarioSnap.docs.forEach((docRef) => {
          const item = docRef.data();
          invItems.push({ id: docRef.id, ...item });
          if (item.caducidad) {
            const fCad = new Date(item.caducidad);
            if (fCad <= limit && item.stock > 0) {
              const dias = Math.ceil((fCad - hoy) / 86400000);
              alertas.push({ id: docRef.id, ...item, diasRestantes: dias, riesgo: dias <= 30 ? 'alto' : 'medio' });
            }
          }
        });
        setInventarioItems(invItems);
        setAlertasCaducidad(alertas.sort((a, b) => a.diasRestantes - b.diasRestantes));

        const bitacoras = bitacorasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        bitacoras.sort((a, b) => {
          const dateA = new Date(a.fechaString + 'T' + (a.fecha?.toDate?.().toTimeString() || '00:00:00'));
          const dateB = new Date(b.fechaString + 'T' + (b.fecha?.toDate?.().toTimeString() || '00:00:00'));
          return dateB - dateA;
        });
        setBitacorasMes(bitacoras);
      } catch {}
    };

    loadData();
    const intervalId = setInterval(loadData, 300000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Catálogo de sucursales (para filtro)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'catalogo_sucursales'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.activo !== false);
      setCatalogoSucursalesJefa(items);
    });
    return () => unsub();
  }, []);

  // Pedidos en tiempo real
  useEffect(() => {
    if (activeView !== 'pedidos' && activeView !== 'dashboard') return;
    setPedidosLoading(true);
    const q = query(collection(db, 'bitacoras_operativas'), where('tipo', '==', 'Pedido de medicamento'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const da = a.fecha?.toDate?.() || new Date(a.fechaString || 0);
        const db2 = b.fecha?.toDate?.() || new Date(b.fechaString || 0);
        return db2 - da;
      });
      setPedidosSucursales(items);
      setPedidosLoading(false);
    }, () => {
      showToast('Error al cargar pedidos', 'error');
      setPedidosLoading(false);
    });
    return () => unsub();
  }, [activeView]);

  // Registros KRIT en tiempo real (cuando se ve la vista krit)
  useEffect(() => {
    if (activeView !== 'krit' && activeView !== 'dashboard') return;
    const fechaInicio = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1).toLocaleDateString('en-CA');
    const fechaFin = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).toLocaleDateString('en-CA');
    const q = query(
      collection(db, 'registros_krit'),
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      setKritRegistros(docs);
    });
    return () => unsub();
  }, [activeView, currentTime]);

  // Registros Autoclave en tiempo real (cuando se ve la vista autoclave)
  useEffect(() => {
    if (activeView !== 'autoclave' && activeView !== 'dashboard') return;
    const fechaInicio = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1).toLocaleDateString('en-CA');
    const fechaFin = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).toLocaleDateString('en-CA');
    const q = query(
      collection(db, 'registros_autoclave'),
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      setAutoclaveRegistros(docs);
    });
    return () => unsub();
  }, [activeView, currentTime]);

  const alertasFiltradas = alertasCaducidad.filter(a =>
    (a.medicamento || a.compuesto || '').toLowerCase().includes(busqueda.toLowerCase())
  );
  const alertasCriticas = alertasCaducidad.filter(a => a.riesgo === 'alto').length;
  
  const diasDelMes = Array.from(
    { length: new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 0).getDate() },
    (_, i) => i + 1
  );

  const diasEnMes = diasDelMes.length;

  const bitacorasFiltradas = useMemo(() => {
    if (!sucursalFiltro) return bitacorasMes;
    return bitacorasMes.filter(b => b.sucursal === sucursalFiltro);
  }, [bitacorasMes, sucursalFiltro]);

  const meta = VIEW_META[activeView] || VIEW_META.dashboard;

  const mesLabel = currentTime.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
  const hoyStr = currentTime.toLocaleDateString('en-CA');
  
  // Dashboard Metrics
  const bitacorasHoy = bitacorasMes.filter(b => b.fechaString === hoyStr);
  const temp8Done = bitacorasHoy.some(b => b.tipo === 'Temperatura' && b.turno?.includes('8:00'));
  const temp4Done = bitacorasHoy.some(b => b.tipo === 'Temperatura' && b.turno?.includes('4:00'));
  const temp10Done = bitacorasHoy.some(b => b.tipo === 'Temperatura' && b.turno?.includes('10:00'));
  const cloroDone = bitacorasHoy.some(b => b.tipo === 'Cloro y PH');

  const resumenExec = useMemo(() => {
    const tempOk = [temp8Done, temp4Done, temp10Done].filter(Boolean).length;
    const limpiezaHoy = bitacorasHoy.filter((b) => b.tipo === 'Limpieza');
    const areasLimpiezaHoy = new Set(limpiezaHoy.map((b) => b.area).filter(Boolean)).size;
    const areasTotal = Object.keys(LIMPIEZA_AREAS).length;
    const recepcionMes = bitacorasMes.filter((b) => b.tipo === 'Farmacia' && normalizeMovimientoArea(b.area) === 'Recepción');
    const esMes = bitacorasMes.filter((b) => b.tipo === 'Farmacia' && ['Entrada', 'Salida'].includes(normalizeMovimientoArea(b.area)));
    const pedidosMes = bitacorasMes.filter((b) => b.tipo === 'Pedido de medicamento');
    const pedidosHoy = pedidosMes.filter((b) => b.fechaString === hoyStr);
    const rechazos = recepcionMes.filter((b) => resolveEstadoAprobacion(b) === 'rechazado').length;
    const pendientesAprob = recepcionMes.filter((b) => resolveEstadoAprobacion(b) === 'pendiente').length;
    const cantRecepcion = sumCantidadFarmacia(recepcionMes);
    const entradasMes = esMes.filter((b) => normalizeMovimientoArea(b.area) === 'Entrada');
    const salidasMes = esMes.filter((b) => normalizeMovimientoArea(b.area) === 'Salida');
    const cantEntradas = sumCantidadFarmacia(entradasMes);
    const cantSalidas = sumCantidadFarmacia(salidasMes);
    const alertasAtencion = alertasCaducidad.filter((a) => a.riesgo !== 'alto').length;
    const kritSucursales = new Set(kritRegistros.map((r) => r.sucursal).filter(Boolean)).size;
    const autoclaveSucursales = new Set(autoclaveRegistros.map((r) => r.sucursal).filter(Boolean)).size;
    const kritVencidos = kritRegistros.filter((r) => {
      if (!r.proximoCambio) return false;
      return new Date(r.proximoCambio) < new Date(hoyStr);
    }).length;

    const cumplimientoHoy = tempOk + (cloroDone ? 1 : 0);
    const cumplimientoMeta = 4;

    const moduloRows = [
      {
        id: 'temperaturas',
        estado: tempOk === 3 ? 'Completo' : tempOk > 0 ? 'Parcial' : 'Pendiente',
        dato1: `${tempOk}/3 turnos hoy`,
        dato2: `${bitacorasMes.filter((b) => b.tipo === 'Temperatura').length} en el mes`,
      },
      {
        id: 'cloro',
        estado: cloroDone ? 'Completo' : 'Pendiente',
        dato1: cloroDone ? 'Registrado hoy' : 'Sin captura hoy',
        dato2: `${bitacorasMes.filter((b) => b.tipo === 'Cloro y PH').length} en el mes`,
      },
      {
        id: 'limpieza',
        estado: areasLimpiezaHoy >= areasTotal ? 'Completo' : areasLimpiezaHoy > 0 ? 'Parcial' : 'Pendiente',
        dato1: `${areasLimpiezaHoy}/${areasTotal} áreas hoy`,
        dato2: `${bitacorasMes.filter((b) => b.tipo === 'Limpieza').length} en el mes`,
      },
      {
        id: 'recepcion',
        estado: recepcionMes.length ? 'Activo' : 'Sin datos',
        dato1: `${cantRecepcion} u. · ${recepcionMes.length} mov.`,
        dato2: rechazos ? `${rechazos} rechazos` : (pendientesAprob ? `${pendientesAprob} pendientes` : 'Sin pendientes'),
      },
      {
        id: 'es',
        estado: esMes.length ? 'Activo' : 'Sin datos',
        dato1: `+${cantEntradas} / −${cantSalidas}`,
        dato2: `${esMes.length} movimientos`,
      },
      {
        id: 'carro_rojo',
        estado: 'Panel',
        dato1: 'Cobertura por sucursal',
        dato2: 'Stock y caducidad',
      },
      {
        id: 'krit',
        estado: kritVencidos > 0 ? 'Atención' : kritSucursales > 0 ? 'Activo' : 'Sin datos',
        dato1: `${kritRegistros.length} registros`,
        dato2: kritVencidos > 0 ? `${kritVencidos} vencidos` : `${kritSucursales} sucursales`,
      },
      {
        id: 'autoclave',
        estado: autoclaveSucursales > 0 ? 'Activo' : 'Sin datos',
        dato1: `${autoclaveRegistros.length} ciclos`,
        dato2: `${autoclaveSucursales} sucursales`,
      },
      {
        id: 'almacen',
        estado: 'Panel',
        dato1: 'Inventario central',
        dato2: `${alertasCaducidad.length} por vencer`,
      },
      {
        id: 'caducidades',
        estado: alertasCriticas > 0 ? 'Crítico' : alertasCaducidad.length ? 'Atención' : 'Estable',
        dato1: `${alertasCriticas} críticas`,
        dato2: `${alertasAtencion} preventivas`,
      },
      {
        id: 'pedidos',
        estado: pedidosHoy.length ? 'Hoy' : pedidosMes.length ? 'Activo' : 'Sin datos',
        dato1: `${pedidosMes.length} pedidos mes`,
        dato2: `${pedidosHoy.length} hoy`,
      },
      {
        id: 'alertas',
        estado: alertasCriticas > 0 ? 'Crítico' : alertasCaducidad.length ? 'Atención' : 'OK',
        dato1: `${alertasCaducidad.length} alertas`,
        dato2: `≤90 días`,
      },
    ];

    const prioridades = [];
    if (tempOk < 3) prioridades.push({ id: 'temperaturas', texto: `Faltan ${3 - tempOk} turnos de temperatura hoy`, severidad: 'alta' });
    if (!cloroDone) prioridades.push({ id: 'cloro', texto: 'Cloro y PH sin registrar hoy', severidad: 'alta' });
    if (areasLimpiezaHoy === 0) prioridades.push({ id: 'limpieza', texto: 'Ningún área de limpieza registrada hoy', severidad: 'media' });
    if (alertasCriticas > 0) prioridades.push({ id: 'alertas', texto: `${alertasCriticas} ítems de inventario por vencer (≤30 días)`, severidad: 'alta' });
    if (kritVencidos > 0) prioridades.push({ id: 'krit', texto: `${kritVencidos} cambios KRIT vencidos`, severidad: 'media' });

    return {
      tempOk,
      cumplimientoHoy,
      cumplimientoMeta,
      areasLimpiezaHoy,
      areasTotal,
      recepcionMes: recepcionMes.length,
      esMes: esMes.length,
      cantRecepcion,
      cantEntradas,
      cantSalidas,
      pedidosMes: pedidosMes.length,
      pedidosHoy: pedidosHoy.length,
      rechazos,
      pendientesAprob,
      alertasAtencion,
      moduloRows,
      prioridades,
      bitacorasHoyCount: bitacorasHoy.length,
    };
  }, [
    temp8Done, temp4Done, temp10Done, cloroDone, bitacorasHoy, bitacorasMes, hoyStr,
    alertasCaducidad, alertasCriticas, kritRegistros, autoclaveRegistros,
  ]);

  const estadoTone = (estado) => {
    if (estado === 'Completo' || estado === 'OK' || estado === 'Estable' || estado === 'Activo' || estado === 'Hoy') return 'text-emerald-700';
    if (estado === 'Crítico' || estado === 'Pendiente') return 'text-rose-600';
    if (estado === 'Atención' || estado === 'Parcial') return 'text-amber-600';
    return 'text-slate-500';
  };

  const TableWrap = ({ children }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500 relative z-10 flex-1 flex flex-col min-h-0 print:block">
      <div className="overflow-auto custom-scrollbar flex-1">
        <table className="w-full text-sm min-w-[800px]">{children}</table>
      </div>
    </div>
  );

  const Th = ({ children, className = '', ...props }) => (
    <th className={`px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-200 whitespace-nowrap sticky top-0 z-10 ${className}`} {...props}>
      {children}
    </th>
  );

  const Td = ({ children, className = '', ...props }) => (
    <td className={`px-4 py-3.5 text-slate-600 border-b border-slate-50 font-medium ${className}`} {...props}>
      {children}
    </td>
  );

  const DayCell = ({ children }) => (
    <td className="px-4 py-3.5 border-b border-slate-50 text-center">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-600 text-xs font-black border border-slate-200">
        {children}
      </span>
    </td>
  );

  const isEmptyVal = (v) => v === undefined || v === null || v === '';

  const NumCell = ({ val, bold }) => (
    <Td className={`text-center ${bold ? 'font-bold text-slate-800' : ''}`}>{!isEmptyVal(val) ? val : <span className="text-slate-300 font-bold">—</span>}</Td>
  );

  const PrintFormat = () => {
    const printRows = Array.from({ length: diasEnMes }, (_, i) => i + 1);
    
    const getPrintDate = (dia) => {
      try {
        const d = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia);
        if (d.getMonth() !== currentTime.getMonth()) return ''; 
        return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      } catch { return ''; }
    };

    const thP = "border border-[#888] bg-[#d9d9d9] font-bold text-[8px] uppercase text-center p-0.5";
    const tdP = "border border-[#888] text-[8px] text-center p-0.5 h-4"; 
    const tdPLeft = "border border-[#888] text-[8px] text-left px-1 py-0.5 h-4 font-medium"; 

    return (
      <div className="hidden print:block w-full text-black font-sans bg-white p-1">
        <div className="flex items-center justify-between mb-0.5">
           <img src={logoImg} className="h-10 object-contain" alt="Logo" />
           <h1 className="text-xl font-bold text-slate-800 tracking-tight flex-1 text-center pr-10">Centro Medico Santa Cruz</h1>
        </div>
        <div className="bg-[#ffff00] py-0.5 border-t-2 border-b-2 border-slate-600 text-center mb-0.5 print-exact-colors">
           <h2 className="text-xs font-bold text-black">
              {activeView === 'krit'
                ? 'Registro de Cambio de Solución Estéril "KRIT"'
                : activeView === 'autoclave'
                  ? 'Registro de Autoclave'
                  : activeView === 'caducidades'
                    ? 'Medicamento Próximo a Caducar — Almacén'
                    : `Bitácora de ${activeView === 'limpieza' ? `limpieza y desinfección ${areaLimpieza.toUpperCase()}` : meta.label}`
              }
           </h2>
        </div>
        <div className="flex justify-center gap-12 font-bold text-[9px] mb-1 uppercase">
           <span>MES: {mesLabel}</span>
           {activeView === 'limpieza' && <span>AREA: {areaLimpieza}</span>}
           <span>SUC. {user?.sucursal || 'HUASTECA'}</span>
        </div>

        {activeView === 'temperaturas' && (
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th rowSpan={2} className={thP + " w-48"}>Fecha</th>
                <th colSpan={3} className={thP}>8:00 a.m.</th>
                <th colSpan={3} className={thP}>4:00 p.m.</th>
                <th colSpan={3} className={thP}>10:00 p.m.</th>
              </tr>
              <tr>
                {['T° Ext.','Hum %','T° Ref.', 'T° Ext.','Hum %','T° Ref.', 'T° Ext.','Hum %','T° Ref.'].map((h,i) => <th key={i} className={thP}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {printRows.map(dia => {
                const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                const regs  = bitacorasFiltradas.filter(b => b.tipo === 'Temperatura' && b.fechaString === fStr);
                const t8  = regs.find(r => r.turno?.includes('8:00'))?.detalles  || {};
                const t4  = regs.find(r => r.turno?.includes('4:00'))?.detalles  || {};
                const t10 = regs.find(r => r.turno?.includes('10:00'))?.detalles || {};
                const printDate = getPrintDate(dia);
                if(!printDate) return null;
                return (
                  <tr key={dia} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdPLeft}>{printDate}</td>
                    <td className={tdP}>{!isEmptyVal(t8.t_ext) ? t8.t_ext : ''}</td><td className={tdP}>{!isEmptyVal(t8.humedad) ? t8.humedad : ''}</td><td className={tdP}>{!isEmptyVal(t8.t_ref) ? t8.t_ref : ''}</td>
                    <td className={tdP}>{!isEmptyVal(t4.t_ext) ? t4.t_ext : ''}</td><td className={tdP}>{!isEmptyVal(t4.humedad) ? t4.humedad : ''}</td><td className={tdP}>{!isEmptyVal(t4.t_ref) ? t4.t_ref : ''}</td>
                    <td className={tdP}>{!isEmptyVal(t10.t_ext) ? t10.t_ext : ''}</td><td className={tdP}>{!isEmptyVal(t10.humedad) ? t10.humedad : ''}</td><td className={tdP}>{!isEmptyVal(t10.t_ref) ? t10.t_ref : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeView === 'cloro' && (
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th rowSpan={2} className={thP + " w-48"}>Fecha</th>
                <th colSpan={2} className={thP}>LAVADO DE MANOS 1</th>
                <th colSpan={2} className={thP}>LAVADO DE MANOS 2</th>
                <th rowSpan={2} className={thP + " w-32"}>Realizó</th>
              </tr>
              <tr>
                {['PH','CLORO','PH','CLORO'].map((h,i) => <th key={i} className={thP}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {printRows.map(dia => {
                const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                const reg  = bitacorasFiltradas.slice().reverse().find(b => b.tipo === 'Cloro y PH' && b.fechaString === fStr);
                const det  = reg?.detalles || {};
                const printDate = getPrintDate(dia);
                if(!printDate) return null;
                return (
                  <tr key={dia} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdPLeft}>{printDate}</td>
                    <td className={tdP}>{!isEmptyVal(det.ph_1) ? det.ph_1 : ''}</td><td className={tdP}>{!isEmptyVal(det.cloro_1) ? det.cloro_1 : ''}</td>
                    <td className={tdP}>{!isEmptyVal(det.ph_2) ? det.ph_2 : ''}</td><td className={tdP}>{!isEmptyVal(det.cloro_2) ? det.cloro_2 : ''}</td>
                    <td className={tdP}>{reg?.responsableNombre || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeView === 'limpieza' && (
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th className={thP + " w-48"}>Fecha</th>
                {LIMPIEZA_AREAS[areaLimpieza].map((col, i) => <th key={i} className={thP + " px-2 leading-tight lowercase first-letter:uppercase"}>{col}</th>)}
                <th className={thP + " w-24"}>Realizó</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map(dia => {
                const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                             const reg  = bitacorasFiltradas.slice().reverse().find(b => b.tipo === 'Limpieza' && b.area === areaLimpieza && b.fechaString === fStr);
                const det  = reg?.detalles || {};
                const printDate = getPrintDate(dia);
                if(!printDate) return null;
                return (
                  <tr key={dia} className="bg-[#f2f2f2] print-exact-colors">
                    <td className={tdPLeft}>{printDate}</td>
                    <td className={tdP}>{det.col1 || det.limpieza_general ? 'X' : ''}</td>
                    <td className={tdP}>{det.col2 || det.piso ? 'X' : ''}</td>
                    <td className={tdP}>{det.col3 || det.basura ? 'X' : ''}</td>
                    <td className={tdP}>{det.col4 || det.surtido_insumos ? 'X' : ''}</td>
                    <td className={tdP}>{reg?.responsableNombre ? reg.responsableNombre.split(' ')[0] : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeView === 'recepcion' && (
          <>
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th rowSpan={2} className={thP + " w-16"}>FECHA</th>
                <th rowSpan={2} className={thP + " w-20 leading-tight"}>NÚMERO DE FACTURA</th>
                <th rowSpan={2} className={thP}>COMPUESTO</th>
                <th rowSpan={2} className={thP}>PRESENTACIÓN</th>
                <th rowSpan={2} className={thP + " leading-tight"}>FORMA FARMACÉUTICA</th>
                <th rowSpan={2} className={thP}>LOTE</th>
                <th rowSpan={2} className={thP + " w-10"}>CANT.</th>
                <th rowSpan={2} className={thP + " w-20 leading-tight"}>FECHA DE CADUCIDAD</th>
                <th colSpan={2} className={thP + " leading-tight"}>CRITERIO DE ACEPTACIÓN</th>
                <th colSpan={2} className={thP}>APROBADO</th>
                <th rowSpan={2} className={thP + " w-24"}>RECIBIÓ</th>
                <th rowSpan={2} className={thP + " w-32"}>OBSERVACIONES</th>
              </tr>
              <tr>
                <th className={thP + " text-[7px]"}>EMPAQUE</th>
                <th className={thP + " text-[7px]"}>ETIQUETA</th>
                <th className={thP + " w-6"}>SI</th>
                <th className={thP + " w-6"}>NO</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const registros = bitacorasMes.filter(b => b.tipo === 'Farmacia' && normalizeMovimientoArea(b.area) === 'Recepción');
                const rows = Math.max(registros.length, 20);
                return Array.from({ length: rows }).map((_, i) => {
                  const reg = registros[i];
                  const det = reg?.detalles || {};
                  const empOk = readCriterio(det, 'criterio_empaque', ['empaque_ok']);
                  const etiOk = readCriterio(det, 'criterio_etiqueta', ['etiqueta_ok']);
                  const estado = reg ? resolveEstadoAprobacion(reg) : null;
                  return (
                    <tr key={i} className="bg-[#f2f2f2] print-exact-colors">
                      <td className={tdP}>{reg ? reg.fechaString.split('-').reverse().join('/') : ''}</td>
                      <td className={tdP}>{det.factura || ''}</td>
                      <td className={tdPLeft}>{det.compuesto || ''}</td>
                      <td className={tdP}>{det.presentacion || ''}</td>
                      <td className={tdP}>{det.forma || ''}</td>
                      <td className={tdP}>{det.lote || ''}</td>
                      <td className={tdP}>{det.cantidad || ''}</td>
                      <td className={tdP}>{det.caducidad ? det.caducidad.split('-').reverse().join('/') : ''}</td>
                      <td className={tdP}>{reg ? (empOk === true ? 'X' : '') : ''}</td>
                      <td className={tdP}>{reg ? (etiOk === true ? 'X' : '') : ''}</td>
                      <td className={tdP}>{estado === 'aprobado' ? 'X' : ''}</td>
                      <td className={tdP}>{estado === 'rechazado' ? 'X' : ''}</td>
                      <td className={tdP}>{reg?.responsableNombre ? reg.responsableNombre.split(' ')[0] : ''}</td>
                      <td className={tdPLeft}>{[
                        det.proveedor || det.sucursalOrigen ? `De: ${det.proveedor || det.sucursalOrigen}` : '',
                        det.sucursalDestino ? `Suc: ${det.sucursalDestino}` : '',
                        det.observaciones || ''
                      ].filter(Boolean).join(' · ')}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          <div className="bg-[#d9d9d9] print-exact-colors border border-[#666] border-t-0 p-2 min-h-[60px] text-[10px]">
             <span className="font-bold">COMENTARIOS / TOTALES:</span>
             {' '}Recepción: {resumenExec.cantRecepcion} u. ({resumenExec.recepcionMes} mov.)
             {' · '}Pendientes: {resumenExec.pendientesAprob}
             {' · '}No aprobados: {resumenExec.rechazos}
          </div>
          </>
        )}

        {activeView === 'es' && (
          <>
          <table className="w-full border-collapse border-2 border-[#666]">
            <thead>
              <tr>
                <th className={thP + " w-16"}>FECHA</th>
                <th className={thP + " w-20 leading-tight"}>NÚMERO DE FACTURA</th>
                <th className={thP}>COMPUESTO</th>
                <th className={thP}>PRESENTACIÓN</th>
                <th className={thP + " leading-tight"}>FORMA FARMACÉUTICA</th>
                <th className={thP}>LOTE</th>
                <th className={thP + " w-10"}>CANT.</th>
                <th className={thP + " w-20 leading-tight"}>FECHA DE CADUCIDAD</th>
                <th className={thP + " leading-tight w-24"}>TIPO DE MOVIMIENTO</th>
                <th className={thP + " w-24"}>REALIZÓ</th>
                <th className={thP + " w-32"}>OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const registros = bitacorasMes.filter(b => b.tipo === 'Farmacia' && ['Entrada', 'Salida'].includes(normalizeMovimientoArea(b.area)));
                const rows = Math.max(registros.length, 20);
                return Array.from({ length: rows }).map((_, i) => {
                  const reg = registros[i];
                  const det = reg?.detalles || {};
                  return (
                    <tr key={i} className="bg-[#f2f2f2] print-exact-colors">
                      <td className={tdP}>{reg ? reg.fechaString.split('-').reverse().join('/') : ''}</td>
                      <td className={tdP}>{det.factura || ''}</td>
                      <td className={tdPLeft}>{det.compuesto || ''}</td>
                      <td className={tdP}>{det.presentacion || ''}</td>
                      <td className={tdP}>{det.forma || ''}</td>
                      <td className={tdP}>{det.lote || ''}</td>
                      <td className={tdP}>{det.cantidad || ''}</td>
                      <td className={tdP}>{det.caducidad ? det.caducidad.split('-').reverse().join('/') : ''}</td>
                      <td className={tdP}>{reg ? normalizeMovimientoArea(reg.area) : ''}</td>
                      <td className={tdP}>{reg?.responsableNombre ? reg.responsableNombre.split(' ')[0] : ''}</td>
                      <td className={tdPLeft}>{[
                        det.sucursalOrigen ? `De: ${det.sucursalOrigen}` : '',
                        det.sucursalDestino ? `A: ${det.sucursalDestino}` : '',
                        reg?.estadoInventario === 'pendiente' ? 'Inv. pendiente' : '',
                        reg?.estadoInventario === 'integrado' ? 'Inv. integrado' : '',
                        det.observaciones || ''
                      ].filter(Boolean).join(' · ')}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          <div className="bg-[#d9d9d9] print-exact-colors border border-[#666] border-t-0 p-2 min-h-[60px] text-[10px]">
             <span className="font-bold">COMENTARIOS / TOTALES:</span>
             {' '}Entradas: +{resumenExec.cantEntradas} u. · Salidas: −{resumenExec.cantSalidas} u. · Netas: {resumenExec.cantEntradas - resumenExec.cantSalidas} u.
          </div>
          </>
        )}

        {activeView === 'krit' && (() => {
          const formatDateMX = (str) => {
            if (!str) return '';
            const [y, m, d] = str.split('-');
            return `${d}/${m}/${y}`;
          };
          const sucursalFiltrada = user?.sucursal || '';
          const registrosSuc = sucursalFiltrada
            ? kritRegistros.filter(r => r.sucursal === sucursalFiltrada)
            : kritRegistros;
          const totalRows = Math.max(registrosSuc.length, 20);

          return (
            <table className="w-full border-collapse border-2 border-[#666]">
              <thead>
                <tr>
                  <th className={thP + " w-32"}>FECHA (HOY)</th>
                  <th className={thP + " w-40"}>PRÓXIMO CAMBIO<br/><span className="font-normal">(7 días posteriores)</span></th>
                  <th className={thP + " w-40"}>CANTIDAD AGUA<br/><span className="font-normal">(1Lt /10ml KRIT)</span></th>
                  <th className={thP + " w-40"}>FIRMA DEL RESPONSABLE</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalRows }).map((_, i) => {
                  const reg = registrosSuc[i];
                  return (
                    <tr key={i} className="bg-[#f2f2f2] print-exact-colors">
                      <td className={tdP}>{reg ? formatDateMX(reg.fecha) : ''}</td>
                      <td className={tdP}>{reg ? formatDateMX(reg.proximoCambio) : ''}</td>
                      <td className={tdP}>{reg?.cantidadAgua || ''}</td>
                      <td className={tdPLeft}>{reg?.responsableNombre || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}

        {activeView === 'autoclave' && (() => {
          const formatDateMX = (str) => {
            if (!str) return '';
            const [y, m, d] = str.split('-');
            return `${d}/${m}/${y}`;
          };
          const sucursalFiltrada = user?.sucursal || '';
          const registrosSuc = sucursalFiltrada
            ? autoclaveRegistros.filter(r => r.sucursal === sucursalFiltrada)
            : autoclaveRegistros;
          const totalRows = Math.max(registrosSuc.length, 20);

          return (
            <table className="w-full border-collapse border-2 border-[#666]">
              <thead>
                <tr>
                  <th className={thP + " w-32"}>FECHA</th>
                  <th className={thP + " w-32"}>LITROS UTILIZADOS</th>
                  <th className={thP + " w-32"}>PIEZAS</th>
                  <th className={thP + " w-32"}>DURACIÓN DEL CICLO</th>
                  <th className={thP + " w-40"}>FIRMA DEL RESPONSABLE</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalRows }).map((_, i) => {
                  const reg = registrosSuc[i];
                  return (
                    <tr key={i} className="bg-[#f2f2f2] print-exact-colors">
                      <td className={tdP}>{reg ? formatDateMX(reg.fecha) : ''}</td>
                      <td className={tdP}>{reg?.litrosUtilizados || ''}</td>
                      <td className={tdP}>{reg?.piezas || ''}</td>
                      <td className={tdP}>{reg?.duracionCiclo || ''}</td>
                      <td className={tdPLeft}>{reg?.responsableNombre || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}

      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        
        body { font-family: 'DM Sans', sans-serif; background: #f4f7f9; }
        .font-jakarta { font-family: 'Sora', system-ui, sans-serif; }
        
        .glass-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }

        .th-group { background: #f8fafc !important; color: #475569 !important; font-size: 10px !important; letter-spacing: 0.1em; }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        @media print {
          body * { visibility: hidden; }
          .print-zone, .print-zone * { visibility: visible; }
          .print-zone { position: absolute; inset: 0; padding: 5mm; background: white; width: 100%; height: 100%; }
          .no-print { display: none !important; }
          .print-hidden { display: none !important; }
          @page { size: landscape; margin: 5mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-exact-colors { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {toast.show && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show:false })} />}

      <div className="flex flex-col w-full min-h-full bg-[#f8f9fa] text-slate-700">

        {/* ── HEADER + SUBNAV (sticky dentro del scroll de AppShell) ── */}
        <div className="flex flex-col p-3 sm:p-4 gap-3">

          <header className="print-hidden sticky top-0 z-20 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-lg px-3 sm:px-5 py-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                {activeView !== 'dashboard' ? (
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                  >
                    <ChevronRight size={12} className="rotate-180" /> Volver al resumen
                  </button>
                ) : (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">Jefatura de enfermería</p>
                )}
                <h1 className="text-[18px] sm:text-[22px] font-bold text-slate-900 leading-tight truncate" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>
                  {activeView === 'dashboard' ? 'Centro de mando' : meta.label}
                </h1>
                <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                  {activeView === 'dashboard' ? (
                    <>Supervisión de auditorías, COFEPRIS, almacén y operación</>
                  ) : (
                    <>
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      {user?.sucursal || user?.sucursalActual || 'General'}
                      <span className="text-slate-300">·</span>
                      <span className="capitalize">{mesLabel.toLowerCase()}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(activeView === 'temperaturas' || activeView === 'cloro' || activeView === 'limpieza') && catalogoSucursalesJefa.length > 0 && (
                  <select
                    value={sucursalFiltro}
                    onChange={e => setSucursalFiltro(e.target.value)}
                    className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 outline-none"
                  >
                    <option value="">Todas las sucursales</option>
                    {catalogoSucursalesJefa.map(s => (
                      <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>
                    ))}
                  </select>
                )}
                <button type="button" onClick={() => navigate('/enfermeria/dashboard')} className="inline-flex items-center gap-1.5 border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors">
                  <Stethoscope size={13}/> Agenda
                </button>
                <button type="button" onClick={() => setShowFiltroBitacoras(true)} className="inline-flex items-center gap-1.5 border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors">
                  <Filter size={13}/> Filtrar
                </button>
                <button type="button" onClick={() => navigate('/enfermeria/registros')} className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1.5 rounded-md text-[11px] font-semibold hover:bg-slate-800 transition-colors">
                  <Plus size={13}/> Capturar
                </button>
                {activeView !== 'dashboard' && activeView !== 'alertas' && activeView !== 'almacen' && activeView !== 'caducidades' && (
                  <button type="button" onClick={() => { window.print(); showToast('Preparando documento...', 'success'); }} className="hidden md:inline-flex items-center border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md transition-colors">
                    <Printer size={13}/>
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="print-hidden flex flex-col relative min-h-[60vh]">

              {activeView === 'dashboard' && (
                <div className="w-full max-w-[1280px] mx-auto pb-10 space-y-5">
                  {/* KPI strip — estilo Centro Ejecutivo */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
                    <div className="bg-white px-4 py-3.5 col-span-2 lg:col-span-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">Cumplimiento hoy</p>
                      <p className="text-[24px] font-extrabold text-slate-900 leading-none">
                        {resumenExec.cumplimientoHoy}
                        <span className="text-[14px] font-medium text-slate-400">/{resumenExec.cumplimientoMeta}</span>
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-600">
                        <span>Temp <strong className="text-slate-900">{resumenExec.tempOk}/3</strong></span>
                        <span>Cloro <strong className={cloroDone ? 'text-emerald-700' : 'text-rose-600'}>{cloroDone ? 'OK' : 'pendiente'}</strong></span>
                      </div>
                    </div>
                    <div className="bg-white px-4 py-3.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">Bitácoras</p>
                      <p className="text-[24px] font-extrabold text-slate-900 leading-none">{bitacorasMes.length}</p>
                      <p className="text-[11px] text-slate-500 mt-1.5">este mes</p>
                      <p className="text-[11px] text-slate-600 mt-1">{resumenExec.bitacorasHoyCount} <span className="text-slate-400">hoy</span></p>
                    </div>
                    <div className="bg-white px-4 py-3.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">Farmacia</p>
                      <p className="text-[24px] font-extrabold text-slate-900 leading-none">{resumenExec.recepcionMes + resumenExec.esMes}</p>
                      <p className="text-[11px] text-slate-500 mt-1.5">movimientos</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        +{resumenExec.cantRecepcion} <span className="text-slate-400">u. recep.</span>
                        {' · '}
                        +{resumenExec.cantEntradas}/−{resumenExec.cantSalidas} <span className="text-slate-400">E/S</span>
                      </p>
                    </div>
                    <div className="bg-white px-4 py-3.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-2">Riesgos</p>
                      <p className="text-[24px] font-extrabold text-slate-900 leading-none">{alertasCriticas}</p>
                      <p className="text-[11px] text-slate-500 mt-1.5">alertas críticas</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {alertasCaducidad.length} <span className="text-slate-400">por vencer</span>
                        {' · '}
                        {resumenExec.pedidosHoy} <span className="text-slate-400">pedidos hoy</span>
                      </p>
                    </div>
                  </div>

                  {/* Prioridades + Módulos lado a lado */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Prioridades — columna estrecha */}
                    <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-bold text-slate-900">Prioridades hoy</p>
                        <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                          resumenExec.prioridades.length
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {resumenExec.prioridades.length || 'OK'}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {resumenExec.prioridades.length === 0 ? (
                          <div className="px-3.5 py-6 text-center">
                            <CheckCircle2 size={18} className="mx-auto mb-1.5 text-emerald-500" />
                            <p className="text-[11px] font-semibold text-slate-500">Sin pendientes críticos</p>
                          </div>
                        ) : (
                          resumenExec.prioridades.map((p) => {
                            const m = VIEW_META[p.id];
                            const Icon = m?.icon || AlertTriangle;
                            return (
                              <button
                                key={p.id + p.texto}
                                type="button"
                                onClick={() => setActiveView(p.id)}
                                className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors group"
                              >
                                <Icon size={14} className={`mt-0.5 shrink-0 ${p.severidad === 'alta' ? 'text-rose-500' : 'text-amber-500'}`} strokeWidth={1.75} />
                                <span className="flex-1 min-w-0 text-[12px] font-medium text-slate-700 leading-snug group-hover:text-slate-900">
                                  {p.texto}
                                </span>
                                <ChevronRight size={13} className="mt-0.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Módulos — lista compacta, sin tabla ancha */}
                    <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-bold text-slate-900">Módulos</p>
                        <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Clic para abrir</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100">
                        {resumenExec.moduloRows.map((row) => {
                          const m = VIEW_META[row.id];
                          const Icon = m.icon;
                          return (
                            <button
                              key={row.id}
                              type="button"
                              onClick={() => setActiveView(row.id)}
                              className="flex items-center gap-2.5 px-3.5 py-2.5 text-left bg-white hover:bg-slate-50 transition-colors group"
                            >
                              <Icon size={14} className="text-slate-400 group-hover:text-slate-700 shrink-0" strokeWidth={1.75} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[12px] font-semibold text-slate-900 truncate">{m.label}</span>
                                  <span className={`text-[10px] font-bold shrink-0 ${estadoTone(row.estado)}`}>{row.estado}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">{row.dato1}</p>
                              </div>
                              <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Dos columnas: actividad + accesos/riesgos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-h-[320px]">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                        <p className="text-[13px] font-bold text-slate-900">Actividad reciente</p>
                        <button type="button" onClick={() => navigate('/enfermeria/registros')} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                          Capturar <ChevronRight size={12} />
                        </button>
                      </div>
                      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[360px]">
                        {bitacorasMes.slice(0, 10).map((b, i) => (
                          <div key={b.id || i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-800 truncate">
                                {b.tipo}
                                <span className="text-slate-400 font-medium"> · {b.area || b.turno || 'General'}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5 truncate">
                                {b.responsableNombre || '—'}
                                {b.sucursal ? ` · ${b.sucursal}` : ''}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 shrink-0 tabular-nums">
                              {(b.fechaString || '').split('-').reverse().join('/')}
                            </span>
                          </div>
                        ))}
                        {bitacorasMes.length === 0 && (
                          <p className="px-4 py-10 text-center text-[12px] text-slate-400">Sin registros este mes.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 min-h-[320px]">
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex-1">
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
                          <p className="text-[13px] font-bold text-slate-900">Accesos directos</p>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-slate-100 p-px">
                          {[
                            { label: 'Agenda', sub: 'Enfermería', icon: Stethoscope, action: () => navigate('/enfermeria/dashboard') },
                            { label: 'Capturar', sub: 'Bitácora', icon: Plus, action: () => navigate('/enfermeria/registros') },
                            { label: 'Filtrar', sub: 'Impresión', icon: Filter, action: () => setShowFiltroBitacoras(true) },
                            { label: 'Carro rojo', sub: 'Sucursales', icon: ShieldAlert, action: () => setActiveView('carro_rojo') },
                            { label: 'Almacén', sub: 'Inventario', icon: Package, action: () => setActiveView('almacen') },
                            { label: 'Alertas', sub: `${alertasCriticas} críticas`, icon: AlertTriangle, action: () => setActiveView('alertas') },
                          ].map((a) => (
                            <button
                              key={a.label}
                              type="button"
                              onClick={a.action}
                              className="bg-white px-3.5 py-3.5 text-left hover:bg-slate-50 transition-colors group"
                            >
                              <a.icon size={16} className="text-slate-400 group-hover:text-slate-800 mb-2" strokeWidth={1.75} />
                              <p className="text-[13px] font-semibold text-slate-900">{a.label}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{a.sub}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                          <p className="text-[13px] font-bold text-slate-900">Inventario en riesgo</p>
                          <button type="button" onClick={() => setActiveView('alertas')} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                            Ver todo
                          </button>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
                          {alertasCaducidad.slice(0, 5).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveView('alertas')}
                              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-slate-800 truncate">{item.medicamento || item.compuesto}</p>
                                <p className="text-[10px] text-slate-400">Lote {item.lote || '—'} · stock {item.stock ?? '—'}</p>
                              </div>
                              <span className={`text-[12px] font-bold shrink-0 ${item.riesgo === 'alto' ? 'text-rose-600' : 'text-amber-600'}`}>
                                {item.diasRestantes}d
                              </span>
                            </button>
                          ))}
                          {alertasCaducidad.length === 0 && (
                            <div className="px-4 py-6 text-center text-slate-400">
                              <CheckCircle2 size={20} className="mx-auto mb-1.5 text-emerald-500" />
                              <p className="text-[11px] font-semibold">Sin ítems por vencer</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(activeView === 'temperaturas' || activeView === 'cloro') && (
                <TableWrap>
                    <thead>
                    <tr>
                        <Th rowSpan={2} className="text-center w-14">Día</Th>
                        {activeView === 'temperaturas' && (
                            <>
                                <Th colSpan={3} className="th-group text-center border-l border-slate-200">8:00 a.m.</Th>
                                <Th colSpan={3} className="th-group text-center border-l border-slate-200">4:00 p.m.</Th>
                                <Th colSpan={3} className="th-group text-center border-l border-slate-200">10:00 p.m.</Th>
                                <Th rowSpan={2} className="w-40 text-center border-l border-slate-200">Enfermera(o)</Th>
                            </>
                        )}
                        {activeView === 'cloro' && (
                            <>
                                <Th colSpan={2} className="th-group text-center border-l border-slate-200">Lavado de Manos 1</Th>
                                <Th colSpan={2} className="th-group text-center border-l border-slate-200">Lavado de Manos 2</Th>
                                <Th rowSpan={2} className="w-48 text-center border-l border-slate-200">Enfermera(o)</Th>
                            </>
                        )}
                    </tr>
                    <tr>
                        {activeView === 'temperaturas' && ['T° Ext.','Hum. %','T° Ref.', 'T° Ext.','Hum. %','T° Ref.', 'T° Ext.','Hum. %','T° Ref.'].map((h,i) => <Th key={i} className={`text-center ${i===0||i===3||i===6?'border-l border-slate-200':''}`}>{h}</Th>)}
                        {activeView === 'cloro' && ['PH','Cloro','PH','Cloro'].map((h,i) => <Th key={i} className={`text-center ${i===0||i===2?'border-l border-slate-200':''}`}>{h}</Th>)}
                    </tr>
                    </thead>
                    <tbody>
                    {diasDelMes.map(dia => {
                        const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                        
                        if (activeView === 'temperaturas') {
                const regs  = bitacorasFiltradas.filter(b => b.tipo === 'Temperatura' && b.fechaString === fStr);
                            const reg8  = regs.find(r => r.turno?.includes('8:00'));
                            const reg4  = regs.find(r => r.turno?.includes('4:00'));
                            const reg10 = regs.find(r => r.turno?.includes('10:00'));
                            const t8  = reg8?.detalles  || {};
                            const t4  = reg4?.detalles  || {};
                            const t10 = reg10?.detalles || {};
                            const responsables = [reg8, reg4, reg10].map(r => r?.responsableNombre).filter(Boolean).join(', ');
                            return (
                                <tr key={dia} className="hover:bg-blue-50/50 transition-colors group">
                                    <DayCell>{dia}</DayCell>
                                    <NumCell val={t8.t_ext}/><NumCell val={t8.humedad}/><NumCell val={t8.t_ref} bold/>
                                    <NumCell val={t4.t_ext}/><NumCell val={t4.humedad}/><NumCell val={t4.t_ref} bold/>
                                    <NumCell val={t10.t_ext}/><NumCell val={t10.humedad}/><NumCell val={t10.t_ref} bold/>
                                    <Td className="text-[10px] uppercase font-bold text-slate-500 text-center max-w-[120px] truncate">{responsables || <span className="text-slate-300">—</span>}</Td>
                                </tr>
                            );
                        }
                        
                        if (activeView === 'cloro') {
                const reg  = bitacorasFiltradas.slice().reverse().find(b => b.tipo === 'Cloro y PH' && b.fechaString === fStr);
                            const det  = reg?.detalles || {};
                            return (
                                <tr key={dia} className="hover:bg-cyan-50/50 transition-colors group">
                                    <DayCell>{dia}</DayCell>
                                    <NumCell val={det.ph_1}/><NumCell val={det.cloro_1} bold/>
                                    <NumCell val={det.ph_2}/><NumCell val={det.cloro_2} bold/>
                                    <Td className="text-[10px] uppercase font-bold text-slate-500 text-center">{reg?.responsableNombre || <span className="text-slate-300">—</span>}</Td>
                                </tr>
                            );
                        }
                        return null;
                    })}
                    </tbody>
                </TableWrap>
              )}

              {/* VISTAS DE TARJETA MÓVIL (Solo visible en md:hidden para tablas de auditoría) */}
              <div className="md:hidden flex flex-col gap-4 overflow-y-auto pb-10">
                 {(activeView === 'temperaturas' || activeView === 'cloro') && diasDelMes.map(dia => {
                     const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                     
                     if (activeView === 'temperaturas') {
                       const regs = bitacorasFiltradas.filter(b => b.tipo === 'Temperatura' && b.fechaString === fStr);
                       if (regs.length === 0) return null;
                       const t8 = regs.find(r => r.turno?.includes('8:00'))?.detalles || {};
                       const t4 = regs.find(r => r.turno?.includes('4:00'))?.detalles || {};
                       const t10 = regs.find(r => r.turno?.includes('10:00'))?.detalles || {};
                       const resp = [...new Set(regs.map(r => r.responsableNombre).filter(Boolean))].join(', ');
                       return (
                         <div key={`temp-${dia}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                           <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                             <span className="text-sm font-black text-slate-800">{dia} {mesLabel}</span>
                             {resp && <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{resp}</span>}
                           </div>
                           <div className="grid grid-cols-3 gap-2 text-center">
                             {[{label:'8 AM',t:t8},{label:'4 PM',t:t4},{label:'10 PM',t:t10}].map(({label,t}) => (
                               <div key={label} className="bg-slate-50 rounded-xl p-2">
                                 <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
                                 <p className="text-[11px] font-bold text-slate-700">{!isEmptyVal(t.t_ext) ? `${t.t_ext}°` : '—'}</p>
                                 <p className="text-[10px] text-slate-500">{!isEmptyVal(t.humedad) ? `${t.humedad}%` : '—'}</p>
                                 <p className="text-[10px] font-bold text-blue-600">{!isEmptyVal(t.t_ref) ? `${t.t_ref}°` : '—'}</p>
                               </div>
                             ))}
                           </div>
                         </div>
                       );
                     }
                     
                     if (activeView === 'cloro') {
                       const reg = bitacorasFiltradas.slice().reverse().find(b => b.tipo === 'Cloro y PH' && b.fechaString === fStr);
                       if (!reg) return null;
                       const det = reg?.detalles || {};
                       return (
                         <div key={`cloro-${dia}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                           <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                             <span className="text-sm font-black text-slate-800">{dia} {mesLabel}</span>
                             {reg?.responsableNombre && <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{reg.responsableNombre}</span>}
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                             <div className="bg-cyan-50/50 rounded-xl p-3 border border-cyan-100">
                               <p className="text-[9px] font-black text-cyan-600 uppercase mb-2">Lavado 1</p>
                               <div className="flex justify-between text-[12px]">
                                 <span className="text-slate-500">PH</span>
                                 <span className="font-bold text-slate-800">{!isEmptyVal(det.ph_1) ? det.ph_1 : '—'}</span>
                               </div>
                               <div className="flex justify-between text-[12px] mt-1">
                                 <span className="text-slate-500">Cloro</span>
                                 <span className="font-bold text-slate-800">{!isEmptyVal(det.cloro_1) ? det.cloro_1 : '—'}</span>
                               </div>
                             </div>
                             <div className="bg-cyan-50/50 rounded-xl p-3 border border-cyan-100">
                               <p className="text-[9px] font-black text-cyan-600 uppercase mb-2">Lavado 2</p>
                               <div className="flex justify-between text-[12px]">
                                 <span className="text-slate-500">PH</span>
                                 <span className="font-bold text-slate-800">{!isEmptyVal(det.ph_2) ? det.ph_2 : '—'}</span>
                               </div>
                               <div className="flex justify-between text-[12px] mt-1">
                                 <span className="text-slate-500">Cloro</span>
                                 <span className="font-bold text-slate-800">{!isEmptyVal(det.cloro_2) ? det.cloro_2 : '—'}</span>
                               </div>
                             </div>
                           </div>
                         </div>
                       );
                     }
                     return null;
                 })}
              </div>

              {/* --- LIMPIEZA ───────────────────────────────────────────────────── */}
              {activeView === 'limpieza' && (
                <div className="space-y-4 animate-in fade-in flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-3 glass-panel rounded-2xl px-5 py-3 w-fit shrink-0">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área Auditada:</label>
                        <div className="relative">
                            <select className="appearance-none bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold text-slate-700 outline-none cursor-pointer focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all shadow-sm"
                            value={areaLimpieza} onChange={e => setAreaLimpieza(e.target.value)}>
                            {Object.keys(LIMPIEZA_AREAS).map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>

                    <TableWrap>
                        <thead>
                            <tr>
                            <Th className="text-center w-14">Día</Th>
                            {LIMPIEZA_AREAS[areaLimpieza].map((col, i) => <Th key={i}>{col}</Th>)}
                            <Th className="w-48 text-center border-l border-slate-200">Responsable</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {diasDelMes.map(dia => {
                            const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                            const reg  = bitacorasFiltradas.slice().reverse().find(b => b.tipo === 'Limpieza' && b.area === areaLimpieza && b.fechaString === fStr);
                            const det  = reg?.detalles || {};
                            return (
                                <tr key={dia} className="hover:bg-teal-50/50 transition-colors">
                                <DayCell>{dia}</DayCell>
                                <Td className="text-center"><Check ok={det.col1 || det.limpieza_general}/></Td>
                                <Td className="text-center"><Check ok={det.col2 || det.piso}/></Td>
                                <Td className="text-center"><Check ok={det.col3 || det.basura}/></Td>
                                <Td className="text-center"><Check ok={det.col4 || det.surtido_insumos}/></Td>
                                <Td className="text-[10px] font-bold uppercase text-slate-500 text-center">{reg?.responsableNombre || <span className="text-slate-300">—</span>}</Td>
                                </tr>
                            );
                            })}
                        </tbody>
                    </TableWrap>

                    {/* Mobile Limpieza Cards */}
                    <div className="md:hidden flex flex-col gap-4 pb-10 overflow-y-auto">
                        {diasDelMes.map(dia => {
                             const fStr = new Date(currentTime.getFullYear(), currentTime.getMonth(), dia).toLocaleDateString('en-CA');
                const reg  = bitacorasFiltradas.slice().reverse().find(b => b.tipo === 'Limpieza' && b.area === areaLimpieza && b.fechaString === fStr);
                             if(!reg) return null;
                             return (
                                 <div key={dia} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                                     <span className="text-sm font-black text-slate-800">{dia} {mesLabel}</span>
                                     <span className="bg-teal-50 text-teal-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Completado</span>
                                 </div>
                             );
                        })}
                    </div>
                </div>
              )}

             {/* --- RECEPCIÓN Y ENTRADAS/SALIDAS (FORMATO OFICIAL) ──────────────────── */}
              {(activeView === 'recepcion' || activeView === 'es') && (() => {
                  const registros = bitacorasMes.filter(b => b.tipo === 'Farmacia' && (
                    activeView === 'recepcion'
                      ? normalizeMovimientoArea(b.area) === 'Recepción'
                      : ['Entrada', 'Salida'].includes(normalizeMovimientoArea(b.area))
                  ));

                  if (registros.length === 0) {
                      return (
                          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                              <Package size={48} className="text-slate-200 mb-4" />
                              <h3 className="text-lg font-bold text-slate-700">Sin movimientos registrados</h3>
                              <p className="text-sm text-slate-400 mt-1">No hay datos de {activeView === 'recepcion' ? 'recepción' : 'entradas/salidas'} en este periodo.</p>
                          </div>
                      );
                  }

                  const renderAprobacionCell = (reg) => {
                    const estado = resolveEstadoAprobacion(reg);
                    const busy = aprobandoId === reg.id;
                    if (estado === 'aprobado') return <Badge variant="ok">APROBADO</Badge>;
                    if (estado === 'rechazado') return <Badge variant="critical">NO APROBADO</Badge>;
                    return (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleAprobarFarmacia(reg, 'aprobado')}
                            className="px-2 py-1 rounded-md text-[9px] font-black uppercase bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleAprobarFarmacia(reg, 'rechazado')}
                            className="px-2 py-1 rounded-md text-[9px] font-black uppercase border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            No aprobar
                          </button>
                        </div>
                      </div>
                    );
                  };

                  const renderInventarioCell = (reg) => {
                    if (normalizeMovimientoArea(reg.area) !== 'Entrada') return <span className="text-slate-300">—</span>;
                    if (reg.estadoInventario === 'integrado') return <Badge variant="ok">EN INVENTARIO</Badge>;
                    if (resolveEstadoAprobacion(reg) !== 'aprobado' && !reg.origenRecepcionId) {
                      return <span className="text-[9px] font-bold text-slate-400 uppercase">Requiere aprobación</span>;
                    }
                    return (
                      <button
                        type="button"
                        disabled={integrandoId === reg.id}
                        onClick={() => handleIntegrarInventario(reg)}
                        className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {integrandoId === reg.id ? 'Integrando…' : 'Aceptar e integrar'}
                      </button>
                    );
                  };

                  return (
                      <div className="flex-1 flex flex-col h-full animate-in fade-in min-h-0 gap-3">
                        <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm min-h-0">
                          <div className="overflow-auto custom-scrollbar flex-1">
                            <table className="w-full text-sm min-w-[1280px] border-collapse">
                              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 border-r border-slate-200">Fecha</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 border-r border-slate-200">Factura</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200">Insumo</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-36 border-r border-slate-200">De → A</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 border-r border-slate-200">Lote</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-20 border-r border-slate-200">Cant.</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 border-r border-slate-200">Caducidad</th>
                                  {activeView === 'recepcion' ? (
                                      <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-32 border-r border-slate-200">Empaque / Etiqueta</th>
                                  ) : (
                                      <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 border-r border-slate-200">Movimiento</th>
                                  )}
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-32 border-r border-slate-200">Aprobado</th>
                                  {activeView === 'es' && (
                                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-36 border-r border-slate-200">Inventario</th>
                                  )}
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 border-r border-slate-200">{activeView === 'recepcion' ? 'Recibió' : 'Realizó'}</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-40">Observaciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {registros.map(reg => {
                                    const det = reg.detalles || {};
                                    const areaNorm = normalizeMovimientoArea(reg.area);
                                    const esEntrada = areaNorm === 'Entrada';
                                    const empOk = readCriterio(det, 'criterio_empaque', ['empaque_ok']);
                                    const etiOk = readCriterio(det, 'criterio_etiqueta', ['etiqueta_ok']);
                                    const desde = det.proveedor || det.sucursalOrigen || '—';
                                    const hacia = det.sucursalDestino || reg.sucursal || '—';
                                    return (
                                      <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors group">
                                          <td className="px-4 py-3 align-middle text-center font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {reg.fechaString.split('-').reverse().join('/')}
                                          </td>
                                          <td className="px-4 py-3 align-middle font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {det.factura || 'S/N'}
                                          </td>
                                          <td className="px-4 py-3 align-middle border-r border-slate-100">
                                              <p className="font-bold text-xs text-slate-800">{det.compuesto}</p>
                                              <p className="text-[10px] text-slate-500 uppercase mt-0.5">{det.presentacion} • {det.forma}</p>
                                          </td>
                                          <td className="px-4 py-3 align-middle border-r border-slate-100">
                                              <p className="text-[11px] font-semibold text-slate-700 leading-tight">{desde}</p>
                                              <p className="text-[10px] text-slate-400">→ {hacia}</p>
                                          </td>
                                          <td className="px-4 py-3 align-middle font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {det.lote || 'S/N'}
                                          </td>
                                          <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                              <span className={`text-sm font-black ${esEntrada || activeView === 'recepcion' ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                  {esEntrada || activeView === 'recepcion' ? '+' : '-'}{det.cantidad}
                                              </span>
                                          </td>
                                          <td className="px-4 py-3 align-middle text-center font-mono text-[11px] font-bold text-slate-600 border-r border-slate-100">
                                              {det.caducidad ? det.caducidad.split('-').reverse().join('/') : 'N/A'}
                                          </td>
                                          
                                          {activeView === 'recepcion' ? (
                                                <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${empOk === true ? 'text-emerald-600' : empOk === false ? 'text-red-600' : 'text-slate-400'}`}>
                                                            EMP: {empOk === true ? 'CUMPLE' : empOk === false ? 'DAÑO' : 'S/D'}
                                                        </span>
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${etiOk === true ? 'text-emerald-600' : etiOk === false ? 'text-red-600' : 'text-slate-400'}`}>
                                                            ETIQ: {etiOk === true ? 'CUMPLE' : etiOk === false ? 'DAÑO' : 'S/D'}
                                                        </span>
                                                    </div>
                                                </td>
                                          ) : (
                                              <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                                  <Badge variant={esEntrada ? 'ok' : 'preventive'}>{areaNorm}</Badge>
                                              </td>
                                          )}

                                          <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                              {renderAprobacionCell(reg)}
                                          </td>
                                          {activeView === 'es' && (
                                            <td className="px-4 py-3 align-middle text-center border-r border-slate-100">
                                              {renderInventarioCell(reg)}
                                            </td>
                                          )}

                                          <td className="px-4 py-3 align-middle text-[10px] font-bold uppercase text-slate-700 border-r border-slate-100">
                                              {(reg.responsableNombre || '').split(' ')[0]}
                                          </td>
                                          <td className="px-4 py-3 align-middle text-[10px] text-slate-500 italic max-w-[200px] truncate" title={det.observaciones}>
                                              {det.observaciones || '-'}
                                          </td>
                                      </tr>
                                    );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="md:hidden flex flex-col gap-4 overflow-y-auto pb-10">
                            {registros.map(reg => {
                                const det = reg.detalles || {};
                                const areaNorm = normalizeMovimientoArea(reg.area);
                                const esEntrada = areaNorm === 'Entrada';
                                const empOk = readCriterio(det, 'criterio_empaque', ['empaque_ok']);
                                const etiOk = readCriterio(det, 'criterio_etiqueta', ['etiqueta_ok']);
                                const desde = det.proveedor || det.sucursalOrigen || '—';
                                const hacia = det.sucursalDestino || reg.sucursal || '—';
                                
                                return (
                                    <div key={reg.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                            <div className="flex-1 pr-2">
                                                <p className="font-bold text-sm text-slate-800 leading-tight">{det.compuesto}</p>
                                                <p className="text-[10px] text-slate-500 uppercase mt-0.5">{det.presentacion} • {det.forma}</p>
                                                <p className="text-[10px] text-slate-600 mt-1 font-semibold">{desde} → {hacia}</p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-xl text-lg font-black shrink-0 ${esEntrada || activeView === 'recepcion' ? 'bg-slate-100 text-slate-800' : 'bg-rose-50 text-rose-600'}`}>
                                                {esEntrada || activeView === 'recepcion' ? '+' : '-'}{det.cantidad}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-slate-400 font-bold block uppercase">Factura</span>
                                                <span className="text-slate-700 font-mono font-bold block mt-0.5 truncate">{det.factura || 'S/N'}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-slate-400 font-bold block uppercase">Lote</span>
                                                <span className="text-slate-700 font-mono font-bold block mt-0.5 truncate">{det.lote || 'S/N'}</span>
                                            </div>
                                        </div>

                                        {activeView === 'recepcion' && (
                                            <div className="flex gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className={`text-[9px] font-bold uppercase ${empOk === true ? 'text-emerald-600' : empOk === false ? 'text-red-600' : 'text-slate-400'}`}>EMP: {empOk === true ? 'CUMPLE' : empOk === false ? 'DAÑO' : 'S/D'}</span>
                                                <span className={`text-[9px] font-bold uppercase ${etiOk === true ? 'text-emerald-600' : etiOk === false ? 'text-red-600' : 'text-slate-400'}`}>ETIQ: {etiOk === true ? 'CUMPLE' : etiOk === false ? 'DAÑO' : 'S/D'}</span>
                                            </div>
                                        )}

                                        {activeView === 'es' && (
                                            <div className="flex justify-between items-center">
                                                <Badge variant={esEntrada ? 'ok' : 'preventive'}>{areaNorm}</Badge>
                                                {renderInventarioCell(reg)}
                                            </div>
                                        )}

                                        <div className="border-t border-slate-100 pt-2 flex justify-center">
                                          {renderAprobacionCell(reg)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                  );
              })()}

              {/* --- PEDIDOS SUCURSALES ─────────────────────────────────────── */}
              {activeView === 'pedidos' && pedidoModoCatalogo && (
                <div className="flex-1 flex flex-col min-h-0 animate-in fade-in">
                  <div className="shrink-0 mb-4">
                    <button onClick={() => setPedidoModoCatalogo(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm">
                      <ChevronRight size={16} className="rotate-180"/> Volver a Pedidos
                    </button>
                  </div>
                  <CatalogoPedidoManager />
                </div>
              )}

              {activeView === 'pedidos' && !pedidoModoCatalogo && (() => {
                const sucursalesUnicas = catalogoSucursalesJefa.map(s => s.nombre || s.id).sort();

                // Filtrado base
                const pedidosFiltrados = pedidosSucursales.filter(p => {
                  const matchSuc = !pedidoFiltroSucursal || p.sucursal === pedidoFiltroSucursal;
                  const term = pedidosBusqueda.toLowerCase();
                  const matchSearch = !term || 
                    (p.responsableNombre || '').toLowerCase().includes(term) ||
                    (p.sucursal || '').toLowerCase().includes(term) ||
                    (p.fechaString || '').includes(term);
                  return matchSuc && matchSearch;
                });

                // Filtrar por mes seleccionado y agrupar por día
                const [mesAnio, mesNum] = pedidoMesActual.split('-').map(Number);
                const pedidosDelMes = pedidosFiltrados.filter(p => {
                  const d = p.fecha?.toDate?.() || (p.fechaString ? new Date(p.fechaString + 'T12:00:00') : null);
                  if (!d) return false;
                  return d.getFullYear() === mesAnio && (d.getMonth() + 1) === mesNum;
                });

                const diasMap = {};
                pedidosDelMes.forEach(p => {
                  const d = p.fecha?.toDate?.() || new Date(p.fechaString + 'T12:00:00');
                  const key = d.toISOString().slice(0, 10);
                  if (!diasMap[key]) diasMap[key] = [];
                  diasMap[key].push(p);
                });
                const diasOrdenados = Object.keys(diasMap).sort((a, b) => b.localeCompare(a));

                // Helpers de mes
                const mesLabel = new Date(mesAnio, mesNum - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
                const cambiarMes = (delta) => {
                  const d = new Date(mesAnio, mesNum - 1 + delta);
                  setPedidoMesActual(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  setPedidoDiaExpandido(null);
                  setPedidoExpandido(null);
                };

                // Total insumos del mes
                const totalInsumosMes = pedidosDelMes.reduce((sum, p) => sum + (p.detalles?.filas?.length || 0), 0);
                const sucursalesMes = [...new Set(pedidosDelMes.map(p => p.sucursal).filter(Boolean))];

                // Función de impresión (se reutiliza)
                const imprimirPedidos = (pedidosAImprimir) => {
                  const fechaGen = new Date().toLocaleString('es-MX', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
                  const pedidosHtml = pedidosAImprimir.map((pedido, pIdx) => {
                    const fechaStr = pedido.fecha?.toDate?.()
                      ? pedido.fecha.toDate().toLocaleString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : pedido.fechaString || '—';
                    const filas = pedido.detalles?.filas || [];
                    const filasHtml = filas.map((f, i) =>
                      `<tr><td class="cell num">${i+1}</td><td class="cell insumo">${f.insumo}</td><td class="cell cat">${f.categoria||'—'}</td><td class="cell val">${f.fisico||'—'}</td><td class="cell val pedido-col">${f.pedido||'—'}</td></tr>`
                    ).join('');
                    return `<div class="pedido-block${pIdx > 0 ? ' page-break' : ''}"><div class="pedido-header"><div class="pedido-header-left"><div class="sucursal-badge">${pedido.sucursal || 'Sin sucursal'}</div><h2 class="pedido-title">Pedido de Medicamento e Insumos</h2></div><div class="pedido-header-right"><div class="meta-item"><span class="meta-label">Responsable</span><span class="meta-value">${pedido.responsableNombre||'—'}</span></div><div class="meta-item"><span class="meta-label">Fecha</span><span class="meta-value">${fechaStr}</span></div><div class="meta-item"><span class="meta-label">Total</span><span class="meta-value">${filas.length} insumo${filas.length!==1?'s':''}</span></div></div></div><table class="pedido-table"><thead><tr><th class="th" style="width:36px">#</th><th class="th" style="text-align:left">Insumo / Medicamento</th><th class="th" style="width:120px">Categoría</th><th class="th" style="width:72px">Físico</th><th class="th" style="width:72px">Pedido</th></tr></thead><tbody>${filasHtml}</tbody></table><div class="pedido-footer"><div class="firma-box"><div class="firma-line"></div><span>Firma de quien solicita</span></div><div class="firma-box"><div class="firma-line"></div><span>Firma de autorización</span></div></div></div>`;
                  }).join('');
                  const win = window.open('', '_blank');
                  if (!win) return;
                  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pedidos de Medicamento</title><style>@page{margin:16mm 12mm;size:letter}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1e293b;font-size:12px;line-height:1.4}.doc-header{text-align:center;padding-bottom:14px;margin-bottom:20px;border-bottom:3px solid #1e293b}.doc-header h1{font-size:18px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase}.doc-header p{font-size:11px;color:#64748b;margin-top:4px}.pedido-block{margin-bottom:32px}.page-break{page-break-before:always}.pedido-header{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 16px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px 6px 0 0;gap:16px}.pedido-header-left{display:flex;flex-direction:column;gap:4px}.sucursal-badge{display:inline-block;background:#1e293b;color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;padding:3px 10px;border-radius:4px}.pedido-title{font-size:14px;font-weight:700;color:#334155;margin-top:2px}.pedido-header-right{display:flex;gap:20px;text-align:right}.meta-item{display:flex;flex-direction:column}.meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8}.meta-value{font-size:12px;font-weight:700;color:#1e293b}.pedido-table{width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-top:none}.th{padding:7px 10px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;background:#e2e8f0;border-bottom:2px solid #cbd5e1;text-align:center}.cell{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px}.cell.num{text-align:center;color:#94a3b8;font-weight:600;width:36px}.cell.insumo{font-weight:600;color:#1e293b;text-align:left}.cell.cat{text-align:center;color:#64748b;font-size:10px}.cell.val{text-align:center;font-weight:700;color:#334155}.cell.pedido-col{color:#1d4ed8;font-weight:800}tbody tr:nth-child(even){background:#f8fafc}.pedido-footer{display:flex;justify-content:space-between;gap:40px;margin-top:28px;padding:0 20px}.firma-box{text-align:center;flex:1}.firma-line{border-top:1px solid #94a3b8;margin-bottom:6px;margin-top:50px}.firma-box span{font-size:10px;color:#64748b;font-weight:600}.print-btn{position:fixed;bottom:24px;right:24px;padding:14px 28px;background:#1e293b;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:flex;align-items:center;gap:8px}.print-btn:hover{background:#0f172a}@media print{.print-btn{display:none!important}tbody tr:nth-child(even){background:#f8fafc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sucursal-badge{background:#1e293b!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.th{background:#e2e8f0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pedido-header{background:#f1f5f9!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="doc-header"><h1>Reporte de Pedidos de Medicamento</h1><p>Generado el ${fechaGen} — ${pedidosAImprimir.length} pedido${pedidosAImprimir.length!==1?'s':''}</p></div>${pedidosHtml}<button class="print-btn" onclick="window.print()">Imprimir</button></body></html>`);
                  win.document.close();
                };

                if (pedidosLoading) {
                  return (
                    <div className="flex-1 flex items-center justify-center min-h-[400px]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
                        <p className="text-sm font-bold text-slate-400">Cargando pedidos...</p>
                      </div>
                    </div>
                  );
                }

                if (pedidosSucursales.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center border-4 border-blue-100 mb-4">
                        <ClipboardList size={40} className="text-blue-400"/>
                      </div>
                      <h3 className="text-xl font-bold text-slate-700">Sin pedidos registrados</h3>
                      <p className="text-sm text-slate-400 mt-2 text-center max-w-md">Aún no se han realizado pedidos de medicamento desde ninguna sucursal.</p>
                      <button onClick={() => setPedidoModoCatalogo(true)}
                        className="mt-4 flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors shadow-sm">
                        <Package size={16}/> Configurar Catálogo
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="animate-in fade-in flex-1 flex flex-col min-h-0 gap-4">
                    {/* ── Header unificado: nav mes + filtros + acciones ── */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shrink-0 overflow-hidden">
                      {/* Navegador de mes */}
                      <div className="flex items-center justify-between px-5 pt-4 pb-3">
                        <button onClick={() => cambiarMes(-1)}
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-blue-50 flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors">
                          <ChevronRight size={18} className="rotate-180"/>
                        </button>
                        <div className="text-center">
                          <h3 className="text-base font-extrabold text-slate-800 capitalize tracking-tight">{mesLabel}</h3>
                          <div className="flex items-center justify-center gap-3 mt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                              <ClipboardList size={11} className="text-slate-400"/> {pedidosDelMes.length} pedido{pedidosDelMes.length !== 1 ? 's' : ''}
                            </span>
                            <span className="w-px h-3 bg-slate-200"/>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                              <Package size={11} className="text-slate-400"/> {totalInsumosMes} insumos
                            </span>
                            <span className="w-px h-3 bg-slate-200"/>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600">
                              <MapPin size={11}/> {sucursalesMes.length} sucursal{sucursalesMes.length !== 1 ? 'es' : ''}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => cambiarMes(1)}
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-blue-50 flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors">
                          <ChevronRight size={18}/>
                        </button>
                      </div>
                      {/* Separador + filtros */}
                      <div className="border-t border-slate-100 px-4 py-2.5 flex flex-wrap items-center gap-2 bg-slate-50/60">
                        <div className="relative flex-1 min-w-[140px] max-w-xs">
                          <Search size={14} className="absolute left-2.5 top-[9px] text-slate-400"/>
                          <input type="text" placeholder="Buscar..."
                            value={pedidosBusqueda} onChange={e => setPedidosBusqueda(e.target.value)}
                            className="w-full pl-8 pr-3 py-[7px] text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium placeholder:text-slate-300" />
                        </div>
                        <select value={pedidoFiltroSucursal} onChange={e => setPedidoFiltroSucursal(e.target.value)}
                          className="px-2.5 py-[7px] text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 font-semibold text-slate-600">
                          <option value="">Todas</option>
                          {sucursalesUnicas.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button onClick={() => imprimirPedidos(pedidosDelMes)} disabled={pedidosDelMes.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-bold rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors disabled:opacity-35">
                            <Printer size={13}/> Imprimir
                          </button>
                          <button onClick={() => setPedidoModoCatalogo(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm">
                            <Package size={13}/> Catálogo
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Timeline por día ── */}
                    <div className="flex-1 overflow-auto custom-scrollbar">
                      {diasOrdenados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Calendar size={40} className="text-slate-300 mb-3"/>
                          <p className="text-sm font-bold text-slate-400">Sin pedidos en este mes</p>
                          <p className="text-xs text-slate-400 mt-1">Intenta con otro mes o ajusta los filtros.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {diasOrdenados.map(diaKey => {
                            const pedidosDia = diasMap[diaKey];
                            const fechaDia = new Date(diaKey + 'T12:00:00');
                            const diaLabel = fechaDia.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                            const isDiaExpanded = pedidoDiaExpandido === diaKey;
                            const sucursalesDia = [...new Set(pedidosDia.map(p => p.sucursal).filter(Boolean))];
                            const totalInsumosDia = pedidosDia.reduce((s, p) => s + (p.detalles?.filas?.length || 0), 0);

                            return (
                              <div key={diaKey} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header del día */}
                                <button onClick={() => setPedidoDiaExpandido(isDiaExpanded ? null : diaKey)}
                                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition-colors">
                                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-blue-400 uppercase leading-none">{fechaDia.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</span>
                                    <span className="text-lg font-black text-blue-600 leading-none mt-0.5">{fechaDia.getDate()}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 capitalize">{diaLabel}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {sucursalesDia.map(suc => (
                                        <span key={suc} className="inline-flex items-center gap-1 px-1.5 py-px rounded bg-blue-50 border border-blue-100 text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                                          <MapPin size={8}/> {suc}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-bold text-slate-500">{pedidosDia.length} pedido{pedidosDia.length !== 1 ? 's' : ''}</span>
                                    <p className="text-[10px] text-slate-400 font-medium">{totalInsumosDia} insumos</p>
                                  </div>
                                  {isDiaExpanded ? <ChevronUp size={16} className="text-slate-400 shrink-0"/> : <ChevronDown size={16} className="text-slate-400 shrink-0"/>}
                                </button>

                                {/* Pedidos del día expandidos */}
                                {isDiaExpanded && (
                                  <div className="border-t border-slate-100">
                                    {pedidosDia.map(pedido => {
                                      const filas = pedido.detalles?.filas || [];
                                      const totalItems = pedido.detalles?.totalCapturados || filas.length;
                                      const isExpanded = pedidoExpandido === pedido.id;
                                      const horaDisplay = pedido.fecha?.toDate?.()
                                        ? pedido.fecha.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                        : '';

                                      return (
                                        <div key={pedido.id} className="border-b border-slate-50 last:border-b-0">
                                          <button onClick={() => setPedidoExpandido(isExpanded ? null : pedido.id)}
                                            className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-blue-50/30 transition-colors">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                              <ClipboardList size={15} className="text-slate-500"/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="text-[13px] font-bold text-slate-700">{pedido.responsableNombre || 'Sin nombre'}</span>
                                                <span className="px-1.5 py-px rounded bg-slate-100 text-[9px] font-bold text-slate-500 uppercase">{pedido.sucursal || '—'}</span>
                                              </div>
                                              <div className="flex items-center gap-2 mt-0.5">
                                                {horaDisplay && <span className="text-[11px] text-slate-400 font-medium flex items-center gap-0.5"><Clock size={10}/> {horaDisplay}</span>}
                                                <span className="text-[11px] text-slate-400">{totalItems} insumo{totalItems !== 1 ? 's' : ''}</span>
                                              </div>
                                            </div>
                                            {isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0"/> : <ChevronDown size={14} className="text-slate-400 shrink-0"/>}
                                          </button>

                                          {isExpanded && filas.length > 0 && (
                                            <div className="px-5 pb-4 bg-slate-50/40">
                                              <div className="flex justify-end gap-2 mb-2">
                                                <button onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (window.confirm(`¿Eliminar este pedido de ${pedido.sucursal || 'sucursal'}?`)) {
                                                    deleteDoc(doc(db, 'bitacoras_operativas', pedido.id)).then(() => {
                                                      showToast('Pedido eliminado', 'success');
                                                      setPedidoExpandido(null);
                                                    }).catch(() => showToast('Error al eliminar', 'error'));
                                                  }
                                                }}
                                                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors">
                                                  <X size={12}/> Eliminar
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); imprimirPedidos([pedido]); }}
                                                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors">
                                                  <Printer size={12}/> Imprimir
                                                </button>
                                              </div>
                                              <div className="overflow-auto custom-scrollbar rounded-lg border border-slate-200">
                                                <table className="w-full text-sm min-w-[400px]">
                                                  <thead>
                                                    <tr>
                                                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 border-b border-slate-200">Insumo</th>
                                                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 border-b border-slate-200 w-20">Físico</th>
                                                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 border-b border-slate-200 w-20">Pedido</th>
                                                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 border-b border-slate-200 w-24" title="Existencia actual en inventario de la sucursal">Exis. inv.</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {filas.map((fila, idx) => {
                                                      const exisInv = existenciaDeInsumo(fila.insumo, pedido.sucursal);
                                                      return (
                                                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                                        <td className="px-3 py-1.5 font-semibold text-slate-800 text-[12px] border-b border-slate-50">
                                                          {fila.insumo}
                                                          {fila.categoria && <span className="ml-1.5 text-[8px] font-bold uppercase text-slate-400">{fila.categoria}</span>}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center font-bold text-slate-600 text-[12px] border-b border-slate-50">{fila.fisico || '—'}</td>
                                                        <td className="px-3 py-1.5 text-center font-bold text-blue-600 text-[12px] border-b border-slate-50">{fila.pedido || '—'}</td>
                                                        <td className={`px-3 py-1.5 text-center font-bold text-[12px] border-b border-slate-50 ${
                                                          exisInv === null ? 'text-slate-300' : exisInv <= 0 ? 'text-rose-600' : 'text-emerald-700'
                                                        }`}>
                                                          {exisInv === null ? 'S/D' : exisInv}
                                                        </td>
                                                      </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* --- CENTRO DE ALERTAS ────────────────────────────────────────── */}
              {activeView === 'alertas' && (() => {
                  const movFarmacia = bitacorasMes.filter((b) => b.tipo === 'Farmacia');
                  const pendientesAprob = movFarmacia.filter((b) => resolveEstadoAprobacion(b) === 'pendiente');
                  const enTransito = movFarmacia.filter((b) =>
                    normalizeMovimientoArea(b.area) === 'Entrada' && b.estadoInventario === 'pendiente'
                  );
                  const picosPorDia = Object.entries(
                    movFarmacia.reduce((acc, b) => {
                      const key = b.fechaString || 'Sin fecha';
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).slice(0, 3);
                  const maxPico = picosPorDia.length ? picosPorDia[0][1] : 0;

                  const rutaDe = (b) => {
                    const det = b.detalles || {};
                    const de = det.proveedor || det.sucursalOrigen || '—';
                    const a = det.sucursalDestino || b.sucursal || '—';
                    return { de, a, med: det.compuesto || '—', cant: det.cantidad || '—', area: normalizeMovimientoArea(b.area) };
                  };

                  return (
                      <div className="animate-in fade-in flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                        {/* Caducidades (con traspaso) */}
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                          <div className="relative max-w-md shrink-0">
                              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                              <input type="text" placeholder="Buscar medicamento en riesgo..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all shadow-sm font-medium" />
                          </div>

                          {alertasFiltradas.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm min-h-[280px]">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center border-4 border-emerald-100 mb-3">
                                    <CheckCircle2 size={32} className="text-emerald-500"/>
                                </div>
                                <h3 className="text-lg font-bold text-slate-700">Inventario saludable</h3>
                                <p className="text-sm text-slate-400 mt-1.5 text-center max-w-md">Sin medicamentos próximos a caducar en 3 meses.</p>
                            </div>
                          ) : (
                            <>
                            <TableWrap>
                                <thead>
                                    <tr>
                                    <Th>Medicamento</Th>
                                    <Th>Sucursal</Th>
                                    <Th>Lote</Th>
                                    <Th className="text-center">Caducidad</Th>
                                    <Th className="text-center w-24">Días</Th>
                                    <Th className="text-center w-20">Stock</Th>
                                    <Th className="text-center w-24 border-l border-slate-200">Alerta</Th>
                                    <Th className="text-center w-28"></Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alertasFiltradas.map(item => (
                                    <tr key={item.id} className={`transition-colors ${item.riesgo === 'alto' ? 'hover:bg-rose-50/80 bg-rose-50/30' : 'hover:bg-amber-50/80 bg-amber-50/30'}`}>
                                        <Td className="font-bold text-sm text-slate-800">{item.medicamento || item.compuesto}</Td>
                                        <Td className="text-[11px] font-semibold text-slate-600">{item.sucursal || item.sucursalNombre || '—'}</Td>
                                        <Td className="font-mono text-xs font-bold text-slate-500">{item.lote}</Td>
                                        <Td className="text-center font-mono text-xs font-bold text-slate-700">{item.caducidad.split('-').reverse().join('/')}</Td>
                                        <Td className="text-center"><span className={`font-black text-lg ${item.diasRestantes <= 30 ? 'text-rose-600' : 'text-amber-600'}`}>{item.diasRestantes}</span></Td>
                                        <Td className="text-center font-black text-base text-slate-700">{item.stock}</Td>
                                        <Td className="text-center"><Badge variant={item.riesgo === 'alto' ? 'critical' : 'preventive'}>{item.riesgo === 'alto' ? 'Critico' : 'Atención'}</Badge></Td>
                                        <Td className="text-center">
                                          <button
                                            type="button"
                                            onClick={() => setTraspasoItem({
                                              inventarioId: item.id,
                                              medicamentoId: item.medicamentoId || null,
                                              nombre: item.medicamento || item.compuesto || '',
                                              presentacion: item.presentacion || '',
                                              numeroAcomodo: item.numeroAcomodo || '',
                                              lote: item.lote || '',
                                              caducidad: item.caducidad || '',
                                              cantidadDisponible: Number(item.stock) || 0,
                                              sucursalOrigen: item.sucursal || item.sucursalNombre || ''
                                            })}
                                            className="px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase bg-slate-900 text-white hover:bg-slate-800"
                                          >
                                            Traspasar
                                          </button>
                                        </Td>
                                    </tr>
                                    ))}
                                </tbody>
                            </TableWrap>

                            {/* Mobile Alertas Cards */}
                            <div className="md:hidden flex flex-col gap-3 overflow-y-auto pb-4">
                                {alertasFiltradas.map(item => (
                                     <div key={item.id} className={`p-4 rounded-xl border shadow-sm ${item.riesgo === 'alto' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                                         <div className="flex justify-between items-start mb-2">
                                             <h4 className="font-bold text-sm text-slate-800">{item.medicamento || item.compuesto}</h4>
                                             <Badge variant={item.riesgo === 'alto' ? 'critical' : 'preventive'}>{item.riesgo === 'alto' ? 'Critico' : 'Atención'}</Badge>
                                         </div>
                                         <div className="flex justify-between text-xs text-slate-500">
                                             <span>{item.sucursal || '—'} · Lote {item.lote}</span>
                                             <span className="font-bold">{item.diasRestantes} días · {item.stock} pzs</span>
                                         </div>
                                         <button
                                           type="button"
                                           onClick={() => setTraspasoItem({
                                             inventarioId: item.id,
                                             medicamentoId: item.medicamentoId || null,
                                             nombre: item.medicamento || item.compuesto || '',
                                             lote: item.lote || '',
                                             caducidad: item.caducidad || '',
                                             cantidadDisponible: Number(item.stock) || 0,
                                             sucursalOrigen: item.sucursal || item.sucursalNombre || ''
                                           })}
                                           className="mt-2.5 w-full px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase bg-slate-900 text-white"
                                         >
                                           Traspasar a otra sucursal
                                         </button>
                                     </div>
                                ))}
                            </div>
                            </>
                          )}
                        </div>

                        {/* Rutas y actividad del mes */}
                        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3">
                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                              <p className="text-[12px] font-bold text-slate-900">Pendientes de aprobación</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pendientesAprob.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>{pendientesAprob.length}</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                              {pendientesAprob.length === 0 && (
                                <p className="px-3.5 py-3 text-[11px] text-slate-400">Sin movimientos por aprobar.</p>
                              )}
                              {pendientesAprob.slice(0, 8).map((b) => {
                                const r = rutaDe(b);
                                return (
                                  <button key={b.id} type="button" onClick={() => setActiveView(r.area === 'Recepción' ? 'recepcion' : 'es')}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors">
                                    <p className="text-[11px] font-bold text-slate-800 truncate">{r.med} · {r.cant} pzs</p>
                                    <p className="text-[10px] text-slate-500">{r.area}: {r.de} → {r.a} · {b.fechaString}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                              <p className="text-[12px] font-bold text-slate-900">Traspasos en tránsito</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${enTransito.length ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-600'}`}>{enTransito.length}</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                              {enTransito.length === 0 && (
                                <p className="px-3.5 py-3 text-[11px] text-slate-400">Sin entradas por integrar.</p>
                              )}
                              {enTransito.slice(0, 8).map((b) => {
                                const r = rutaDe(b);
                                return (
                                  <button key={b.id} type="button" onClick={() => setActiveView('es')}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors">
                                    <p className="text-[11px] font-bold text-slate-800 truncate">{r.med} · {r.cant} pzs</p>
                                    <p className="text-[10px] text-slate-500">{r.de} → {r.a} · por integrar</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <div className="px-3.5 py-2.5 border-b border-slate-100">
                              <p className="text-[12px] font-bold text-slate-900">Picos de movimiento (mes)</p>
                            </div>
                            <div className="p-3.5 space-y-2">
                              {picosPorDia.length === 0 && (
                                <p className="text-[11px] text-slate-400">Sin movimientos de farmacia este mes.</p>
                              )}
                              {picosPorDia.map(([dia, count]) => (
                                <div key={dia} className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-slate-500 w-16 shrink-0">{dia.split('-').reverse().slice(0, 2).join('/')}</span>
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-800 rounded-full" style={{ width: `${maxPico ? (count / maxPico) * 100 : 0}%` }} />
                                  </div>
                                  <span className="text-[11px] font-black text-slate-800 tabular-nums w-6 text-right">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                  );
              })()}

              {activeView === 'carro_rojo' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 px-4 sm:px-6 pt-4">
                  <CarroRojoJefatura />
                </div>
              )}

              {activeView === 'krit' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 px-4 sm:px-6 pt-4">
                  <KritJefatura />
                </div>
              )}

              {activeView === 'autoclave' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 px-4 sm:px-6 pt-4">
                  <AutoclaveJefatura />
                </div>
              )}

              {activeView === 'almacen' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 px-4 sm:px-6 pt-4">
                  <AlmacenJefatura />
                </div>
              )}

              {activeView === 'caducidades' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 px-4 sm:px-6 pt-4">
                  <CaducidadesJefatura />
                </div>
              )}
          </main>

          {/* ── ZONA DE IMPRESIÓN (PIXEL PERFECT EXCEL FORMAT) ── */}
          <div className="print-zone">
              <PrintFormat />
          </div>

        </div>

        <FiltroBitacorasJefaturaModal
          isOpen={showFiltroBitacoras}
          onClose={() => setShowFiltroBitacoras(false)}
          sourceRows={bitacorasMes}
        />

        {traspasoItem && (
          <TraspasoSucursalModal
            item={traspasoItem}
            onClose={() => setTraspasoItem(null)}
            onDone={handleTraspasoDone}
          />
        )}

      </div>
    </>
  );
};

export default DashboardJefaEnfermeria;