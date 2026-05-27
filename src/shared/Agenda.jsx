import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar as CalIcon, Clock, Users, Plus, ChevronLeft, ChevronRight, 
  Search, MapPin, CheckCircle, XCircle, Video, MessageCircle, 
  AlertTriangle, Activity, CalendarDays, LayoutGrid,
  ShieldCheck, AlertCircle, Zap, FileText, Check, Info,
  Lock, Stethoscope, TrendingUp, Syringe, ChevronDown, ClipboardList, RefreshCw, Newspaper, ExternalLink, Send, BellRing, LogOut,
  CalendarClock, MessageSquare, LogIn, GitMerge, Edit3, Pill, Upload, BookOpen
} from 'lucide-react';
import { db, functions, storage } from '../config/firebase'; 
import { collection, addDoc, query, where, orderBy, updateDoc, doc, getDocs, getDoc, onSnapshot, serverTimestamp, setDoc, deleteField, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../context/AuthContext';
import { useSessionLocation } from '../context/SessionLocationContext';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '../services/permissionService';
import ModalPaciente from '../components/ModalPaciente';
import ModalUnificarExpedientes from '../components/ModalUnificarExpedientes';
import CustomDropdown from '../components/CustomDropdown';
import ModalCatalogoMedicamentos from '../components/ModalCatalogoMedicamentos';
import sonidoCampana from '../assets/notificaciondeconsulta.wav';
import { getEstadoDetallado } from '../utils/citaStatus';

const NOTICIAS_FALLBACK = [
  {
    titulo: 'Actualización en control de hipertensión 2026',
    resumen: 'Se refuerza priorizar medición domiciliaria y ajuste temprano en pacientes con riesgo cardiovascular.',
    categoria: 'Cardiología',
    impacto: 'alto',
    fuente: 'Organización Mundial de la Salud',
    url: 'https://www.who.int'
  },
  {
    titulo: 'Aumento de infecciones respiratorias estacionales',
    resumen: 'Se recomienda vigilancia de signos de alarma y reforzar vacunación en grupos vulnerables.',
    categoria: 'Epidemiología',
    impacto: 'alto',
    fuente: 'CDC',
    url: 'https://www.cdc.gov'
  },
  {
    titulo: 'Optimización del uso de antibióticos en consulta externa',
    resumen: 'Nuevas guías promueven prescripción más precisa para reducir resistencia antimicrobiana.',
    categoria: 'Infectología',
    impacto: 'medio',
    fuente: 'The Lancet',
    url: 'https://www.thelancet.com'
  },
  {
    titulo: 'Tamizaje metabólico en primer nivel',
    resumen: 'Mayor énfasis en detección oportuna de prediabetes con seguimiento estructurado.',
    categoria: 'Medicina interna',
    impacto: 'medio',
    fuente: 'Secretaría de Salud México',
    url: 'https://www.gob.mx/salud'
  }
];

const DOMINIOS_FUENTES_CONFIABLES = [
  'who.int',
  'cdc.gov',
  'nih.gov',
  'gob.mx',
  'nejm.org',
  'thelancet.com',
  'jamanetwork.com',
  'bmj.com',
  'scielo.org',
  'cochranelibrary.com',
  'medscape.com'
];

/* ─── ESTILOS GLOBALES ─────────────────────────────────────────── */
/* ─── ESTILOS GLOBALES (VERSIÓN ALTO RENDIMIENTO) ──────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* Paleta Premium "Clinical Cerulean" */
    --blue-50:  #F2F8FB;
    --blue-100: #DFF0F7;
    --blue-200: #BCE0EF;
    --blue-300: #8CCAE4;
    --blue-400: #5CB4D8;
    --blue-500: #2998C6;
    --blue-600: #0077B6;
    --blue-700: #005B8E;
    --blue-800: #00436B;
    --blue-900: #002E4C;
    
    /* Slate profesional */
    --slate-50:  #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --slate-900: #0f172a;
    
    /* Estados */
    --emerald-500: #059669;
    --rose-500: #e11d48;
    --amber-500: #d97706;
    
    --surface: #ffffff;
    --bg: #f4f7f9;
    
    --radius: 12px;
    --radius-lg: 16px;
    
    /* OPTIMIZACIÓN: Sombras de una sola capa para máximo rendimiento */
    --shadow-sm: 0 1px 2px rgba(15,23,42,.05);
    --shadow-md: 0 4px 6px rgba(15,23,42,.06);
    --shadow-lg: 0 10px 15px rgba(15,23,42,.08);
    --shadow-blue: 0 4px 12px rgba(0,119,182,.15);
  }

  html, body, #root { height: 100%; }

  .agenda-root {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--bg);
    color: var(--slate-800);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* OPTIMIZACIÓN: Se eliminó el pseudo-elemento ::before con gradientes pesados */

  .sora { font-family: 'Sora', system-ui, sans-serif; }

  /* ── SCROLLBAR ── */
  .scroll::-webkit-scrollbar { width: 6px; }
  .scroll::-webkit-scrollbar-track { background: transparent; }
  .scroll::-webkit-scrollbar-thumb { background: var(--slate-300); border-radius: 99px; }
  .scroll::-webkit-scrollbar-thumb:hover { background: var(--slate-400); }

  /* ── HEADER ── */
  .app-header {
    position: relative;
    z-index: 30;
    background: #ffffff;
    border-bottom: 1px solid var(--slate-200);
    box-shadow: var(--shadow-sm);
    padding: 0 24px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 12px;
  }

  .header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }

  .user-avatar {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--blue-500) 0%, var(--blue-700) 100%);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 700; font-size: 15px;
    font-family: 'Sora', sans-serif;
    box-shadow: 0 2px 8px rgba(0,119,182,.2);
    flex-shrink: 0;
  }

  .user-info { min-width: 0; }
  .user-name {
    font-family: 'Sora', sans-serif;
    font-size: 14px; font-weight: 700;
    color: var(--slate-900); line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .user-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; }

  .badge-branch {
    display: inline-flex; align-items: center; gap: 3px;
    background: var(--slate-50); border: 1px solid var(--slate-200);
    border-radius: 5px; padding: 1px 6px;
    font-size: 9px; font-weight: 700; color: var(--slate-500);
    text-transform: uppercase; letter-spacing: .06em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 180px;
  }

  .badge-consultorio-name {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--blue-100); border: 1px solid var(--blue-300);
    border-radius: 6px; padding: 2px 8px;
    font-size: 11px; font-weight: 700; color: var(--blue-700);
    letter-spacing: .03em; white-space: nowrap;
    vertical-align: middle; margin-left: 8px;
    box-shadow: 0 1px 3px rgba(0,119,182,.10);
  }

  .status-online {
    display: flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 600; color: var(--emerald-500);
    white-space: nowrap;
  }

  .dot-pulse {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--emerald-500);
    box-shadow: 0 0 0 0 rgba(5,150,105,.5);
    animation: pulse-ring 1.8s ease infinite;
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(5,150,105,.5); }
    70%  { box-shadow: 0 0 0 5px rgba(5,150,105,0); }
    100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
  }

  /* ── HEADER CENTER ── */
  .header-center {
    display: flex; align-items: center; gap: 8px;
    flex: 0 0 auto;
  }

  .header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  /* ── VIEW SWITCHER ── */
  .view-switcher {
    display: flex; background: var(--slate-100);
    border: 1px solid var(--slate-200); border-radius: 8px;
    padding: 2px; gap: 2px;
  }
  .view-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 6px;
    font-size: 11px; font-weight: 600;
    border: none; cursor: pointer;
    transition: all .18s ease;
    color: var(--slate-500); background: transparent;
  }
  .view-btn.active {
    background: white; color: var(--blue-600);
    box-shadow: var(--shadow-sm);
  }
  .view-btn:not(.active):hover { color: var(--slate-700); }

  .divider-v { width: 1px; height: 28px; background: var(--slate-200); }

  /* ── ICON BUTTON ── */
  .icon-btn {
    position: relative;
    width: 36px; height: 36px; border-radius: 9px;
    border: 1px solid var(--slate-200); background: white;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-500); cursor: pointer;
    transition: all .18s ease;
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
  }
  .icon-btn:hover { color: var(--blue-600); border-color: var(--blue-200); background: var(--blue-50); }
  .icon-btn.icon-btn-green:hover { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
  .icon-btn.icon-btn-purple:hover { color: #7c3aed; border-color: #e9d5ff; background: #faf5ff; }
  .icon-btn.icon-btn-amber:hover { color: #d97706; border-color: #fde68a; background: #fffbeb; }

  .notif-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 16px; height: 16px; border-radius: 50%;
    background: var(--rose-500); color: white;
    font-size: 8px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid white;
    padding: 0 3px;
  }

  /* ── TEXT BUTTONS ── */
  .text-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 12px; border-radius: 8px;
    font-size: 12px; font-weight: 600;
    border: none; cursor: pointer; background: transparent;
    color: var(--slate-600); transition: all .18s ease;
    white-space: nowrap;
  }
  .text-btn:hover { color: var(--blue-600); background: var(--blue-50); }

  .chat-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 12px; border-radius: 8px;
    font-size: 12px; font-weight: 600;
    border: 1px solid #e9d5ff; background: #faf5ff;
    color: #7c3aed; cursor: pointer; transition: all .18s ease;
  }
  .chat-btn:hover { background: #f3e8ff; border-color: #d8b4fe; }

  /* ── PRIMARY BUTTON ── */
  .btn-primary {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 9px;
    font-size: 12px; font-weight: 700;
    font-family: 'Sora', sans-serif;
    background: var(--blue-600); color: white; border: none;
    cursor: pointer; box-shadow: var(--shadow-blue);
    transition: all .18s ease;
    white-space: nowrap;
  }
  .btn-primary:hover { background: var(--blue-700); transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: .6; cursor: not-allowed; transform: none; }

  .btn-notify {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 9px;
    font-size: 12px; font-weight: 700;
    font-family: 'Sora', sans-serif;
    background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none;
    cursor: pointer; box-shadow: 0 2px 8px rgba(22,163,74,.25);
    transition: all .18s ease;
    white-space: nowrap;
  }
  .btn-notify:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(22,163,74,.3); }
  .btn-notify:active { transform: translateY(0); }
  .btn-notify:disabled { opacity: .6; cursor: not-allowed; transform: none; }

  /* ── HEADER CONSULTORIO SELECT ── */
  .header-select {
    height: 34px; padding: 0 28px 0 10px;
    font-size: 11px; font-weight: 600;
    border: 1px solid var(--slate-200); border-radius: 8px;
    background: white; color: var(--slate-700);
    cursor: pointer; min-width: 160px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    transition: all .18s ease;
  }
  .header-select:hover { border-color: var(--blue-300); }
  .header-select:focus { outline: none; border-color: var(--blue-400); box-shadow: 0 0 0 3px rgba(59,130,246,.1); }

  /* ── MAIN CONTENT ── */
.main-content {
    flex: 1; overflow: hidden;
    position: relative; z-index: 10;
    /* Arriba 12px, Derecha 24px, Abajo 24px, Izquierda 24px */
    padding: 12px 24px 24px 24px; 
    display: flex; gap: 20px;
  }

  /* ── PANELS ── */
  .panel {
    background: white;
    border: 1px solid rgba(226,232,240,.8);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
  }

  /* ── LEFT SIDEBAR ── */
  .sidebar-left {
    width: 260px; flex-shrink: 0;
    display: flex; flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  /* ── CALENDAR WIDGET ── */
  .cal-widget {
    padding: 24px; text-align: center;
    position: relative; overflow: hidden;
    flex-shrink: 0;
  }

  .cal-nav {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
  }
  .cal-nav-btn {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--slate-200); background: white;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--slate-500); transition: all .15s;
  }
  .cal-nav-btn:hover { color: var(--blue-600); border-color: var(--blue-200); background: var(--blue-50); }
  .cal-month {
    font-size: 11px; font-weight: 700; color: var(--slate-500);
    text-transform: uppercase; letter-spacing: .08em;
  }

  .cal-day-number {
    font-family: 'Sora', sans-serif;
    font-size: 64px; font-weight: 800;
    line-height: 1; color: var(--slate-900);
    letter-spacing: -3px;
    margin-bottom: 6px;
  }
  .cal-weekday {
    font-size: 12px; font-weight: 600;
    color: var(--slate-500); text-transform: uppercase; letter-spacing: .08em;
  }

  /* ── FINANCE WIDGET ── */
  .finance-widget {
    padding: 20px;
    flex: 1;
    display: flex; flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }
  .widget-label {
    font-size: 10px; font-weight: 700;
    color: var(--slate-400); text-transform: uppercase;
    letter-spacing: .1em; margin-bottom: 16px;
    display: flex; align-items: center; gap: 6px;
  }
  .finance-main {
    background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
    border-radius: 12px; padding: 20px;
    color: white; margin-bottom: 12px;
    position: relative; overflow: hidden;
    box-shadow: var(--shadow-md);
  }
  .finance-main::after {
    content: '$'; position: absolute;
    top: -10px; right: 10px;
    font-size: 80px; font-weight: 800;
    opacity: .05; font-family: 'Sora', sans-serif;
  }
  .finance-main-label {
    font-size: 10px; font-weight: 600; opacity: .8;
    letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px;
  }
  .finance-main-value {
    font-family: 'Sora', sans-serif;
    font-size: 32px; font-weight: 800; line-height: 1;
  }
  .finance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .finance-cell {
    background: var(--slate-50); border: 1px solid var(--slate-100);
    border-radius: 10px; padding: 12px; text-align: center;
  }
  .finance-cell-label {
    font-size: 9px; color: var(--slate-500); font-weight: 700;
    text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px;
  }
  .finance-cell-value {
    font-family: 'Sora', sans-serif;
    font-size: 15px; font-weight: 700; color: var(--slate-800);
  }
  .finance-stack {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .finance-kpi {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--slate-200);
    background: white;
    min-width: 0;
  }
  .finance-kpi-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--slate-500);
    min-width: 0;
    flex: 1;
  }
  .finance-kpi-value {
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: var(--slate-900);
    flex-shrink: 0;
  }
  .finance-insights {
    margin-top: 10px;
    border-radius: 10px;
    border: 1px dashed var(--slate-300);
    background: var(--slate-50);
    padding: 10px 12px;
  }
  .finance-insights-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--slate-500);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .finance-insight-item {
    font-size: 11px;
    color: var(--slate-700);
    font-weight: 600;
    line-height: 1.4;
    margin-bottom: 4px;
  }
  .finance-insight-item:last-child { margin-bottom: 0; }

  /* ── CENTER: TIMELINE ── */
  .timeline-panel {
    flex: 1; display: flex; flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-lg);
  }
  .timeline-header {
    padding: 20px 28px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid var(--slate-100);
    flex-shrink: 0;
    background: white;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  .timeline-title {
    font-family: 'Sora', sans-serif;
    font-size: 18px; font-weight: 700; color: var(--slate-900);
  }
  .count-badge {
    background: var(--blue-50); border: 1px solid var(--blue-100);
    color: var(--blue-700); font-size: 12px; font-weight: 700;
    padding: 4px 12px; border-radius: 6px;
  }
  .timeline-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .timeline-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
    border: 1px solid;
  }
  .timeline-action-btn {
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
  }
  .timeline-chip-btn {
    background: transparent;
    font-family: inherit;
  }
  .timeline-action-btn:hover {
    transform: translateY(-1px);
    filter: brightness(0.98);
  }
  .timeline-action-btn.active {
    box-shadow: 0 0 0 2px rgba(15,23,42,.08);
  }
  .timeline-action-btn:focus-visible {
    outline: 2px solid var(--blue-300);
    outline-offset: 2px;
  }
  .timeline-chip.now {
    background: var(--blue-50);
    color: var(--blue-700);
    border-color: var(--blue-200);
  }
  .timeline-chip.current {
    background: #ecfeff;
    color: #0f766e;
    border-color: #99f6e4;
  }
  .timeline-chip.warn {
    background: #fffbeb;
    color: #b45309;
    border-color: #fcd34d;
  }
  .timeline-chip.next {
    background: white;
    color: var(--slate-600);
    border-color: var(--slate-200);
  }

  .timeline-body {
    flex: 1; overflow-y: auto;
    padding: 24px 28px 80px;
    background: white;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    scroll-behavior: smooth;
  }

  /* ── EMPTY STATE ── */
  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 240px;
    color: var(--slate-400); gap: 12px;
  }
  .empty-icon {
    width: 56px; height: 56px; border-radius: 16px;
    background: var(--slate-50); border: 1px solid var(--slate-100);
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-400);
  }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--slate-500); }
  .empty-action {
    font-size: 13px; font-weight: 600; color: var(--blue-600);
    background: none; border: none; cursor: pointer;
    text-decoration: underline; text-underline-offset: 3px;
  }
  .empty-action:hover { color: var(--blue-800); }

  /* ── CITA ROW ── */
  .cita-row {
    display: flex; gap: 0; margin-bottom: 0;
    position: relative;
    transition: opacity .3s ease;
  }
  .cita-row.current-slot::after {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 22px;
    width: 4px;
    background: var(--blue-500);
    border-radius: 0 6px 6px 0;
    animation: pulse-ring 1.8s ease infinite;
  }
  .cita-row.past-slot .cita-time-main { color: var(--slate-400); }
  .cita-row.blocked-slot { background: #fef2f2; }
  .cita-row.blocked-slot .cita-time-main { color: #ef4444; }
  .cita-row.blocked-slot .cita-node { background: #fca5a5 !important; border-color: #f87171 !important; }
  .cita-row.completed { opacity: .5; }
  .cita-row.completed:hover { opacity: 1; }

  /* ── Pill interactiva para bloqueo ── */
  .cita-time-pill {
    cursor: pointer;
    position: relative;
    border-radius: 10px;
    transition: background .15s, box-shadow .15s;
    margin: 4px 0;
    padding-top: 14px;
    padding-bottom: 6px;
    padding-left: 8px;
  }
  .cita-time-pill:hover {
    background: var(--slate-100, #f1f5f9);
    box-shadow: 0 0 0 2px var(--slate-300, #cbd5e1);
  }
  .cita-time-pill:hover .pill-checkbox {
    border-color: var(--slate-400, #94a3b8);
    background: var(--slate-50, #f8fafc);
  }
  .cita-time-pill:active {
    transform: scale(0.97);
  }
  .cita-time-pill.pill-selected {
    background: var(--red-50, #fef2f2);
    box-shadow: 0 0 0 2px var(--red-400, #f87171);
  }
  .cita-time-pill.pill-selected.pill-blocked {
    background: var(--green-50, #f0fdf4);
    box-shadow: 0 0 0 2px var(--green-400, #4ade80);
  }
  .cita-time-pill.pill-blocked:not(.pill-selected) {
    background: var(--red-50, #fef2f2);
  }
  /* Checkbox visual en la pill */
  .pill-checkbox {
    position: absolute;
    top: 5px;
    right: 3px;
    width: 12px;
    height: 12px;
    border-radius: 4px;
    border: 1.5px solid var(--slate-300, #cbd5e1);
    background: white;
    transition: border-color .15s, background .15s;
  }
  .cita-time-pill.pill-selected .pill-checkbox { display: none; }

  /* Línea vertical continua */
  .cita-row::before {
    content: '';
    position: absolute;
    left: 88px;
    top: 0; bottom: -1px;
    width: 2px;
    background: var(--slate-100);
  }
  .cita-row:last-child::before { bottom: 24px; }

  .cita-time {
    width: 80px; flex-shrink: 0;
    text-align: right; padding-right: 20px;
    padding-top: 18px;
  }
  .cita-time-main {
    font-family: 'Sora', sans-serif;
    font-size: 14px; font-weight: 700; color: var(--slate-800);
    display: block; line-height: 1.2;
  }
  .cita-time-ampm {
    font-size: 9px; font-weight: 700; color: var(--slate-400);
    text-transform: uppercase; letter-spacing: .08em;
  }
  .cita-time-range {
    display: block;
    margin-top: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .06em;
    color: var(--slate-400);
  }
  .slot-empty {
    min-height: 56px;
    margin-bottom: 16px;
    border-radius: 10px;
    border: 1px dashed var(--slate-200);
    background: var(--slate-50);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--slate-400);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .cita-node-col {
    display: flex; flex-direction: column; align-items: center;
    padding-top: 20px; padding-right: 20px; padding-left: 7px;
    flex-shrink: 0; position: relative; z-index: 2;
  }
  .cita-node {
    width: 14px; height: 14px; border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 0 2px var(--slate-200);
    flex-shrink: 0;
    transition: all .2s;
  }
  .node-pending { background: var(--slate-400); box-shadow: 0 0 0 2px var(--slate-200); }
  .node-waiting {
    background: var(--blue-500);
    box-shadow: 0 0 0 3px rgba(41,152,198,.2);
    animation: node-pulse 1.8s ease infinite;
  }
  .node-done { background: var(--emerald-500); box-shadow: 0 0 0 2px var(--slate-200); }
  .node-cancelled { background: #f87171; box-shadow: 0 0 0 2px #fecaca; }

  @keyframes node-pulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(41,152,198,.2); }
    50%      { box-shadow: 0 0 0 6px rgba(41,152,198,.1); }
  }

  /* ── CITA CARD ── */
  .cita-card {
    flex: 1; padding: 16px; margin-bottom: 16px;
    border-radius: 12px; border: 1px solid var(--slate-200);
    background: white;
    display: flex; justify-content: space-between; align-items: center;
    cursor: default; transition: all .2s ease;
    gap: 16px;
  }
  .cita-card:hover { border-color: var(--slate-300); box-shadow: var(--shadow-sm); }
  .cita-card.cancelled {
    background: #fef2f2 !important; border-color: #fecaca !important;
    opacity: 0.55;
  }
  .cita-card.cancelled:hover { opacity: 0.8; border-color: #f87171 !important; }
  .cita-card.cancelled .cita-name { text-decoration: line-through; color: var(--red-400); }
  .cita-card.cancelled .cita-actions { opacity: 0.3; pointer-events: none; }
  .cita-card.waiting {
    background: var(--blue-50); border-color: var(--blue-200);
  }
  .cita-card.waiting:hover { border-color: var(--blue-300); }
  .cita-card.done { background: var(--slate-50); border-style: solid; border-color: var(--slate-200); }
  .cita-card.overdue {
    background: #fff7ed;
    border-color: #fdba74;
  }
  .cita-card.overdue:hover {
    border-color: #fb923c;
    box-shadow: 0 8px 18px rgba(251, 146, 60, 0.18);
  }

  /* ── SIGUIENTE PACIENTE ── */
  .cita-card.siguiente {
    border: 2px solid var(--blue-500);
    background: white;
    box-shadow: 0 8px 24px rgba(0,119,182,0.1);
    transform: scale(1.01);
    position: relative;
    z-index: 10;
  }
  .badge-siguiente {
    position: absolute; top: -12px; left: 16px;
    background: var(--blue-600); color: white;
    font-size: 10px; font-weight: 800; padding: 4px 12px;
    border-radius: 6px; text-transform: uppercase;
    letter-spacing: 0.08em; display: flex; align-items: center; gap: 6px;
    box-shadow: var(--shadow-sm);
  }

  .cita-name {
    font-family: 'Sora', sans-serif;
    font-size: 15px; font-weight: 700; color: var(--slate-900);
    margin-bottom: 6px; line-height: 1.2;
  }
  .cita-name.done-name { text-decoration: line-through; color: var(--slate-500); }

  .cita-tags { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
    text-transform: uppercase; letter-spacing: .04em;
  }
  .tag-motivo    { color: var(--slate-600); background: var(--slate-100); border: 1px solid var(--slate-200); }
  .tag-waiting   { background: white; color: var(--blue-700); border: 1px solid var(--blue-200); }
  .tag-en-espera { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  .tag-pending   { background: white; color: var(--amber-500); border: 1px solid #fde68a; }
  .tag-overdue   { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; }
  .tag-done      { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .tag-tele      { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
  .tag-triage    { background: #f5f3ff; color: #5b21b6; border: 1px solid #ddd6fe; }
  .tag-en-consulta { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

  /* ── CITA ACTIONS ── */
  .cita-actions {
    display: flex; align-items: center; gap: 6px;
    opacity: 0; transition: opacity .18s;
    flex-shrink: 0;
  }
  .cita-row:hover .cita-actions { opacity: 1; }

  .act-btn {
    width: 34px; height: 34px; border-radius: 8px;
    border: 1px solid var(--slate-200); background: white;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--slate-500);
    transition: all .15s; flex-shrink: 0;
  }
  .act-btn:hover { color: var(--blue-600); border-color: var(--blue-300); background: var(--blue-50); }
  .act-btn.green:hover  { color: var(--emerald-500); border-color: #a7f3d0; background: #ecfdf5; }
  .act-btn.red:hover    { color: var(--rose-500); border-color: #fecdd3; background: #fff1f2; }

  .act-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 8px;
    font-size: 11px; font-weight: 700; cursor: pointer;
    border: 1px solid; transition: all .15s;
    white-space: nowrap;
  }
  .act-pill-blue {
    background: var(--blue-600); color: white; border-color: var(--blue-600);
    box-shadow: var(--shadow-sm);
  }
  .act-pill-blue:hover { background: var(--blue-700); }
  .act-pill-rose { background: white; color: var(--rose-500); border-color: #fecdd3; }
  .act-pill-rose:hover { background: #fff1f2; }

  /* ── RIGHT SIDEBAR: INVENTORY ── */
  .sidebar-right {
    width: 272px; flex-shrink: 0;
    display: flex; flex-direction: column;
  }
  .inv-panel {
    flex: 1; display: flex; flex-direction: column; overflow: hidden;
  }
  .inv-header {
    padding: 18px 20px; border-bottom: 1px solid var(--slate-100);
    flex-shrink: 0;
  }
  .inv-title {
    font-size: 11px; font-weight: 700; color: var(--slate-800);
    text-transform: uppercase; letter-spacing: .08em;
    display: flex; align-items: center; gap: 7px; margin-bottom: 3px;
  }
  .inv-sub { font-size: 11px; color: var(--slate-500); font-weight: 500; }
  .inv-list { flex: 1; overflow-y: auto; padding: 12px; }

  .inv-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px; border-radius: 10px;
    border: 1px solid var(--slate-200); background: white;
    margin-bottom: 8px; transition: all .15s; cursor: default;
  }
  .inv-item:hover { border-color: #fecdd3; background: #fff1f2; }
  .inv-item-name {
    font-size: 12px; font-weight: 700; color: var(--slate-900);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 3px; max-width: 140px;
  }
  .inv-item-lot { font-size: 10px; color: var(--slate-500); font-weight: 500; }
  .inv-days {
    border-radius: 8px; padding: 6px 10px; text-align: center; flex-shrink: 0;
  }
  .inv-days.high { background: #fff1f2; border: 1px solid #fecdd3; }
  .inv-days.mid  { background: #fffbeb; border: 1px solid #fde68a; }
  .inv-days-num {
    font-family: 'Sora', sans-serif;
    font-size: 16px; font-weight: 800; line-height: 1;
  }
  .inv-days.high .inv-days-num { color: var(--rose-500); }
  .inv-days.mid  .inv-days-num { color: var(--amber-500); }
  .inv-days-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .inv-days.high .inv-days-label { color: #fca5a5; }
  .inv-days.mid  .inv-days-label { color: #fcd34d; }

  .inv-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 8px; color: var(--emerald-500); opacity: .7;
  }
  .inv-empty-text { font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: .06em; }

  /* ── TOOL BUTTONS ── */
  .tool-btn {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; padding: 16px 8px;
    background: white; border: 1px solid var(--slate-200);
    border-radius: 10px; cursor: pointer;
    transition: all .18s ease;
    box-shadow: var(--shadow-sm);
  }
  .tool-btn:hover {
    border-color: var(--blue-200); background: var(--blue-50);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .tool-btn:active { transform: translateY(0); }
  .tool-btn-icon {
    width: 36px; height: 36px; border-radius: 9px;
    background: var(--slate-50); border: 1px solid var(--slate-100);
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-500); transition: all .18s ease;
  }
  .tool-btn:hover .tool-btn-icon {
    background: var(--blue-100); border-color: var(--blue-200);
    color: var(--blue-600);
  }
  .tool-btn-label {
    font-size: 10px; font-weight: 700; color: var(--slate-600);
    text-transform: uppercase; letter-spacing: .06em;
  }
  .tool-btn:hover .tool-btn-label { color: var(--blue-700); }

  /* ── NOTIF DROPDOWN ── */
  .notif-dropdown {
    position: absolute; right: 0; top: calc(100% + 10px);
    width: 320px; background: white;
    border-radius: 12px; box-shadow: var(--shadow-lg);
    border: 1px solid var(--slate-200);
    overflow: hidden; z-index: 100;
    animation: dropdown-in .15s ease;
  }
  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .notif-hdr {
    padding: 14px 16px;
    background: var(--slate-50); border-bottom: 1px solid var(--slate-100);
    display: flex; justify-content: space-between; align-items: center;
  }
  .notif-hdr-title { font-size: 13px; font-weight: 700; color: var(--slate-900); font-family: 'Sora', sans-serif; }
  .notif-hdr-badge {
    font-size: 10px; font-weight: 700;
    background: var(--blue-100); color: var(--blue-700);
    padding: 2px 8px; border-radius: 4px;
  }
  .notif-item {
    padding: 12px 16px; border-bottom: 1px solid var(--slate-50);
    display: flex; gap: 10px; cursor: pointer; transition: background .12s;
  }
  .notif-item:hover { background: var(--blue-50); }
  .notif-list {
    max-height: 460px;
    overflow-y: auto;
  }
  .notif-avatar {
    width: 34px; height: 34px; border-radius: 8px;
    background: var(--blue-100); color: var(--blue-600);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .notif-name { font-size: 13px; font-weight: 700; color: var(--slate-900); margin-bottom: 2px; }
  .notif-desc { font-size: 11px; color: var(--slate-500); }
  .notif-source {
    margin-top: 6px;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .notif-source-ok { color: var(--emerald-500); }
  .notif-source-warn { color: var(--amber-500); }
  .notif-link {
    color: var(--blue-600);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .notif-link:hover { text-decoration: underline; }
  .notif-empty {
    padding: 28px; text-align: center; color: var(--slate-500);
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .notif-empty p { font-size: 13px; font-weight: 600; }

  /* ── WEEKLY VIEW ── */
  .weekly-panel {
    flex: 1; display: flex; flex-direction: column;
    overflow: hidden; border-radius: var(--radius-lg);
    background: white; border: 1px solid rgba(226,232,240,.8);
    box-shadow: var(--shadow-md);
  }
  .weekly-scroll {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .weekly-header {
    display: grid; border-bottom: 1px solid var(--slate-200);
    background: white; flex-shrink: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    position: relative; z-index: 2;
    box-shadow: var(--shadow-sm);
  }
  .weekly-header-cell { padding: 16px 8px; text-align: center; border-right: 1px solid var(--slate-100); }
  .weekly-header-cell:last-child { border-right: none; }
  .wday-name { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
  .wday-num {
    width: 36px; height: 36px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700;
    margin: 0 auto;
  }
  .wday-today { background: var(--blue-600); color: white; box-shadow: var(--shadow-sm); }
  .wday-other { color: var(--slate-800); }
  .weekly-body { flex: 1; overflow-y: auto; }
  .weekly-row { display: grid; border-bottom: 1px solid var(--slate-100); min-height: 88px; }
  .weekly-hour-cell {
    padding: 12px 14px 12px 0;
    text-align: right; border-right: 1px solid var(--slate-100);
    font-size: 11px; font-weight: 600; color: var(--slate-500);
    background: white; position: relative;
  }
  .weekly-hour-cell.now { color: var(--blue-600); font-weight: 700; }
  .weekly-day-cell {
    padding: 8px; border-right: 1px solid var(--slate-50);
    transition: background .12s; cursor: pointer; position: relative;
  }
  .weekly-day-cell:last-child { border-right: none; }
  .weekly-day-cell:hover { background: var(--blue-50); }
  .weekly-add-hint {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .15s; pointer-events: none;
  }
  .weekly-day-cell:hover .weekly-add-hint { opacity: 1; }
  .weekly-add-icon {
    width: 28px; height: 28px; border-radius: 6px;
    background: white; border: 1px solid var(--blue-300);
    display: flex; align-items: center; justify-content: center;
    color: var(--blue-600); box-shadow: var(--shadow-sm);
  }
  .weekly-cita {
    padding: 6px 8px; border-radius: 6px; font-size: 11px;
    border: 1px solid; margin-bottom: 4px; cursor: pointer;
    transition: all .12s; position: relative; z-index: 1;
  }
  .weekly-cita-name { font-weight: 700; font-family: 'Sora', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .weekly-cita-motivo { font-size: 9px; color: inherit; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .wc-default { background: white; border-color: var(--slate-300); color: var(--slate-800); }
  .wc-default:hover { border-color: var(--blue-400); box-shadow: var(--shadow-sm); }
  .wc-waiting { background: var(--blue-50); border-color: var(--blue-200); color: var(--blue-800); }
  .wc-done    { background: var(--slate-50); border-color: var(--slate-200); color: var(--slate-500); text-decoration: line-through; opacity: .8; }

  /* ── DETAIL MODAL (Emergente) ── */
  .detail-overlay {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    padding: 16px;
  }
  .detail-overlay.open { pointer-events: all; }
  .detail-backdrop {
    position: absolute; inset: 0;
    background: rgba(15,23,42,.6); /* OPTIMIZACIÓN: Oscurecido, sin blur */
    opacity: 0; transition: opacity .3s ease;
  }
  .detail-overlay.open .detail-backdrop { opacity: 1; }

  .detail-drawer {
    position: relative; z-index: 1;
    width: 100%; max-width: 440px; background: white;
    max-height: calc(100vh - 32px);
    border-radius: 24px;
    display: flex; flex-direction: column;
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    transition: all .35s cubic-bezier(.4,0,.2,1);
    box-shadow: 0 25px 50px -12px rgba(15,23,42,.25);
    overflow: hidden;
  }
  .detail-overlay.open .detail-drawer { opacity: 1; transform: translateY(0) scale(1); }

  .drawer-hdr {
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--slate-200);
    position: relative;
  }
  .drawer-close {
    position: absolute; top: 20px; right: 20px;
    width: 34px; height: 34px; border-radius: 8px;
    border: 1px solid var(--slate-200); background: white;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--slate-500); transition: all .15s;
  }
  .drawer-close:hover { color: var(--slate-800); border-color: var(--slate-300); }

  .drawer-meta {
    font-size: 11px; font-weight: 600; color: var(--slate-500);
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  }
  .drawer-name {
    font-family: 'Sora', sans-serif;
    font-size: 20px; font-weight: 800;
    color: var(--slate-900); line-height: 1.15;
  }

  .vitals-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; padding: 16px 24px;
    border-bottom: 1px solid var(--slate-200);
    background: var(--slate-50);
  }
  .vital-card {
    background: white; border: 1px solid var(--slate-200);
    border-radius: 8px; padding: 10px; text-align: center;
  }
  .vital-card.alert { background: #fff1f2; border-color: #fecdd3; }
  .vital-label { font-size: 9px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px; }
  .vital-label.alert-label { color: var(--rose-500); }
  .vital-value { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 800; color: var(--slate-900); }
  .vital-value.alert-value { color: #be123c; }

  .drawer-body { flex: 1; padding: 16px 24px; overflow-y: auto; }

  .locked-state {
    height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    border: 2px dashed var(--slate-300); border-radius: 12px;
    background: var(--slate-50); text-align: center; padding: 32px; gap: 12px;
  }
  .locked-icon {
    width: 52px; height: 52px; border-radius: 12px;
    background: var(--slate-200); display: flex; align-items: center; justify-content: center;
    color: var(--slate-500);
  }
  .locked-title { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; color: var(--slate-800); }
  .locked-desc { font-size: 12px; color: var(--slate-500); }

  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .action-card {
    padding: 14px; border-radius: 10px; border: 1px solid;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    cursor: pointer; transition: all .15s; font-size: 12px; font-weight: 700;
    background: white;
  }
  .action-card-icon {
    width: 36px; height: 36px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    transition: transform .15s;
  }
  .action-card:hover .action-card-icon { transform: scale(1.05); }

  .ac-neutral { border-color: var(--slate-200); color: var(--slate-800); }
  .ac-neutral:hover { background: var(--slate-50); border-color: var(--slate-300); }
  .ac-neutral .action-card-icon { background: var(--slate-100); color: var(--slate-600); }

  .ac-blue { border-color: var(--blue-200); color: var(--blue-900); }
  .ac-blue:hover { background: var(--blue-50); border-color: var(--blue-300); }
  .ac-blue .action-card-icon { background: var(--blue-100); color: var(--blue-700); }

  .drawer-footer {
    padding: 20px 28px; border-top: 1px solid var(--slate-200);
    background: var(--slate-50); display: flex; flex-direction: column; gap: 10px;
  }
  .btn-finish {
    width: 100%; padding: 14px;
    background: var(--slate-900); color: white;
    border: none; border-radius: 10px;
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; box-shadow: var(--shadow-sm);
    transition: all .18s; letter-spacing: .01em;
  }
  .btn-finish:hover { background: var(--slate-800); transform: translateY(-1px); }
  .btn-cancel-cita {
    width: 100%; padding: 12px;
    background: transparent; color: var(--rose-500);
    border: 1px solid #fecdd3; border-radius: 10px;
    font-size: 13px; font-weight: 700; cursor: pointer;
    transition: all .15s;
  }
  .btn-cancel-cita:hover { background: #fff1f2; }

  /* ── MODALS ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(15,23,42,.6); /* OPTIMIZACIÓN: Oscurecido, sin blur */
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal-box {
    background: white; border-radius: 16px;
    width: 100%; max-width: 460px;
    overflow: hidden; box-shadow: var(--shadow-lg);
    animation: modal-in .2s cubic-bezier(.4,0,.2,1);
  }
  @keyframes modal-in {
    from { opacity: 0; transform: scale(.95) translateY(10px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-hdr {
    padding: 22px 28px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid var(--slate-200);
    background: var(--slate-50);
  }
  .modal-title { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 800; color: var(--slate-900); }
  .modal-close { background: none; border: none; cursor: pointer; color: var(--slate-500); transition: color .12s; padding: 4px; }
  .modal-close:hover { color: var(--slate-900); }

  .modal-body { padding: 24px 28px; }
  .form-group { margin-bottom: 18px; }
  .form-label {
    display: block; font-size: 10px; font-weight: 700;
    color: var(--slate-500); text-transform: uppercase;
    letter-spacing: .1em; margin-bottom: 7px;
  }
  .form-input {
    width: 100%; padding: 11px 14px;
    background: white; border: 1px solid var(--slate-300);
    border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--slate-900);
    outline: none; transition: all .15s; font-family: inherit;
  }
  .form-input:focus { border-color: var(--blue-500); box-shadow: 0 0 0 3px rgba(0,119,182,.1); }
  .form-input-icon { position: relative; }
  .form-input-icon .form-input { padding-left: 38px; }
  .form-input-icon svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--slate-400); pointer-events: none; }

  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  .suggest-list {
    position: absolute; top: calc(100% + 6px); left: 0; right: 0;
    background: white; border: 1px solid var(--slate-200);
    border-radius: 8px; box-shadow: var(--shadow-lg);
    max-height: 160px; overflow-y: auto; z-index: 70; padding: 6px;
  }
  .suggest-item {
    padding: 10px 12px; border-radius: 6px; cursor: pointer;
    font-size: 13px; font-weight: 600; color: var(--slate-800);
    transition: background .1s;
  }
  .suggest-item:hover { background: var(--blue-50); color: var(--blue-700); }

  .tele-toggle {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border: 1px solid var(--slate-200);
    border-radius: 8px; cursor: pointer; transition: all .15s;
    background: var(--slate-50);
  }
  .tele-toggle:hover { border-color: var(--blue-300); background: var(--blue-50); }
  .tele-toggle input { accent-color: var(--blue-600); width: 16px; height: 16px; cursor: pointer; }
  .tele-toggle span { font-size: 13px; font-weight: 600; color: var(--slate-800); display: flex; align-items: center; gap: 7px; }

  .btn-submit {
    width: 100%; padding: 14px;
    background: var(--blue-600); color: white;
    border: none; border-radius: 8px;
    font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700;
    cursor: pointer; box-shadow: var(--shadow-sm);
    transition: all .18s; margin-top: 6px; letter-spacing: .01em;
  }
  .btn-submit:hover { background: var(--blue-700); transform: translateY(-1px); }
  .btn-submit:active { transform: translateY(0); }

  /* ── URGENCIA MODAL ── */
  .urg-modal { max-width: 360px; }
  .urg-hdr {
    padding: 32px 28px; text-align: center;
    background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
    border-bottom: 1px solid #fecdd3; display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .urg-icon {
    width: 64px; height: 64px; border-radius: 14px;
    background: white; border: 1px solid #fecdd3;
    display: flex; align-items: center; justify-content: center;
    color: var(--rose-500); box-shadow: var(--shadow-sm);
  }
  .urg-title { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 800; color: #9f1239; }
  .urg-desc { font-size: 13px; color: #be123c; font-weight: 500; }
  .urg-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 20px; }
  .btn-urg-cancel { padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid var(--slate-300); background: white; color: var(--slate-700); transition: all .15s; }
  .btn-urg-cancel:hover { background: var(--slate-50); border-color: var(--slate-400); }
  .btn-urg-confirm { padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: var(--rose-500); color: white; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: var(--shadow-sm); transition: all .15s; }
  .btn-urg-confirm:hover { background: #be123c; }

  /* ── TOAST ── */
  .toast {
    position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
    z-index: 200; display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 50px; box-shadow: var(--shadow-lg);
    font-size: 13px; font-weight: 700; white-space: nowrap;
    animation: toast-in .25s cubic-bezier(.4,0,.2,1);
    border: 1px solid;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .toast-success { background: var(--slate-900); color: white; border-color: var(--slate-800); }
  .toast-error   { background: #fff1f2; color: #be123c; border-color: #fecdd3; }
  .toast-warning { background: #fffbeb; color: #92400e; border-color: #fde68a; }
  .toast-close { background: none; border: none; cursor: pointer; opacity: .6; color: inherit; display: flex; align-items: center; margin-left: 6px; }
  .toast-close:hover { opacity: 1; }

  /* ── SPIN ICON ── */
  .spin-icon { animation: spin-anim .8s linear infinite; }
  @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* ── RESPONSIVE ── */
  @media (max-width: 1200px) {
    .app-header {
      height: auto;
      min-height: 60px;
      padding: 8px 16px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .header-center {
      order: 3;
      width: 100%;
      justify-content: flex-start;
    }
    .header-right {
      flex-wrap: wrap;
      gap: 6px;
    }
    .header-select { min-width: 140px; }
    .main-content {
      overflow-y: auto;
      overflow-x: hidden;
      flex-direction: column;
      padding: 10px 14px 16px 14px;
      gap: 12px;
    }
    .sidebar-left,
    .timeline-panel,
    .sidebar-right {
      width: 100%;
      min-width: 0;
    }
    .timeline-panel {
      order: 1;
      flex: 0 0 auto;
      min-height: 520px;
    }
    .sidebar-left {
      order: 2;
      flex: 0 0 auto;
    }
    .sidebar-right {
      order: 3;
      flex: 0 0 auto;
    }
    .finance-grid { grid-template-columns: 1fr 1fr; }
    .timeline-header {
      padding: 14px 16px;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .timeline-meta {
      width: 100%;
      justify-content: flex-start;
    }
    .timeline-body {
      padding: 14px 16px 64px;
    }
    .cita-actions {
      opacity: 1;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .notif-dropdown {
      right: 0;
      width: min(420px, calc(100vw - 24px));
    }
  }

  @media (max-width: 960px) {
    .user-meta {
      display: none;
    }
    .user-name {
      font-size: 13px;
    }
    .header-center {
      order: 3;
      width: 100%;
    }
    .divider-v {
      display: none;
    }
    .btn-primary,
    .btn-notify {
      padding: 7px 10px;
      font-size: 11px;
    }
    .icon-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
    }
    .header-select {
      min-width: 120px;
      font-size: 10px;
    }
    .timeline-title {
      font-size: 16px;
    }
    .timeline-chip,
    .count-badge {
      font-size: 9px;
      padding: 4px 8px;
    }
    .cita-row {
      flex-direction: column;
      gap: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--slate-100);
      margin-bottom: 10px;
    }
    .cita-row::before {
      display: none;
    }
    .cita-row.current-slot::after {
      left: -8px;
      top: 0;
      bottom: 0;
    }
    .cita-time {
      width: 100%;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      padding-right: 0;
    }
    .cita-time-range {
      margin-top: 0;
    }
    .cita-node-col {
      display: none;
    }
    .cita-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .cita-actions {
      width: 100%;
      justify-content: flex-start;
    }
    .detail-drawer {
      width: min(520px, 100vw);
    }
    .weekly-panel {
      overflow: auto;
    }
    .weekly-scroll {
      min-width: 760px;
    }
    .weekly-body {
      overflow: auto;
    }
  }

  @media (max-width: 640px) {
    .agenda-root {
      height: 100dvh;
    }
    .app-header {
      padding: 8px 10px;
      gap: 6px;
    }
    .header-left {
      gap: 8px;
      min-width: 0;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      font-size: 13px;
      border-radius: 8px;
    }
    .header-right {
      gap: 4px;
      width: 100%;
      justify-content: flex-start;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;
    }
    .header-right::-webkit-scrollbar {
      display: none;
    }
    .header-center {
      overflow-x: auto;
      padding-bottom: 2px;
      -webkit-overflow-scrolling: touch;
    }
    .header-center::-webkit-scrollbar {
      display: none;
    }
    .view-btn {
      padding: 5px 8px;
      font-size: 10px;
    }
    .btn-primary,
    .btn-notify {
      padding: 6px 8px;
      font-size: 10px;
      gap: 4px;
    }
    .btn-primary span,
    .btn-notify span {
      display: none;
    }
    .icon-btn {
      width: 32px;
      height: 32px;
    }
    .header-select {
      min-width: 100px;
      height: 30px;
      font-size: 10px;
    }
    .main-content {
      padding: 8px 8px 12px;
      gap: 10px;
    }
    .cal-widget,
    .finance-widget,
    .inv-header,
    .inv-list {
      padding-left: 12px;
      padding-right: 12px;
    }
    .cal-day-number {
      font-size: 52px;
      letter-spacing: -2px;
    }
    .finance-main {
      padding: 14px;
    }
    .finance-main-value {
      font-size: 26px;
    }
    .finance-grid {
      grid-template-columns: 1fr;
    }
    .timeline-header,
    .timeline-body {
      padding-left: 10px;
      padding-right: 10px;
    }
    .timeline-meta {
      gap: 6px;
    }
    .timeline-chip,
    .count-badge {
      font-size: 8px;
      letter-spacing: .03em;
    }
    .notif-dropdown {
      position: fixed;
      top: 76px;
      right: 8px;
      left: 8px;
      width: auto;
      max-height: calc(100dvh - 90px);
      display: flex;
      flex-direction: column;
    }
    .notif-list {
      max-height: calc(100dvh - 180px);
    }
    .weekly-header-cell {
      padding: 10px 4px;
    }
    .weekly-row {
      min-height: 76px;
    }
    .modal-overlay {
      padding: 8px;
    }
    .modal-hdr,
    .modal-body {
      padding-left: 14px;
      padding-right: 14px;
    }
    .form-grid,
    .action-grid,
    .vitals-grid {
      grid-template-columns: 1fr;
    }
    .drawer-hdr,
    .drawer-body,
    .drawer-footer,
    .vitals-grid {
      padding-left: 14px;
      padding-right: 14px;
    }
  }
`;
/* ─── TOAST ───────────────────────────────────────────────────── */
const Toast = ({ msg, type, onClose }) => (
  <div className={`toast toast-${type}`}>
    {type === 'error' ? <AlertCircle size={15}/> : type === 'warning' ? <AlertTriangle size={15}/> : <ShieldCheck size={15}/>}
    <span>{msg}</span>
    <button className="toast-close" onClick={onClose}><XCircle size={14}/></button>
  </div>
);

/* ─── MAIN COMPONENT ──────────────────────────────────────────── */
const Agenda = () => {
  const [showCatalogoMedicamentos, setShowCatalogoMedicamentos] = useState(false);
  const { user, logout } = useAuth();
  const {
    sessionSucursal, sessionConsultorio,
    catalogoSucursales: sessionCatSucursales,
    catalogoConsultorios: sessionCatConsultorios,
    updateConsultorio: sessionUpdateConsultorio,
    updateSucursal: sessionUpdateSucursal
  } = useSessionLocation();
  const navigate = useNavigate();
  const normalizedRole = String(user?.rol || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const isAdminRole = ['admin', 'admin_maestro', 'administrador'].includes(normalizedRole)
    || hasPermission(user, 'admin.dashboard', ['admin', 'admin_maestro', 'administrador']);
  const isDoctorRole = ['medico', 'doctor'].includes(normalizedRole);
  const canBloquearHorarios = isDoctorRole || isAdminRole;
  const canRotateConsultorio = isDoctorRole || isAdminRole;

  const CATALOGO_MOTIVOS_FALLBACK = [
    { id: 'consulta-general', nombre: 'Consulta', precio: 500, precioMin: 500, precioMax: 500, area: 'Medicina General', categoria: 'Medicina General', duracionMin: 20, teleconsultaPermitida: true, prioridadTriage: 'media', versionPrecio: 1 },
    { id: 'valoracion', nombre: 'Valoración', precio: 600, precioMin: 600, precioMax: 600, area: 'Medicina General', categoria: 'Medicina General', duracionMin: 30, teleconsultaPermitida: true, prioridadTriage: 'media', versionPrecio: 1 },
    { id: 'vacunas', nombre: 'Vacunas', precio: 450, precioMin: 450, precioMax: 450, area: 'Prevención', categoria: 'Prevención', duracionMin: 20, teleconsultaPermitida: false, prioridadTriage: 'baja', versionPrecio: 1 },
    { id: 'urgencia', nombre: 'Nota de urgencia', precio: 900, precioMin: 900, precioMax: 900, area: 'Urgencias', categoria: 'Urgencias', duracionMin: 30, teleconsultaPermitida: false, prioridadTriage: 'alta', versionPrecio: 1 }
  ];
  const CATALOGO_CONSULTORIOS_FALLBACK = [
    {
      id: 'consultorio-1',
      nombre: 'Consultorio 1',
      ubicacion: 'Planta baja',
      especialidad: 'Medicina General',
      horaInicio: '08:00',
      horaFin: '18:00',
      intervaloMin: 10,
      capacidadSimultanea: 1,
      diasAtencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      sucursalId: 'sucursal-central',
      sucursal: user?.sucursalActual || user?.sucursal || 'Central',
      activo: true
    }
  ];
  const CATALOGO_SUCURSALES_FALLBACK = [
    {
      id: 'sucursal-central',
      nombre: user?.sucursalActual || user?.sucursal || 'Central',
      ubicacion: 'Sin especificar',
      telefono: '',
      responsable: '',
      horaApertura: '08:00',
      horaCierre: '20:00',
      timezone: 'America/Mexico_City',
      diasOperacion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
      activo: true
    }
  ];
  const DIAS_SEMANA_INDEX = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const DIAS_SEMANA_COMPLETA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  
  const INTERVALO_MINUTOS = 10;
  const START_HOUR = 0;
  const END_HOUR   = 23;
  // Sumamos 2 al length para que dibuje hasta el bloque que contiene la última hora
  const hours      = Array.from({ length: END_HOUR - START_HOUR + 2 }, (_, i) => START_HOUR + i);

  /* ── STATES ── */
  const [citas, setCitas]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [currentDate, setCurrentDate]       = useState(new Date());
  const [currentTime, setCurrentTime]       = useState(new Date());
  const [audio]                             = useState(new Audio(sonidoCampana));
  const prevCitasLength                     = useRef(0);
  const timelineBodyRef                     = useRef(null);
  const timelineSlotRefs                    = useRef({});
  const [toast, setToast]                   = useState(null);
  const [vista, setVista]                   = useState('dashboard');
  const [timelineFiltro, setTimelineFiltro] = useState('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [noticiasMedicas, setNoticiasMedicas] = useState([]);
  const [noticiasLoading, setNoticiasLoading] = useState(false);
  const [noticiasNoLeidas, setNoticiasNoLeidas] = useState(0);
  const [noticiasActualizadasAt, setNoticiasActualizadasAt] = useState(null);
  const [showCitaModal, setShowCitaModal]   = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [slotsSeleccionados, setSlotsSeleccionados] = useState(new Set());
  const [slotsBloqueados, setSlotsBloqueados] = useState({});  // { slotKey: { justificacion } }
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [showBloqueoModal, setShowBloqueoModal] = useState(null); // 'bloquear' | 'desbloquear' | null
  const [justificacionBloqueo, setJustificacionBloqueo] = useState('');
  const [selectedCita, setSelectedCita]     = useState(null);
  const [citaUrgencia, setCitaUrgencia]     = useState(null);
  const [notificandoPaciente, setNotificandoPaciente] = useState(false);
  const [notificandoCitaId, setNotificandoCitaId] = useState(null);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);
  const [showReprogramar, setShowReprogramar] = useState(false);
  const [reprogramarData, setReprogramarData] = useState({ fecha: '', hora: '', horaFin: '' });
  const [showEditarCita, setShowEditarCita] = useState(false);
  const [editarCitaData, setEditarCitaData] = useState({ paciente: '', motivo: '', motivoId: '', tipoConsulta: '', doctorUid: '', doctorAsignado: '', notas: '' });
  const [showCancelarConfirm, setShowCancelarConfirm] = useState(false);
  const [cancelarMotivo, setCancelarMotivo] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showUnificar, setShowUnificar] = useState(false);
  const [todosLosPacientes, setTodosLosPacientes] = useState([]);
  const [sugerencias, setSugerencias]       = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [alertasCaducidad, setAlertasCaducidad]     = useState([]);
  const [catalogoMotivos, setCatalogoMotivos]       = useState(CATALOGO_MOTIVOS_FALLBACK);
  const [catalogoConsultorios, setCatalogoConsultorios] = useState(CATALOGO_CONSULTORIOS_FALLBACK);
  const [catalogoSucursales, setCatalogoSucursales] = useState(CATALOGO_SUCURSALES_FALLBACK);
  const [catalogoEnfermeros, setCatalogoEnfermeros] = useState([]);
  const [catalogoDoctores, setCatalogoDoctores] = useState([]);
  const [consultorioActivoId, setConsultorioActivoId] = useState('');
  const [guardandoConsultorio, setGuardandoConsultorio] = useState(false);
  const [dragOverCitaId, setDragOverCitaId] = useState(null);
  const [uploadingEstudio, setUploadingEstudio] = useState(false);
  const fileInputRef = useRef(null);
  const toInputDateValue = (dateValue = new Date()) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [nuevaCita, setNuevaCita]           = useState({
    paciente: '', pacienteId: '', pacienteTelefono: '',
    fecha: toInputDateValue(new Date()), hora: '', horaFin: '',
    tipoConsulta: 'primera_vez',
    motivo: CATALOGO_MOTIVOS_FALLBACK[0]?.nombre || 'Consulta',
    motivoId: CATALOGO_MOTIVOS_FALLBACK[0]?.id || '',
    consultorioId: '',
    sucursalId: '',
    esTeleconsulta: false,
    doctorAsignado: isDoctorRole ? user.nombre : '',
    doctorUid: isDoctorRole ? user.uid : '',
    enfermeroAsignadoId: '',
    enfermeroAsignadoNombre: ''
  });

  const consultorioActivo = useMemo(
    () => catalogoConsultorios.find((item) => item.id === consultorioActivoId) || null,
    [catalogoConsultorios, consultorioActivoId]
  );

  const sucursalActivaLabel = sessionSucursal?.nombre || user?.sucursalActual || user?.sucursal || 'Central';
  // sessionConsultorio es la única fuente de verdad: se establece al iniciar sesión y elegir consultorio
  const consultorioActivoLabel = (isDoctorRole ? sessionConsultorio?.nombre : (consultorioActivo?.nombre || '')) || '';

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch {
      showToast('No se pudo cerrar sesión.', 'error');
    }
  };

  /* ── FUNCIONES BLOQUEO DE HORARIOS ── */
  const lastSelectedSlotRef = useRef(null);

  const toggleSlotSeleccionado = (slotStartTime, shiftKey = false) => {
    setSlotsSeleccionados(prev => {
      const next = new Set(prev);

      // Shift+Click: seleccionar rango
      if (shiftKey && lastSelectedSlotRef.current && lastSelectedSlotRef.current !== slotStartTime) {
        const allSlotTimes = timeSlots.map(s => s.startTime);
        const idxA = allSlotTimes.indexOf(lastSelectedSlotRef.current);
        const idxB = allSlotTimes.indexOf(slotStartTime);
        if (idxA !== -1 && idxB !== -1) {
          const start = Math.min(idxA, idxB);
          const end = Math.max(idxA, idxB);
          for (let i = start; i <= end; i++) {
            next.add(allSlotTimes[i]);
          }
          lastSelectedSlotRef.current = slotStartTime;
          return next;
        }
      }

      // Click normal: toggle individual
      if (next.has(slotStartTime)) next.delete(slotStartTime);
      else next.add(slotStartTime);
      lastSelectedSlotRef.current = slotStartTime;
      return next;
    });
  };

  // Determina si la selección actual es para bloquear, desbloquear, o mixta
  const accionBloqueoSeleccion = useMemo(() => {
    if (slotsSeleccionados.size === 0) return null;
    let hayLibres = false, hayBloqueados = false;
    slotsSeleccionados.forEach(s => {
      if (slotsBloqueados[s]) hayBloqueados = true;
      else hayLibres = true;
    });
    if (hayLibres && !hayBloqueados) return 'bloquear';
    if (hayBloqueados && !hayLibres) return 'desbloquear';
    return 'mixto';
  }, [slotsSeleccionados, slotsBloqueados]);

  const confirmarBloqueo = async () => {
    if (!user?.uid) return;
    if (showBloqueoModal === 'bloquear' && !justificacionBloqueo.trim()) {
      showToast('Escribe una justificación para bloquear', 'warning');
      return;
    }
    setGuardandoBloqueo(true);
    try {
      const fechaStr = toInputDateValue(currentDate);
      const docId = `${user.uid}_${fechaStr}`;
      const nuevoSlots = { ...slotsBloqueados };

      if (showBloqueoModal === 'bloquear') {
        slotsSeleccionados.forEach(s => {
          nuevoSlots[s] = { justificacion: justificacionBloqueo.trim(), bloqueadoAt: new Date().toISOString() };
        });
      } else {
        // desbloquear
        slotsSeleccionados.forEach(s => { delete nuevoSlots[s]; });
      }

      const slotsKeys = Object.keys(nuevoSlots).sort();
      if (slotsKeys.length === 0) {
        const { deleteDoc: delDoc } = await import('firebase/firestore');
        await delDoc(doc(db, 'horarios_bloqueados', docId));
      } else {
        await setDoc(doc(db, 'horarios_bloqueados', docId), {
          doctorUid: user.uid,
          doctorNombre: user.nombre || '',
          fecha: fechaStr,
          slots: slotsKeys,
          slotsDetalle: nuevoSlots,
          consultorioId: consultorioActivo?.id || user?.consultorioRecurrenteId || user?.consultorioActualId || user?.consultorioId || '',
          consultorioNombre: consultorioActivo?.nombre || user?.consultorioRecurrente || user?.consultorioActual || user?.consultorio || '',
          actualizadoAt: serverTimestamp()
        });
      }
      const n = slotsSeleccionados.size;
      showToast(
        showBloqueoModal === 'bloquear'
          ? `${n} horario${n > 1 ? 's' : ''} bloqueado${n > 1 ? 's' : ''}`
          : `${n} horario${n > 1 ? 's' : ''} desbloqueado${n > 1 ? 's' : ''}`,
        'success'
      );
      setSlotsSeleccionados(new Set());
      setShowBloqueoModal(null);
      setJustificacionBloqueo('');
    } catch (err) {
      console.error('Error guardando bloqueos:', err);
      showToast('Error al guardar los bloqueos', 'error');
    }
    setGuardandoBloqueo(false);
  };

  const cancelarSeleccion = () => {
    setSlotsSeleccionados(new Set());
  };

  const extraerDominio = (url = '') => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '').toLowerCase();
    } catch {
      return '';
    }
  };

  const validarFuenteNoticia = (item) => {
    const dominio = extraerDominio(item.url || '');
    const fuenteValidada = DOMINIOS_FUENTES_CONFIABLES.some(d => dominio.includes(d));
    return {
      ...item,
      fuente: item.fuente || 'Fuente no especificada',
      url: item.url || '',
      fuenteValidada
    };
  };

  const cargarNoticiasMedicas = async ({ forzar = false } = {}) => {
    if (!user?.uid) return;
    const cacheKey = `noticias_medicas_${user.uid}`;
    const seenKey = `noticias_medicas_seen_${user.uid}`;

    try {
      if (!forzar) {
        const cacheRaw = localStorage.getItem(cacheKey);
        if (cacheRaw) {
          const cache = JSON.parse(cacheRaw);
          const cacheDate = new Date(cache.timestamp || 0);
          const ageMs = Date.now() - cacheDate.getTime();
          if (Array.isArray(cache.items) && ageMs < 6 * 60 * 60 * 1000) {
            setNoticiasMedicas(cache.items);
            setNoticiasActualizadasAt(cache.timestamp);
            const seenAt = new Date(localStorage.getItem(seenKey) || 0).getTime();
            const unread = cache.items.filter(item => new Date(item.fechaGeneracion || cache.timestamp).getTime() > seenAt).length;
            setNoticiasNoLeidas(unread);
            return;
          }
        }
      }
    } catch {}

    setNoticiasLoading(true);
    try {
      const generarBoletinMedicoSeguro = httpsCallable(functions, 'generarBoletinMedicoSeguro');
      const response = await generarBoletinMedicoSeguro({ limite: 5 });
      const timestamp = new Date().toISOString();
      const itemsSeguros = Array.isArray(response?.data?.items) ? response.data.items : [];
      const items = itemsSeguros
        .map((item, idx) => ({
          id: item.id || `safe-${idx}-${Date.now()}`,
          titulo: item.titulo,
          resumen: item.resumen,
          categoria: item.categoria,
          impacto: item.impacto,
          fuente: item.fuente,
          url: item.url,
          fechaGeneracion: item.fechaGeneracion || timestamp,
          fuenteValidada: item.fuenteValidada === true
        }))
        .map(validarFuenteNoticia)
        .filter(item => item.fuenteValidada);

      if (items.length === 0) {
        throw new Error('Boletín sin fuentes válidas');
      }

      setNoticiasMedicas(items);
      setNoticiasActualizadasAt(timestamp);
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp, items }));

      const seenAt = new Date(localStorage.getItem(seenKey) || 0).getTime();
      const unread = items.filter(item => new Date(item.fechaGeneracion || timestamp).getTime() > seenAt).length;
      setNoticiasNoLeidas(unread);
    } catch {
      const timestamp = new Date().toISOString();
      const fallbackItems = NOTICIAS_FALLBACK.map((item, idx) => ({
        id: `fallback-${idx}`,
        ...item,
        fechaGeneracion: timestamp
      })).map(validarFuenteNoticia);
      setNoticiasMedicas(fallbackItems);
      setNoticiasActualizadasAt(timestamp);
      showToast('Boletín seguro no disponible. Mostrando fuentes de respaldo.', 'warning');
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp, items: fallbackItems }));
      } catch {}
      const seenKey = `noticias_medicas_seen_${user.uid}`;
      const seenAt = new Date(localStorage.getItem(seenKey) || 0).getTime();
      const unread = fallbackItems.filter(item => new Date(item.fechaGeneracion).getTime() > seenAt).length;
      setNoticiasNoLeidas(unread);
    } finally {
      setNoticiasLoading(false);
    }
  };

  /* ── CITAS (TIEMPO REAL) ── */
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const citasRef = collection(db, "citas");
    const now = new Date();
    const pasado = new Date(now);
    pasado.setDate(pasado.getDate() - 60);
    const desde = `${toInputDateValue(pasado)}T00:00`;
    const futuro = new Date(now);
    futuro.setDate(futuro.getDate() + 60);
    const hasta = `${toInputDateValue(futuro)}T23:59`;

    const q = user.rol === 'medico'
      ? query(
          citasRef,
          where("doctorUid", "==", user.uid),
          where("fechaHora", ">=", desde),
          where("fechaHora", "<=", hasta),
          orderBy("fechaHora", "asc")
        )
      : query(citasRef, where("fechaHora", ">=", desde), where("fechaHora", "<=", hasta), orderBy("fechaHora", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const nuevasCitas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      prevCitasLength.current = nuevasCitas.length;
      setCitas(nuevasCitas);
      setLoading(false);
    }, () => { setLoading(false); });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.rol]);

  /* ── INVENTARIO (TIEMPO REAL) ── */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventario'), (snap) => {
      const hoy = new Date();
      const limit = new Date();
      limit.setMonth(hoy.getMonth() + 3);
      const alertas = [];
      snap.docs.forEach((docRef) => {
        const item = docRef.data();
        if (item.caducidad) {
          const fCad = new Date(item.caducidad);
          if (fCad <= limit && item.stock > 0) {
            const dias = Math.ceil((fCad - hoy) / 86400000);
            alertas.push({ id: docRef.id, ...item, diasRestantes: dias, riesgo: dias <= 30 ? 'alto' : 'medio' });
          }
        }
      });
      setAlertasCaducidad(alertas.sort((a, b) => a.diasRestantes - b.diasRestantes));
    }, () => {});

    return () => unsub();
  }, []);

  /* ── NOTIFICATIONS ── */
  useEffect(() => {
    if (Notification.permission !== "granted" && Notification.permission !== "denied")
      Notification.requestPermission();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.uid) cargarNoticiasMedicas();
  }, [user?.uid]);

  useEffect(() => {
    if (showNotifications && user?.uid) {
      const seenKey = `noticias_medicas_seen_${user.uid}`;
      localStorage.setItem(seenKey, new Date().toISOString());
      setNoticiasNoLeidas(0);
    }
  }, [showNotifications, user?.uid]);

  /* ── PACIENTES ── */
  const fetchPacientesSugerencias = async (txt) => {
    try {
      const { searchPatientsForAutocomplete } = await import('../services/patientSearchService');
      const results = await searchPatientsForAutocomplete(txt, 20);
      setSugerencias(results);
      setMostrarSugerencias(results.length > 0);
    } catch {
      setMostrarSugerencias(false);
    }
  };

  useEffect(() => {
    const parseMotivos = (docs) => docs
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        precio: Number(item.precio || 0),
        precioMin: Number(item.precioMin ?? item.precio ?? 0),
        precioMax: Number(item.precioMax ?? item.precio ?? 0),
        area: item.area || item.categoria || 'General',
        categoria: item.categoria || item.area || 'General',
        duracionMin: Number(item.duracionMin || 20),
        teleconsultaPermitida: item.teleconsultaPermitida !== false,
        prioridadTriage: item.prioridadTriage || 'media',
        versionPrecio: Number(item.versionPrecio || 1),
        usoCount: Number(item.usoCount || 0),
        atendidoPorEnfermeria: Boolean(item.atendidoPorEnfermeria)
      }))
      .sort((a, b) => b.usoCount - a.usoCount || (a.nombre || '').localeCompare(b.nombre || ''));

    const parseConsultorios = (docs) => docs
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ubicacion: item.ubicacion || 'Sin ubicación',
        especialidad: item.especialidad || 'General',
        horaInicio: normalizeTimeValue(item.horaInicio) || '08:00',
        horaFin: normalizeTimeValue(item.horaFin) || '18:00',
        intervaloMin: Number(item.intervaloMin || 10),
        capacidadSimultanea: Number(item.capacidadSimultanea || 1),
        diasAtencion: Array.isArray(item.diasAtencion) && item.diasAtencion.length > 0
          ? item.diasAtencion
          : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        sucursalId: item.sucursalId || '',
        sucursal: item.sucursal || user?.sucursal || 'Central',
        activo: item.activo !== false
      }));

    const parseSucursales = (docs) => docs
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ubicacion: item.ubicacion || 'Sin ubicación',
        telefono: item.telefono || '',
        responsable: item.responsable || '',
        horaApertura: normalizeTimeValue(item.horaApertura) || '08:00',
        horaCierre: normalizeTimeValue(item.horaCierre) || '20:00',
        timezone: item.timezone || 'America/Mexico_City',
        diasOperacion: Array.isArray(item.diasOperacion) && item.diasOperacion.length > 0
          ? item.diasOperacion
          : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
        activo: item.activo !== false
      }));

    const unsub1 = onSnapshot(query(collection(db, 'catalogo_motivos_consulta'), orderBy('nombre', 'asc')), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item?.activo !== false && item?.nombre);
      setCatalogoMotivos(parseMotivos(rows));
    }, () => {});

    const unsub2 = onSnapshot(query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc')), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item?.activo !== false && item?.nombre);
      setCatalogoConsultorios(parseConsultorios(rows));
    }, () => {});

    const unsub3 = onSnapshot(query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc')), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item?.activo !== false && item?.nombre);
      setCatalogoSucursales(parseSucursales(rows));
    }, () => {});

    const unsub4 = onSnapshot(query(collection(db, 'users'), where('rol', 'in', ['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa'])), (snap) => {
      setCatalogoEnfermeros(snap.docs.map((d) => ({ id: d.id, nombre: d.data().nombre || d.data().email || d.id, rol: d.data().rol || '' })));
    }, () => {});

    const unsub5 = onSnapshot(query(collection(db, 'users'), where('rol', 'in', ['medico', 'doctor'])), (snap) => {
      setCatalogoDoctores(snap.docs.map((d) => ({ id: d.id, nombre: d.data().nombre || d.data().email || d.id })).filter((item) => item.nombre));
    }, () => {});

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [user?.sucursal]);

  /* ── HORARIOS BLOQUEADOS (TIEMPO REAL) ── */
  useEffect(() => {
    if (!user?.uid) return;
    const fechaStr = toInputDateValue(currentDate);
    const docRef = doc(db, 'horarios_bloqueados', `${user.uid}_${fechaStr}`);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Nuevo formato: slotsDetalle es un objeto { slotKey: { justificacion, bloqueadoAt } }
        if (data.slotsDetalle && typeof data.slotsDetalle === 'object') {
          setSlotsBloqueados(data.slotsDetalle);
        } else if (Array.isArray(data.slots)) {
          // Compatibilidad con formato anterior
          const obj = {};
          data.slots.forEach(s => { obj[s] = { justificacion: '' }; });
          setSlotsBloqueados(obj);
        } else {
          setSlotsBloqueados({});
        }
      } else {
        setSlotsBloqueados({});
      }
    }, () => {});
    return () => unsub();
  }, [user?.uid, currentDate]);

  useEffect(() => {
    if (!nuevaCita.motivoId && catalogoMotivos.length > 0) {
      const motivo = catalogoMotivos[0];
      setNuevaCita((prev) => ({ ...prev, motivoId: motivo.id, motivo: motivo.nombre }));
    }
  }, [catalogoMotivos, nuevaCita.motivoId]);

  useEffect(() => {
    if (!nuevaCita.consultorioId && catalogoConsultorios.length > 0) {
      const primerConsultorio = catalogoConsultorios[0];
      setNuevaCita((prev) => ({
        ...prev,
        consultorioId: primerConsultorio.id,
        sucursalId: primerConsultorio.sucursalId || prev.sucursalId
      }));
    }
  }, [catalogoConsultorios, nuevaCita.consultorioId]);

  useEffect(() => {
    if (!nuevaCita.sucursalId && catalogoSucursales.length > 0) {
      setNuevaCita((prev) => ({ ...prev, sucursalId: catalogoSucursales[0].id }));
    }
  }, [catalogoSucursales, nuevaCita.sucursalId]);

  useEffect(() => {
    if (!nuevaCita.consultorioId) return;
    const consultorioSeleccionado = catalogoConsultorios.find((item) => item.id === nuevaCita.consultorioId);
    if (!consultorioSeleccionado?.sucursalId) return;
    if (nuevaCita.sucursalId === consultorioSeleccionado.sucursalId) return;

    setNuevaCita((prev) => ({
      ...prev,
      sucursalId: consultorioSeleccionado.sucursalId
    }));
  }, [catalogoConsultorios, nuevaCita.consultorioId, nuevaCita.sucursalId]);

  // Inicializar consultorioActivoId desde el contexto de sesión primero, luego fallback al perfil
  const consultorioInitRef = useRef(false);
  const sessionConsultorioId = sessionConsultorio?.id;
  const userConsultorioActualId = user?.consultorioActualId;
  const userConsultorioRecurrenteId = user?.consultorioRecurrenteId;
  const userConsultorioId = user?.consultorioId;
  const userConsultorioActual = user?.consultorioActual;
  const userConsultorioRecurrente = user?.consultorioRecurrente;
  const userConsultorio = user?.consultorio;

  useEffect(() => {
    if (!canRotateConsultorio) return;
    
    // Resetear el flag de inicialización si el catálogo local cambió de tamaño
    // (pasó de fallback a datos reales de Firestore)
    if (catalogoConsultorios.length === 0) return;

    console.log('[DEBUG Agenda init] sessionConsultorio?.id:', sessionConsultorio?.id);
    console.log('[DEBUG Agenda init] catalogoConsultorios length:', catalogoConsultorios.length);
    console.log('[DEBUG Agenda init] catalogoConsultorios IDs:', catalogoConsultorios.map(c => c.id));
    console.log('[DEBUG Agenda init] user.consultorioActualId:', user?.consultorioActualId);

    // Prioridad 1: Contexto de sesión (SessionLocationContext)
    if (sessionConsultorioId) {
      // Buscar en catálogo local Y en catálogo del contexto de sesión
      const foundLocal = catalogoConsultorios.find((item) => item.id === sessionConsultorioId);
      const foundSession = (sessionCatConsultorios || []).find((item) => item.id === sessionConsultorioId);
      const found = foundLocal || foundSession;
      console.log('[DEBUG Agenda init] foundLocal:', foundLocal?.id, 'foundSession:', foundSession?.id);
      if (found?.id) {
        console.log('[DEBUG Agenda init] seteando desde sesión:', found.id, found.nombre);
        setConsultorioActivoId(found.id);
        consultorioInitRef.current = true;
        return;
      }
    }

    // Si ya se inicializó desde sesión, no seguir con fallbacks
    if (consultorioInitRef.current) return;

    // Prioridad 2: Perfil de usuario en Firestore (fallback)
    const byId = String(userConsultorioActualId || userConsultorioRecurrenteId || userConsultorioId || '').trim();
    const byName = String(userConsultorioActual || userConsultorioRecurrente || userConsultorio || '').trim().toLowerCase();

    const found = catalogoConsultorios.find((item) => item.id === byId)
      || catalogoConsultorios.find((item) => String(item.nombre || '').trim().toLowerCase() === byName);

    console.log('[DEBUG Agenda init] fallback byId:', byId, 'byName:', byName, 'found:', found?.id);

    if (found?.id) {
      setConsultorioActivoId(found.id);
      consultorioInitRef.current = true;
      return;
    }

    // Solo tomar el primer consultorio si el catálogo ya es real (no fallback)
    // El fallback solo tiene 1 item con id fijo 'consultorio-1'
    if (catalogoConsultorios.length > 0 && catalogoConsultorios[0]?.id !== 'consultorio-1') {
      console.log('[DEBUG Agenda init] tomando primer consultorio del catálogo real:', catalogoConsultorios[0]?.id);
      setConsultorioActivoId(catalogoConsultorios[0].id);
      consultorioInitRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRotateConsultorio, catalogoConsultorios, sessionConsultorioId,
      userConsultorioActualId, userConsultorioRecurrenteId, userConsultorioId,
      userConsultorioActual, userConsultorioRecurrente, userConsultorio]);

  useEffect(() => {
    if (!isDoctorRole || !consultorioActivo) return;
    setNuevaCita((prev) => ({
      ...prev,
      consultorioId: consultorioActivo.id,
      sucursalId: consultorioActivo.sucursalId || sessionSucursal?.id || prev.sucursalId
    }));
  }, [isDoctorRole, consultorioActivo, sessionSucursal?.id]);

  /* ── DATE UTILS ── */
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  const weekDays = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(getStartOfWeek(currentDate));
    d.setDate(d.getDate() + i);
    return d;
  });

  /* ── HANDLERS ── */
  const handlePacienteCreado = (nuevoPaciente) => {
    const p = {
      id: nuevoPaciente.id,
      nombre: nuevoPaciente.nombreCompleto,
      telefono: nuevoPaciente.telefonoMovil,
      idPaciente: nuevoPaciente.idPaciente || ''
    };

    if (pacienteAEditar) {
      // Modo edición: reemplazar la entrada existente en la lista local
      setTodosLosPacientes(prev => prev.map(px => px.id === p.id ? p : px));
      // Si la cita abierta en el drawer corresponde al paciente editado, actualizar al instante
      if (selectedCita?.pacienteId === p.id) {
        setSelectedCita(prev => prev ? { ...prev, paciente: p.nombre } : null);
        // Actualizar el documento de la cita en Firestore para que el calendario también lo refleje
        updateDoc(doc(db, 'citas', selectedCita.id), { paciente: p.nombre }).catch(() => {});
      }
    } else {
      // Modo creación: agregar a la lista y pre-seleccionar en el formulario
      setTodosLosPacientes(prev => [...prev, p]);
      seleccionarPaciente(p);
    }
    setShowPacienteModal(false);
  };

  const seleccionarPaciente = (p) => {
    setNuevaCita({ ...nuevaCita, paciente: p.nombre, pacienteId: p.id, pacienteTelefono: p.telefono });
    setMostrarSugerencias(false);
  };

  const getMotivoSeleccionado = (motivoId) => {
    return catalogoMotivos.find((m) => m.id === motivoId) || null;
  };

  const getDuracionMotivo = (motivoId) => {
    const motivo = getMotivoSeleccionado(motivoId);
    return Number(motivo?.duracionMin || INTERVALO_MINUTOS);
  };

  const getDayKeyFromISODate = (isoDate = '') => {
    const parsed = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return '';
    return DIAS_SEMANA_INDEX[parsed.getDay()] || '';
  };

  const normalizeTimeValue = (value = '') => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';

    const compact = raw.replace(/\s+/g, '').replace(/\./g, '');
    let meridiem = '';
    let body = compact;

    if (body.endsWith('am') || body.endsWith('pm')) {
      meridiem = body.slice(-2);
      body = body.slice(0, -2);
    }

    const match = body.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) return '';

    let hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2] || '0', 10);

    if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return '';

    if (meridiem) {
      if (hour < 1 || hour > 12) return '';
      if (meridiem === 'am') {
        hour = hour === 12 ? 0 : hour;
      } else {
        hour = hour === 12 ? 12 : hour + 12;
      }
    }

    if (!meridiem && (hour < 0 || hour > 23)) return '';

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const timeToMinutes = (value = '') => {
    const normalized = normalizeTimeValue(value);
    if (!normalized) return null;
    const [h = '00', m = '00'] = normalized.split(':');
    return (Number.parseInt(h, 10) * 60) + Number.parseInt(m, 10);
  };

  const isWithinTimeRange = (hora = '', inicio = '00:00', fin = '23:59') => {
    const horaMin = timeToMinutes(hora);
    if (horaMin === null) return false;

    const inicioMin = timeToMinutes(inicio);
    const finMin = timeToMinutes(fin);

    // Si no hay un rango válido, evitamos bloquear por configuración incompleta.
    if (inicioMin === null || finMin === null) return true;

    if (inicioMin <= finMin) {
      return horaMin >= inicioMin && horaMin <= finMin;
    }

    // Rango que cruza medianoche: por ejemplo 22:00-06:00.
    return horaMin >= inicioMin || horaMin <= finMin;
  };

  const is24hSchedule = (inicio = '', fin = '', dias = []) => {
    if (normalizeTimeValue(inicio) !== '00:00') return false;
    if (normalizeTimeValue(fin) !== '23:59') return false;
    return DIAS_SEMANA_COMPLETA.every((dia) => dias.includes(dia));
  };

  const buildEffectiveSchedule = ({
    horarioTipo = 'personalizado',
    inicio = '',
    fin = '',
    dias = [],
    fallbackInicio = '08:00',
    fallbackFin = '20:00',
    fallbackDias = DIAS_SEMANA_COMPLETA,
  }) => {
    const normalizedInicio = normalizeTimeValue(inicio) || fallbackInicio;
    const normalizedFin = normalizeTimeValue(fin) || fallbackFin;
    const normalizedDias = Array.isArray(dias) && dias.length > 0 ? dias : fallbackDias;
    const fullDay = horarioTipo === '24h' || is24hSchedule(normalizedInicio, normalizedFin, normalizedDias);

    return {
      inicio: fullDay ? '00:00' : normalizedInicio,
      fin: fullDay ? '23:59' : normalizedFin,
      dias: fullDay ? [...DIAS_SEMANA_COMPLETA] : normalizedDias,
      is24h: fullDay,
    };
  };

  const formatScheduleLabel = (schedule) => {
    if (!schedule) return 'Sin horario';
    return schedule.is24h ? '24 horas' : `${schedule.inicio}-${schedule.fin}`;
  };

  const hasScheduleConflict = (schedule, referenceSchedule) => {
    if (!schedule || !referenceSchedule) return false;

    const missingDay = schedule.dias.some((dia) => !referenceSchedule.dias.includes(dia));
    if (missingDay) return true;

    return !isWithinTimeRange(schedule.inicio, referenceSchedule.inicio, referenceSchedule.fin)
      || !isWithinTimeRange(schedule.fin, referenceSchedule.inicio, referenceSchedule.fin);
  };

  const consultorioSeleccionadoModal = catalogoConsultorios.find((item) => item.id === nuevaCita.consultorioId) || null;

  const sucursalSeleccionadaModal = consultorioSeleccionadoModal?.sucursalId
    ? catalogoSucursales.find((item) => item.id === consultorioSeleccionadoModal.sucursalId) || null
    : (nuevaCita.sucursalId
      ? catalogoSucursales.find((item) => item.id === nuevaCita.sucursalId) || null
      : null);

  const horarioConsultorioModal = consultorioSeleccionadoModal
    ? buildEffectiveSchedule({
      horarioTipo: consultorioSeleccionadoModal.horarioTipo,
      inicio: consultorioSeleccionadoModal.horaInicio,
      fin: consultorioSeleccionadoModal.horaFin,
      dias: consultorioSeleccionadoModal.diasAtencion,
      fallbackInicio: '08:00',
      fallbackFin: '18:00',
      fallbackDias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
    })
    : null;

  const horarioSucursalModal = sucursalSeleccionadaModal
    ? buildEffectiveSchedule({
      horarioTipo: sucursalSeleccionadaModal.horarioTipo,
      inicio: sucursalSeleccionadaModal.horaApertura,
      fin: sucursalSeleccionadaModal.horaCierre,
      dias: sucursalSeleccionadaModal.diasOperacion,
      fallbackInicio: '08:00',
      fallbackFin: '20:00',
      fallbackDias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    })
    : null;

  const consultorioFueraDeHorarioSucursal = hasScheduleConflict(horarioConsultorioModal, horarioSucursalModal);

  const enviarWhatsApp = (telefono, mensaje) => {
    if (!telefono) return showToast("El paciente no tiene teléfono registrado","error");
    let phone = telefono.replace(/\D/g,'');
    if (phone.length === 10) phone = `52${phone}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const notificarPaciente = async (cita) => {
    if (notificandoPaciente) return;
    if (!cita) return showToast('No hay cita seleccionada', 'error');
    if (!cita.pacienteTelefono) return showToast('El paciente no tiene teléfono registrado', 'error');
    if (cita.notificadoWhatsApp) return showToast('Este paciente ya fue notificado', 'error');
    setNotificandoPaciente(true);
    setNotificandoCitaId(cita.id);
    try {
      const enviarWA = httpsCallable(functions, 'enviarWhatsAppNotificacion');
      await enviarWA({
        telefono: cita.pacienteTelefono,
        nombrePaciente: cita.paciente,
        consultorio: cita.consultorioNombre || 'Consultorio',
        nombreDoctor: user?.nombre || '',
        nombreClinica: cita.sucursal || catalogoSucursales.find(s => s.id === cita.sucursalId)?.nombre || '',
        motivo: cita.motivo || 'Consulta'
      });
      await updateDoc(doc(db, 'citas', cita.id), {
        notificadoWhatsApp: true,
        notificadoWhatsAppAt: serverTimestamp(),
        notificadoPor: user?.uid || '',
        notificadoPorNombre: user?.nombre || ''
      });
      showToast(`Notificación enviada a ${cita.paciente}`, 'success');
    } catch (error) {
      console.error('Error al notificar:', error);
      showToast(error?.message || 'Error al enviar notificación por WhatsApp', 'error');
    } finally {
      setNotificandoPaciente(false);
      setNotificandoCitaId(null);
    }
  };

  const notificarSiguientePaciente = async () => {
    const siguientes = citasDelDia.filter(c =>
      c.estado === 'pendiente' && !c.notificadoWhatsApp && c.pacienteTelefono
    );
    if (siguientes.length === 0) {
      return showToast('No hay pacientes pendientes por notificar', 'error');
    }
    await notificarPaciente(siguientes[0]);
  };

  const handleCambiarConsultorioActivo = async (nextConsultorioId) => {
    if (!canRotateConsultorio || !user?.uid) return;
    if (!nextConsultorioId || nextConsultorioId === consultorioActivoId) return;

    const previo = catalogoConsultorios.find((item) => item.id === consultorioActivoId) || null;
    const siguiente = catalogoConsultorios.find((item) => item.id === nextConsultorioId) || null;
    if (!siguiente) return;

    const prevId = consultorioActivoId;
    // Guardar sucursal anterior antes de que sessionUpdateConsultorio la actualice
    const sucursalAnterior = previo?.sucursal || sessionSucursal?.nombre || user?.sucursalActual || user?.sucursal || '';
    setConsultorioActivoId(nextConsultorioId);
    setGuardandoConsultorio(true);

    try {
      // Actualizar el contexto de sesión global (fuente única de verdad)
      // sessionUpdateConsultorio ya persiste todos los campos de ubicación en Firestore
      await sessionUpdateConsultorio(nextConsultorioId);

      // Solo agregar el timestamp de cambio; los campos de ubicación ya fueron escritos por sessionUpdateConsultorio
      await updateDoc(doc(db, 'users', user.uid), {
        consultorioUltimoCambioAt: serverTimestamp()
      });

      await addDoc(collection(db, 'auditoria_movimientos_consultorio'), {
        doctorUid: user.uid,
        doctorNombre: user.nombre || '',
        doctorRol: user.rol || '',
        actorUid: user.uid,
        actorNombre: user.nombre || '',
        actorRol: user.rol || '',
        consultorioAnteriorId: previo?.id || '',
        consultorioAnterior: previo?.nombre || user?.consultorioActual || user?.consultorioRecurrente || '',
        sucursalAnterior,
        consultorioNuevoId: siguiente.id,
        consultorioNuevo: siguiente.nombre || '',
        sucursalNueva: siguiente.sucursal || '',
        esMovimientoAdmin: isAdminRole,
        fecha: serverTimestamp(),
        fechaString: toInputDateValue(new Date()),
        origen: isAdminRole ? 'agenda_admin_rotacion' : 'agenda_medico_rotacion'
      });

      showToast(`Consultorio activo actualizado a ${siguiente.nombre}.`, 'success');
    } catch (error) {
      console.error('Error cambiando consultorio activo:', error);
      setConsultorioActivoId(prevId);
      showToast('No se pudo actualizar el consultorio activo.', 'error');
    } finally {
      setGuardandoConsultorio(false);
    }
  };

  const handleGuardarCita = async (e) => {
    e.preventDefault();
    try {
      const motivoSeleccionado = getMotivoSeleccionado(nuevaCita.motivoId);
      const consultorioSeleccionado = catalogoConsultorios.find((c) => c.id === nuevaCita.consultorioId) || null;
      const sucursalDesdeConsultorio = consultorioSeleccionado?.sucursalId
        ? catalogoSucursales.find((s) => s.id === consultorioSeleccionado.sucursalId) || null
        : null;
      const sucursalDesdeFormulario = nuevaCita.sucursalId
        ? catalogoSucursales.find((s) => s.id === nuevaCita.sucursalId) || null
        : null;
      const sucursalSeleccionada = sucursalDesdeConsultorio || sucursalDesdeFormulario || null;
      const duracionMotivo = Number(motivoSeleccionado?.duracionMin || INTERVALO_MINUTOS);
      const horaInicioCita = normalizeTimeValue(nuevaCita.hora);
      const horaFin = normalizeTimeValue(nuevaCita.horaFin || calcularHoraFin(nuevaCita.hora, duracionMotivo));
      const diaCita = getDayKeyFromISODate(nuevaCita.fecha);

      if (!horaInicioCita || !horaFin) {
        showToast('Hora de cita inválida. Verifica el horario seleccionado.', 'warning');
        return;
      }

      if (!nuevaCita.doctorUid && !motivoSeleccionado?.atendidoPorEnfermeria) {
        showToast('Selecciona un médico responsable antes de agendar.', 'warning');
        return;
      }

      if (nuevaCita.esTeleconsulta && motivoSeleccionado?.teleconsultaPermitida === false) {
        showToast('Este motivo no permite teleconsulta. Cambia a presencial o elige otro motivo.', 'warning');
        return;
      }

      if (consultorioSeleccionado) {
        const diasAtencion = consultorioSeleccionado.diasAtencion || [];
        if (diaCita && diasAtencion.length > 0 && !diasAtencion.includes(diaCita)) {
          showToast(`El consultorio no opera en ${diaCita}.`, 'warning');
          return;
        }
        if (!isWithinTimeRange(horaInicioCita, consultorioSeleccionado.horaInicio || '00:00', consultorioSeleccionado.horaFin || '23:59')) {
          showToast(`Horario fuera del rango del consultorio ${consultorioSeleccionado.nombre ? `${consultorioSeleccionado.nombre} ` : ''}(${consultorioSeleccionado.horaInicio || '00:00'}-${consultorioSeleccionado.horaFin || '23:59'}).`, 'warning');
          return;
        }
      }

      if (sucursalSeleccionada) {
        const diasOperacion = sucursalSeleccionada.diasOperacion || [];
        if (diaCita && diasOperacion.length > 0 && !diasOperacion.includes(diaCita)) {
          showToast(`La sucursal no opera en ${diaCita}.`, 'warning');
          return;
        }
        const horaAperturaSucursal = normalizeTimeValue(sucursalSeleccionada.horaApertura) || '00:00';
        const horaCierreSucursal = normalizeTimeValue(sucursalSeleccionada.horaCierre) || '23:59';
        if (!isWithinTimeRange(horaInicioCita, horaAperturaSucursal, horaCierreSucursal)) {
          showToast(`Horario fuera del rango de sucursal ${sucursalSeleccionada.nombre ? `${sucursalSeleccionada.nombre} ` : ''}(${horaAperturaSucursal}-${horaCierreSucursal}).`, 'warning');
          return;
        }
      }

      if (!nuevaCita.pacienteId) {
        showToast('Selecciona un paciente de la lista. Si no aparece, regístralo primero con el botón +.', 'warning');
        return;
      }

      const pacienteDoc = await getDoc(doc(db, 'pacientes', nuevaCita.pacienteId));
      if (!pacienteDoc.exists()) {
        showToast('El paciente no está dado de alta en el sistema. Regístralo primero.', 'warning');
        return;
      }

      let meetLink = '';
      if (nuevaCita.esTeleconsulta) {
        const roomId = `srs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        meetLink = `https://meet.jit.si/${roomId}`;
      }
      const citaRef = await addDoc(collection(db, "citas"), {
        ...nuevaCita, meetLink,
        motivo: motivoSeleccionado?.nombre || nuevaCita.motivo || 'Consulta',
        motivoNombreSnapshot: motivoSeleccionado?.nombre || nuevaCita.motivo || 'Consulta',
        motivoId: motivoSeleccionado?.id || nuevaCita.motivoId || '',
        // Campo 'consultorio' (nombre) requerido por AgendaEnfermeria para filtrar correctamente
        consultorio: consultorioSeleccionado?.nombre || nuevaCita.consultorio || '',
        motivoPrecio: Number(motivoSeleccionado?.precio || 0),
        motivoPrecioSnapshot: Number(motivoSeleccionado?.precio || 0),
        motivoPrecioMin: Number(motivoSeleccionado?.precioMin ?? motivoSeleccionado?.precio ?? 0),
        motivoPrecioMax: Number(motivoSeleccionado?.precioMax ?? motivoSeleccionado?.precio ?? 0),
        motivoVersionPrecio: Number(motivoSeleccionado?.versionPrecio || 1),
        motivoCategoria: motivoSeleccionado?.categoria || motivoSeleccionado?.area || 'General',
        motivoDuracionMin: duracionMotivo,
        motivoTeleconsultaPermitida: motivoSeleccionado?.teleconsultaPermitida !== false,
        areaConsulta: motivoSeleccionado?.area || 'General',
        consultorioId: consultorioSeleccionado?.id || nuevaCita.consultorioId || '',
        consultorioNombre: consultorioSeleccionado?.nombre || 'Sin asignar',
        consultorioUbicacion: consultorioSeleccionado?.ubicacion || '',
        consultorioEspecialidad: consultorioSeleccionado?.especialidad || '',
        consultorioHoraInicio: consultorioSeleccionado?.horaInicio || '08:00',
        consultorioHoraFin: consultorioSeleccionado?.horaFin || '18:00',
        consultorioDiasAtencion: consultorioSeleccionado?.diasAtencion || [],
        consultorioCapacidadSimultanea: Number(consultorioSeleccionado?.capacidadSimultanea || 1),
        sucursalId: sucursalSeleccionada?.id || sessionSucursal?.id || nuevaCita.sucursalId || '',
        sucursal: sucursalSeleccionada?.nombre || sessionSucursal?.nombre || user.sucursal || '',
        sucursalUbicacion: sucursalSeleccionada?.ubicacion || '',
        sucursalHoraApertura: sucursalSeleccionada?.horaApertura || '08:00',
        sucursalHoraCierre: sucursalSeleccionada?.horaCierre || '20:00',
        sucursalDiasOperacion: sucursalSeleccionada?.diasOperacion || [],
        fechaHora: `${nuevaCita.fecha}T${horaInicioCita}`,
        fechaHoraFin: `${nuevaCita.fecha}T${horaFin}`,
        horaFin,
        doctorUid: nuevaCita.doctorUid || user.uid,
        estado: 'pendiente',
        creadoPor: user?.uid || 'anonimo',
        creadoPorRol: user?.rol || 'desconocido',
        esCitaEnfermeria: Boolean(motivoSeleccionado?.atendidoPorEnfermeria),
        enfermeroAsignadoId: motivoSeleccionado?.atendidoPorEnfermeria ? (nuevaCita.enfermeroAsignadoId || '') : '',
        enfermeroAsignadoNombre: motivoSeleccionado?.atendidoPorEnfermeria ? (nuevaCita.enfermeroAsignadoNombre || '') : '',
        formaPago: nuevaCita.formaPago || 'efectivo'
      });

      // Incrementar contador de uso del motivo
      if (motivoSeleccionado?.id) {
        updateDoc(doc(db, 'catalogo_motivos_consulta', motivoSeleccionado.id), { usoCount: increment(1) }).catch(() => {});
      }

      // Si es cita de enfermería, abrir orden de servicio en nueva pestaña
      const esCitaEnfermeria = Boolean(motivoSeleccionado?.atendidoPorEnfermeria);

      // Cerrar modal y resetear formulario inmediatamente
      setShowCitaModal(false);
      setNuevaCita({
        paciente:'', pacienteId:'', pacienteTelefono:'',
        fecha: toInputDateValue(currentDate), hora:'', horaFin:'',
        tipoConsulta:'primera_vez',
        motivo: catalogoMotivos[0]?.nombre || 'Consulta',
        motivoId: catalogoMotivos[0]?.id || '',
        consultorioId: catalogoConsultorios[0]?.id || '',
        sucursalId: catalogoConsultorios[0]?.sucursalId || catalogoSucursales[0]?.id || '',
        esTeleconsulta:false,
        doctorAsignado: isDoctorRole ? user.nombre : '',
        doctorUid: isDoctorRole ? user.uid : '',
        enfermeroAsignadoId: '',
        enfermeroAsignadoNombre: ''
      });

      if (esCitaEnfermeria) {
        window.open(`/enfermeria/orden-servicio?citaId=${citaRef.id}`, '_blank');
      }

      if (nuevaCita.esTeleconsulta && nuevaCita.pacienteTelefono) {
        try {
          const enviarWA = httpsCallable(functions, 'enviarWhatsAppNotificacion');
          await enviarWA({
            telefono: nuevaCita.pacienteTelefono,
            nombrePaciente: nuevaCita.paciente,
            consultorio: consultorioSeleccionado?.nombre || nuevaCita.consultorio || 'Consultorio',
            nombreDoctor: user?.nombre || '',
            nombreClinica: sucursalSeleccionada?.nombre || user?.sucursal || 'Clínica',
            motivo: `${motivoSeleccionado?.nombre || nuevaCita.motivo || 'Consulta'} | Link Meet: ${meetLink}`,
            templateName: 'teleconsulta_turno'
          });
          await updateDoc(doc(db, 'citas', citaRef.id), {
            notificadoWhatsApp: true,
            notificadoWhatsAppAt: serverTimestamp(),
            notificadoPor: user?.uid || '',
            notificadoPorNombre: user?.nombre || ''
          });
          showToast('Cita agendada y enlace enviado por WhatsApp', 'success');
        } catch (waError) {
          console.error('Error al enviar WhatsApp automático de teleconsulta:', waError);
          showToast('Cita agendada, pero no se pudo enviar el enlace por WhatsApp', 'warning');
        }
      } else {
        showToast("Cita agendada correctamente");
      }
    } catch (error) { showToast(error.message,"error"); }
  };

  const cambiarEstado = async (id, estado) => {
    await updateDoc(doc(db,"citas",id), { estado });
    if (estado === 'cancelada') setSelectedCita(null);
    if (estado === 'completada') showToast("Consulta finalizada","success");
  };

  // ─── UTILIDAD ───
  const sumarMinutos = (hora, minutos) => {
    if (!hora) return '';
    const [horas, mins] = hora.split(':').map(Number);
    if (Number.isNaN(horas) || Number.isNaN(mins)) return '';
    const total = horas * 60 + mins + minutos;
    const horasFinal = Math.floor((total % (24 * 60)) / 60).toString().padStart(2, '0');
    const minsFinal = (total % 60).toString().padStart(2, '0');
    return `${horasFinal}:${minsFinal}`;
  };

  // ─── ACCIONES DEL DRAWER ───
  const handleGuardarEditarCita = async () => {
    if (!selectedCita) return;
    setActionLoading('editarCita');
    try {
      const motivoSeleccionado = catalogoMotivos.find(m => m.id === editarCitaData.motivoId) || null;
      const cambios = {
        paciente: editarCitaData.paciente.trim(),
        motivo: motivoSeleccionado?.nombre || editarCitaData.motivo || selectedCita.motivo,
        motivoId: editarCitaData.motivoId || selectedCita.motivoId || '',
        tipoConsulta: editarCitaData.tipoConsulta || selectedCita.tipoConsulta || 'primera_vez',
        doctorUid: editarCitaData.doctorUid || selectedCita.doctorUid || '',
        doctorAsignado: editarCitaData.doctorAsignado || selectedCita.doctorAsignado || '',
        notas: editarCitaData.notas,
      };
      await updateDoc(doc(db, 'citas', selectedCita.id), cambios);
      setSelectedCita(prev => prev ? { ...prev, ...cambios } : null);
      setShowEditarCita(false);
      showToast('Cita actualizada correctamente.', 'success');
    } catch (err) {
      showToast('Error al guardar los cambios.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleReprogramar = async () => {
    if (!selectedCita || !reprogramarData.fecha || !reprogramarData.hora) {
      showToast("Selecciona fecha y hora para reprogramar.", "error");
      return;
    }
    setActionLoading('reprogramar');
    try {
      const horaFin = reprogramarData.horaFin || sumarMinutos(reprogramarData.hora, INTERVALO_MINUTOS);
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        fecha: reprogramarData.fecha,
        hora: reprogramarData.hora,
        horaFin,
        fechaHora: `${reprogramarData.fecha}T${reprogramarData.hora}`,
        fechaHoraFin: `${reprogramarData.fecha}T${horaFin}`,
        reprogramadaAt: serverTimestamp(),
        reprogramadaPor: user?.uid || '',
        reprogramadaPorNombre: user?.nombre || ''
      });
      setSelectedCita(prev => prev ? { ...prev, fecha: reprogramarData.fecha, hora: reprogramarData.hora, horaFin, fechaHora: `${reprogramarData.fecha}T${reprogramarData.hora}` } : null);
      setShowReprogramar(false);
      showToast("Cita reprogramada correctamente", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al reprogramar la cita", "error");
    }
    setActionLoading('');
  };

  const handleRegistrarLlegada = async () => {
    if (!selectedCita) return;
    setActionLoading('llegada');
    try {
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        llegadaRegistrada: true,
        llegadaAt: serverTimestamp(),
        llegadaRegistradaPor: user?.uid || '',
        llegadaRegistradaPorNombre: user?.nombre || ''
      });
      setSelectedCita(prev => prev ? { ...prev, llegadaRegistrada: true } : null);
      showToast("Llegada del paciente registrada", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al registrar llegada", "error");
    }
    setActionLoading('');
  };

  const handleEnviarRecordatorio = async () => {
    if (!selectedCita) return;
    setActionLoading('whatsapp');
    try {
      let telefono = selectedCita.pacienteTelefono || '';
      if (!telefono && selectedCita.pacienteId) {
        const pacienteLocal = todosLosPacientes.find(p => p.id === selectedCita.pacienteId);
        telefono = pacienteLocal?.telefono || '';
        if (!telefono) {
          const snap = await getDoc(doc(db, 'pacientes', selectedCita.pacienteId));
          if (snap.exists()) telefono = snap.data().telefonoMovil || snap.data().telefono || '';
        }
      }
      if (!telefono) {
        showToast("No se encontró teléfono del paciente.", "error");
        setActionLoading('');
        return;
      }
      const enviarWA = httpsCallable(functions, 'enviarWhatsAppNotificacion');
      await enviarWA({
        telefono,
        nombrePaciente: selectedCita.paciente,
        consultorio: selectedCita.consultorio || 'Consultorio',
        nombreDoctor: selectedCita.doctorAsignado || user?.nombre || '',
        nombreClinica: selectedCita.sucursal || user?.sucursal || 'Clínica',
        motivo: selectedCita.motivo || 'Consulta',
        templateName: 'recordatorio_cita'
      });
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        recordatorioEnviado: true,
        recordatorioEnviadoAt: serverTimestamp(),
        recordatorioEnviadoPor: user?.uid || ''
      });
      setSelectedCita(prev => prev ? { ...prev, recordatorioEnviado: true } : null);
      showToast("Recordatorio enviado por WhatsApp", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al enviar recordatorio.", "error");
    }
    setActionLoading('');
  };

  const handleCancelarCita = async () => {
    if (!selectedCita) return;
    setActionLoading('cancelar');
    try {
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        estado: 'cancelada',
        canceladaAt: serverTimestamp(),
        canceladaPor: user?.uid || '',
        canceladaPorNombre: user?.nombre || '',
        canceladaMotivo: cancelarMotivo || 'Sin motivo especificado'
      });
      setShowCancelarConfirm(false);
      setCancelarMotivo('');
      setSelectedCita(null);
      showToast("Cita cancelada correctamente", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al cancelar la cita", "error");
    }
    setActionLoading('');
  };

  const handleGenerarDocumento = () => {
    if (!selectedCita?.pacienteId) {
      showToast("No hay paciente vinculado a esta cita.", "error");
      return;
    }
    navigate('/doctor/expediente', {
      state: {
        pacienteId: selectedCita.pacienteId,
        pacienteNombre: selectedCita.pacienteNombre || selectedCita.paciente || '',
        citaId: selectedCita.id,
        openDocumentTemplates: true
      }
    });
  };

  const procesarArchivoParaPaciente = async ({ file, pacienteId, pacienteNombre, citaId, motivo }) => {
    setUploadingEstudio(true);
    try {
      const timestamp = Date.now();
      const safeName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `expedientes/${pacienteId}/documentos/${timestamp}_${safeName}`;
      const storageRefItem = ref(storage, storagePath);

      await uploadBytes(storageRefItem, file, {
        customMetadata: {
          tipo: 'estudio',
          nombre: file.name,
          generadoAt: new Date().toISOString(),
          origen: 'carga_medico'
        }
      });

      const downloadURL = await getDownloadURL(storageRefItem);

      const ext = file.name.split('.').pop()?.toLowerCase() || 'archivo';
      const eventoDocumental = {
        tipo: 'estudio',
        nombre: file.name,
        formato: ext,
        origen: 'carga_medico',
        plantillaId: '',
        archivoUrl: downloadURL,
        archivoPath: storagePath,
        generadoAt: new Date().toISOString(),
        medicoNombre: user?.nombre || 'Médico'
      };

      await addDoc(collection(db, 'historial_clinico'), {
        pacienteId,
        pacienteNombre,
        medicoNombre: user?.nombre || 'Médico',
        fecha: serverTimestamp(),
        medicoId: user?.uid || 'anonimo',
        citaId: citaId || null,
        tipoNota: 'Carga de Estudio',
        documentosGenerados: [eventoDocumental],
        motivo: motivo || '',
        origenRegistro: 'agenda_medico',
        subidoPor: user?.nombre || 'Médico',
        subidoPorRol: user?.rol || 'medico'
      });

      showToast('Estudio cargado correctamente al expediente clínico.', 'success');
    } catch (e) {
      console.error('Error al cargar estudio:', e);
      showToast('Error al cargar el estudio. Intenta de nuevo.', 'error');
    }
    setUploadingEstudio(false);
  };

  const handleUploadEstudioClick = () => {
    if (!selectedCita?.pacienteId) {
      showToast("No hay paciente vinculado a esta cita.", "error");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCita?.pacienteId) return;
    e.target.value = '';
    await procesarArchivoParaPaciente({
      file,
      pacienteId: selectedCita.pacienteId,
      pacienteNombre: selectedCita.pacienteNombre || selectedCita.paciente || '',
      citaId: selectedCita.id,
      motivo: selectedCita.motivo || ''
    });
  };

  const handleDropOnCard = async (e, cita) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCitaId(null);
    if (cita.estado === 'cancelada') return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    await procesarArchivoParaPaciente({
      file,
      pacienteId: cita.pacienteId,
      pacienteNombre: cita.pacienteNombre || cita.paciente || '',
      citaId: cita.id,
      motivo: cita.motivo || ''
    });
  };

  const handleDragOverCard = (e, citaId, cita) => {
    e.preventDefault();
    e.stopPropagation();
    if (cita?.estado === 'cancelada') return;
    setDragOverCitaId(citaId);
  };

  const handleDragLeaveCard = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCitaId(null);
  };

  const getCitasPorHora = (date, hour) => {
    const dateStr = toInputDateValue(date);
    return citas.filter(c => {
      const [cDate, cTime] = c.fechaHora.split('T');
      return cDate === dateStr && parseInt(cTime.split(':')[0]) === hour;
    });
  };

  const getCitasDelDia = () => {
    const dateStr = toInputDateValue(currentDate);
    return citas.filter(c => c.fechaHora.startsWith(dateStr))
                .sort((a,b) => a.fechaHora.localeCompare(b.fechaHora));
  };

  const parseFechaHora = (fechaHora = '') => {
    const [fecha, hora = '00:00'] = fechaHora.split('T');
    return new Date(`${fecha}T${hora}`);
  };
  const toMinutes = (fechaHora = '') => {
    const [hora = '00', minuto = '00'] = (fechaHora.split('T')[1] || '00:00').split(':');
    return (Number.parseInt(hora, 10) * 60) + Number.parseInt(minuto, 10);
  };
  const formatMinutes = (totalMinutes = 0) => {
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  };
  const toDateSafe = (fecha) => {
    if (!fecha) return null;
    if (fecha?.toDate) return fecha.toDate();
    const parsed = new Date(fecha);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatMetricMinutes = (totalMinutes) => {
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return 'N/D';
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  const formatMetricClock = (dateValue) => {
    const date = toDateSafe(dateValue);
    if (!date) return 'N/D';
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const calcularHoraFin = (horaInicio = '', duracionMin = INTERVALO_MINUTOS) => {
    if (!horaInicio) return '';
    const [h = '00', m = '00'] = horaInicio.split(':');
    const total = (Number.parseInt(h, 10) * 60) + Number.parseInt(m, 10) + Number(duracionMin || INTERVALO_MINUTOS);
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const rangoNuevaCita = nuevaCita.hora
    ? `${nuevaCita.hora} - ${nuevaCita.horaFin || calcularHoraFin(nuevaCita.hora)}`
    : '--';

  const cambiarDia = (dias) => {
    const f = new Date(currentDate);
    f.setDate(f.getDate() + dias);
    setCurrentDate(f);
  };

  const isCurrentHour = (h) => new Date().getHours() === h;
  const citasDelDia = getCitasDelDia();
  const totalNotificaciones = noticiasNoLeidas;
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

 const isCurrentDateToday = currentDate.toDateString() === currentTime.toDateString();
  const timeSlots = useMemo(() => {
    const slots = [];
    const limiteMinutos = (END_HOUR * 60) + 50; // Hasta las 23:50

    for (let total = START_HOUR * 60; total <= limiteMinutos; total += INTERVALO_MINUTOS) {
      const startMinutes = total;
      const endMinutes = total + INTERVALO_MINUTOS;
      const startTime = formatMinutes(startMinutes);
      const endTime = formatMinutes(endMinutes);
      const isCurrent = isCurrentDateToday && nowMinutes >= startMinutes && nowMinutes < endMinutes;
      const isPast = isCurrentDateToday && endMinutes <= nowMinutes;
      slots.push({
        key: `${startTime}-${endTime}`,
        startMinutes,
        endMinutes,
        startTime,
        endTime,
        value: `${startTime} - ${endTime}`,
        isCurrent,
        isPast
      });
    }
    return slots;
  }, [START_HOUR, END_HOUR, INTERVALO_MINUTOS, isCurrentDateToday, nowMinutes]);

  const citasPorSlot = useMemo(() => {
    const mapa = new Map(timeSlots.map(slot => [slot.key, []]));
    citasDelDia.forEach((cita) => {
      const citaMinutes = toMinutes(cita.fechaHora);
      const slot = timeSlots.find(s => citaMinutes >= s.startMinutes && citaMinutes < s.endMinutes);
      if (slot) mapa.get(slot.key).push(cita);
    });
    return mapa;
  }, [citasDelDia, timeSlots]);

  const slotActual = timeSlots.find(slot => slot.isCurrent) || null;
  const siguienteCita = citasDelDia.find(c => c.estado !== 'completada') || null;
  const citasVencidasSet = useMemo(() => {
    if (!isCurrentDateToday) return new Set();
    return new Set(
      citasDelDia
        .filter(c => c.estado !== 'completada' && (toMinutes(c.fechaHora) + INTERVALO_MINUTOS) <= nowMinutes)
        .map(c => c.id)
    );
  }, [citasDelDia, isCurrentDateToday, nowMinutes, INTERVALO_MINUTOS]);
  const atrasadasTimeline = citasVencidasSet.size;
  const siguienteCitaId = siguienteCita?.id;

  const primerSlotConCitasKey = useMemo(
    () => timeSlots.find(slot => (citasPorSlot.get(slot.key) || []).length > 0)?.key || null,
    [timeSlots, citasPorSlot]
  );

  const primerSlotVencidasKey = useMemo(
    () => timeSlots.find(slot => (citasPorSlot.get(slot.key) || []).some(cita => citasVencidasSet.has(cita.id)))?.key || null,
    [timeSlots, citasPorSlot, citasVencidasSet]
  );

  const slotObjetivoActualKey = useMemo(() => {
    if (slotActual) return slotActual.key;
    const slotConSiguiente = timeSlots.find(slot => (citasPorSlot.get(slot.key) || []).some(cita => cita.id === siguienteCitaId));
    return slotConSiguiente?.key || primerSlotConCitasKey;
  }, [slotActual, timeSlots, citasPorSlot, siguienteCitaId, primerSlotConCitasKey]);

  const rangoActual = slotActual
    ? `${slotActual.startTime} - ${slotActual.endTime}`
    : null;

  const scrollToSlotKey = (slotKey, behavior = 'smooth') => {
    const container = timelineBodyRef.current;
    const targetNode = timelineSlotRefs.current?.[slotKey];
    if (!container || !targetNode) return false;
    const top = targetNode.offsetTop - (container.clientHeight / 2) + (targetNode.clientHeight / 2);
    container.scrollTo({ top: Math.max(0, top), behavior });
    return true;
  };

  const enfocarTimeline = (slotKey) => {
    if (!slotKey) return;

    const runScroll = (behavior = 'smooth') => {
      scrollToSlotKey(slotKey, behavior);
    };

    runScroll('auto');
    const frameId = requestAnimationFrame(() => runScroll('smooth'));
    const timeoutId = setTimeout(() => runScroll('smooth'), 160);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  };

  useEffect(() => {
    if (vista !== 'dashboard') return;

    const targetKey = timelineFiltro === 'vencidas'
      ? primerSlotVencidasKey
      : timelineFiltro === 'curso'
        ? (slotActual?.key || slotObjetivoActualKey)
        : slotObjetivoActualKey;

    if (!targetKey) return;
    return enfocarTimeline(targetKey);
  }, [timeSlots, vista, currentDate, timelineFiltro, slotActual, primerSlotVencidasKey, slotObjetivoActualKey]);

  const onClickPacientes = () => {
    setTimelineFiltro('pacientes');
    if (primerSlotConCitasKey) {
      enfocarTimeline(primerSlotConCitasKey);
    }
    const nombres = citasDelDia.map(c => c.paciente).filter(Boolean);
    if (nombres.length === 0) {
      showToast('No hay pacientes agendados hoy', 'warning');
      return;
    }
    const preview = nombres.slice(0, 4).join(', ');
    const extra = nombres.length > 4 ? ` +${nombres.length - 4}` : '';
    showToast(`Pacientes hoy: ${preview}${extra}`, 'success');
  };

  const onClickAhora = () => {
    setTimelineFiltro('all');
    if (slotObjetivoActualKey) {
      enfocarTimeline(slotObjetivoActualKey);
    }
  };

  const onClickEnCurso = () => {
    if (!slotActual && !siguienteCitaId) {
      showToast('No hay consulta en curso en este momento', 'warning');
      return;
    }
    setTimelineFiltro('curso');
    enfocarTimeline(slotActual?.key || slotObjetivoActualKey);
  };

  const onClickVencidas = () => {
    if (atrasadasTimeline === 0) {
      showToast('No hay consultas vencidas por ahora', 'success');
      return;
    }
    setTimelineFiltro('vencidas');
    enfocarTimeline(primerSlotVencidasKey);
  };

  const citasOperativasDia = citasDelDia.filter((cita) => cita.estado !== 'cancelada');
  const citasCompletadasDia = citasOperativasDia.filter((cita) => cita.estado === 'completada');

  const cumplimientoDia = citasOperativasDia.length > 0
    ? Math.round((citasCompletadasDia.length / citasOperativasDia.length) * 100)
    : 0;

  const duraciones = citasCompletadasDia
    .map((cita) => Number.parseInt(cita.duracionRealMin, 10))
    .filter((valor) => Number.isFinite(valor) && valor > 0);
  const duracionMedia = duraciones.length > 0
    ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
    : 0;

  const iniciosRegistrados = citasCompletadasDia
    .map((cita) => {
      const programada = parseFechaHora(cita.fechaHora);
      const inicioReal = toDateSafe(cita.consultaIniciadaAt);
      if (!programada || !inicioReal) return null;
      return Math.round((inicioReal - programada) / 60000);
    })
    .filter((valor) => Number.isFinite(valor));
  const iniciosPuntuales = iniciosRegistrados.filter((valor) => valor <= 10).length;
  const puntualidadInicio = iniciosRegistrados.length > 0
    ? Math.round((iniciosPuntuales / iniciosRegistrados.length) * 100)
    : 0;
  const retrasosInicio = iniciosRegistrados.filter((valor) => valor > 0);
  const retrasoMedio = retrasosInicio.length > 0
    ? Math.round(retrasosInicio.reduce((acumulado, valor) => acumulado + valor, 0) / retrasosInicio.length)
    : 0;

  const duracionesProgramadas = citasOperativasDia
    .map((cita) => {
      const inicioProgramado = parseFechaHora(cita.fechaHora);
      const finProgramado = parseFechaHora(cita.fechaHoraFin || '');
      if (inicioProgramado && finProgramado) {
        const diferencia = Math.round((finProgramado - inicioProgramado) / 60000);
        if (Number.isFinite(diferencia) && diferencia > 0) return diferencia;
      }
      return Number(cita.duracionMin || cita.duracion || INTERVALO_MINUTOS);
    })
    .filter((valor) => Number.isFinite(valor) && valor > 0);
  const ventanaMedia = duracionesProgramadas.length > 0
    ? Math.round(duracionesProgramadas.reduce((acumulado, valor) => acumulado + valor, 0) / duracionesProgramadas.length)
    : 0;
  const ocupacionHoyMin = duracionesProgramadas.reduce((acumulado, valor) => acumulado + valor, 0);

  const citasConTriageCompleto = citasOperativasDia.filter((cita) => Boolean(cita.signos_vitales) || cita.estado === 'completada').length;
  const coberturaTriage = citasOperativasDia.length > 0
    ? Math.round((citasConTriageCompleto / citasOperativasDia.length) * 100)
    : 0;

  const ultimoAcceso = toDateSafe(user?.lastLogin || user?.metadata?.lastSignInTime);
  const ultimaActividad = toDateSafe(user?.lastSeen);
  const sesionActiva = Boolean(user?.isOnline) || (ultimaActividad && ((currentTime - ultimaActividad) / 60000) <= 10);
  const corteSesion = sesionActiva ? currentTime : ultimaActividad;
  const tiempoActivoMin = ultimoAcceso && corteSesion
    ? Math.max(0, Math.round((corteSesion - ultimoAcceso) / 60000))
    : 0;

  const sugerenciasComportamiento = [
    ultimoAcceso
      ? `${sesionActiva ? 'Sesión activa' : 'Último logueo'} desde las ${formatMetricClock(ultimoAcceso)}${ultimaActividad ? ` con actividad registrada a las ${formatMetricClock(ultimaActividad)}` : ''}.`
      : 'Aún no hay referencia de logueo reciente para este perfil en agenda.',
    puntualidadInicio > 0 && puntualidadInicio < 80
      ? `La puntualidad de inicio está en ${puntualidadInicio}%. Revisa transiciones entre paciente y paciente para recuperar ritmo.`
      : iniciosRegistrados.length > 0
        ? 'Los inicios de consulta se mantienen dentro de una ventana saludable para la agenda.'
        : 'Aún no hay inicios de consulta suficientes para evaluar puntualidad hoy.',
    retrasoMedio > 10 || (ventanaMedia > 0 && duracionMedia > ventanaMedia + 5)
      ? 'La atención real está rebasando la ventana planeada; conviene abrir colchones entre bloques para proteger puntualidad.'
      : duracionMedia > 0
        ? 'La duración real de consulta se mantiene alineada con la ventana programada.'
        : 'Todavía no hay duración capturada suficiente para comparar ritmo contra agenda.',
    coberturaTriage > 0 && coberturaTriage < 85
      ? `La cobertura de triage va en ${coberturaTriage}%. Adelantar signos vitales ayudaría a suavizar el arranque de cada consulta.`
      : citasOperativasDia.length > 0
        ? 'La preparación previa del paciente acompaña bien el flujo clínico.'
        : 'Aún no hay suficiente actividad del día para evaluar preparación previa.',
    cumplimientoDia < 75 && citasOperativasDia.length > 0
      ? 'El cumplimiento del día está por debajo de meta operativa. Vale la pena revisar huecos, cancelaciones y tiempos muertos.'
      : citasOperativasDia.length > 0
        ? 'El cumplimiento del día va alineado con la carga programada.'
        : 'Todavía no hay carga suficiente en agenda para generar una lectura de cumplimiento.'
  ];

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{STYLES}</style>

      <div className="agenda-root">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}

        {/* ══ HEADER ══════════════════════════════════════════════ */}
        <header className="app-header">
          <div className="header-left">
            <div className="user-avatar">
              {user?.nombre?.[0]?.toUpperCase() || 'D'}
            </div>
            <div className="user-info">
              <div className="user-name">
                Hola, {user?.nombre?.split(' ')[0] || 'Doctor'}
                {isDoctorRole && consultorioActivoLabel && (
                  <span className="badge-consultorio-name">
                    <Stethoscope size={10}/> {consultorioActivoLabel}
                  </span>
                )}
              </div>
              <div className="user-meta">
                <span className="badge-branch">
                  <MapPin size={8}/> {sucursalActivaLabel}
                </span>
                <span className="status-online"><span className="dot-pulse"></span>En línea</span>
              </div>
            </div>
          </div>

          <div className="header-center">
            <div className="view-switcher">
              <button
                className={`view-btn ${vista === 'dashboard' ? 'active' : ''}`}
                onClick={() => setVista('dashboard')}
              ><ClipboardList size={13}/> Día</button>
              <button
                className={`view-btn ${vista === 'semanal' ? 'active' : ''}`}
                onClick={() => setVista('semanal')}
              ><CalendarDays size={13}/> Semana</button>
            </div>
          </div>

          <div className="header-right">
            {isAdminRole && (
              <button className="icon-btn icon-btn-amber" onClick={() => navigate('/admin/dashboard')} title="Volver a Admin">
                <ShieldCheck size={16}/>
              </button>
            )}

            <div style={{ position:'relative' }}>
              <button className="icon-btn" onClick={() => setShowNotifications(!showNotifications)} title="Noticias médicas">
                <Newspaper size={16}/>
                {totalNotificaciones > 0 && <span className="notif-badge">{totalNotificaciones}</span>}
              </button>
              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-hdr">
                    <span className="notif-hdr-title">Noticias médicas</span>
                    <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                      <button
                        className="icon-btn"
                        style={{ width: 28, height: 28, borderRadius: 8 }}
                        onClick={() => cargarNoticiasMedicas({ forzar: true })}
                        title="Actualizar noticias"
                      >
                        <RefreshCw size={13} className={noticiasLoading ? 'animate-spin' : ''}/>
                      </button>
                      <span className="notif-hdr-badge">{noticiasNoLeidas} nuevas</span>
                    </div>
                  </div>
                  <div className="notif-list scroll">
                    {noticiasMedicas.length > 0 ? noticiasMedicas.map((noticia) => (
                      <div key={noticia.id} className="notif-item">
                        <div className="notif-avatar"><FileText size={15}/></div>
                        <div>
                          <div className="notif-name">{noticia.titulo}</div>
                          <div className="notif-desc">{noticia.resumen}</div>
                          <div className="notif-desc" style={{ marginTop: 4, fontWeight: 700 }}>
                            {noticia.categoria} • {noticia.impacto?.toUpperCase() || 'MEDIO'}
                          </div>
                          <div className={`notif-source ${noticia.fuenteValidada ? 'notif-source-ok' : 'notif-source-warn'}`}>
                            <span>{noticia.fuenteValidada ? 'Fuente validada' : 'Fuente en verificación'}: {noticia.fuente}</span>
                            {noticia.url && (
                              <a href={noticia.url} target="_blank" rel="noreferrer" className="notif-link">
                                Ver <ExternalLink size={11}/>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="notif-empty">
                        <Info size={28} strokeWidth={1.5}/>
                        <p>{noticiasLoading ? 'Actualizando boletín...' : 'Sin noticias por ahora'}</p>
                      </div>
                    )}
                  </div>
                  {noticiasActualizadasAt && (
                    <div style={{ padding: '10px 14px', fontSize: 10, color: 'var(--slate-400)', fontWeight: 700, borderTop: '1px solid var(--slate-100)' }}>
                      Actualizado: {new Date(noticiasActualizadasAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="icon-btn" onClick={() => navigate('/pacientes')} title="Directorio de pacientes">
              <Users size={16}/>
            </button>
            <button className="icon-btn icon-btn-purple" onClick={() => window.dispatchEvent(new Event('open-global-chat'))} title="Chat">
              <MessageCircle size={16}/>
            </button>

            <button className="icon-btn" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={16}/>
            </button>

            <div className="divider-v"></div>

            <button
              className="btn-notify"
              onClick={notificarSiguientePaciente}
              disabled={notificandoPaciente}
              title="Enviar WhatsApp automático al siguiente paciente"
            >
              {notificandoPaciente
                ? <><RefreshCw size={14} className="spin-icon"/> Enviando...</>
                : <><BellRing size={14}/> Notificar</>}
            </button>
            <button className="btn-primary" onClick={() => {
              setNuevaCita((prev) => ({
                ...prev,
                fecha: toInputDateValue(currentDate),
                hora: '',
                horaFin: ''
              }));
              setShowCitaModal(true);
            }}>
              <Plus size={14}/> Nueva Cita
            </button>
          </div>
        </header>

        {/* ══ MAIN ════════════════════════════════════════════════ */}
        <div className="main-content">

          {/* ── VISTA DÍA ─────────────────────────────────────── */}
          {vista === 'dashboard' && (
            <>
              {/* LEFT SIDEBAR */}
              <div className="sidebar-left">
                {/* Calendar widget */}
                <div className="panel cal-widget">
                  <div className="cal-nav">
                    <button className="cal-nav-btn" onClick={() => cambiarDia(-1)}><ChevronLeft size={14}/></button>
                    <span className="cal-month">
                      {currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    </span>
                    <button className="cal-nav-btn" onClick={() => cambiarDia(1)}><ChevronRight size={14}/></button>
                  </div>
                  <div className="cal-day-number sora">{currentDate.getDate()}</div>
                  <div className="cal-weekday">
                    {currentDate.toLocaleDateString('es-MX', { weekday: 'long' })}
                  </div>
                  {!isCurrentDateToday && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                      <button 
                        onClick={() => setCurrentDate(new Date())}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '999px', gap: '6px', background: 'var(--blue-50)', color: 'var(--blue-700)', boxShadow: 'none', border: '1px solid var(--blue-200)' }}
                      >
                        <CalendarClock size={12} /> Ir a hoy
                      </button>
                    </div>
                  )}
                </div>

                {/* Finance widget */}
                <div className="panel finance-widget">
                  <div className="widget-label"><TrendingUp size={13}/> Comportamiento</div>
                  <div className="finance-main">
                    <div className="finance-main-label">Tiempo activo</div>
                    <div className="finance-main-value sora">{formatMetricMinutes(tiempoActivoMin)}</div>
                  </div>
                  <div className="finance-grid">
                    <div className="finance-cell">
                      <div className="finance-cell-label">Último acceso</div>
                      <div className="finance-cell-value sora">{formatMetricClock(ultimoAcceso)}</div>
                    </div>
                    <div className="finance-cell">
                      <div className="finance-cell-label">Última actividad</div>
                      <div className="finance-cell-value sora">{formatMetricClock(ultimaActividad)}</div>
                    </div>
                  </div>

                  <div className="finance-stack">
                    <div className="finance-kpi">
                      <span className="finance-kpi-label"><Clock size={12}/> Duración media</span>
                      <span className="finance-kpi-value sora">{duracionMedia > 0 ? `${duracionMedia} min` : 'N/D'}</span>
                    </div>
                    <div className="finance-kpi">
                      <span className="finance-kpi-label"><CalendarClock size={12}/> Ventana media</span>
                      <span className="finance-kpi-value sora">{ventanaMedia > 0 ? `${ventanaMedia} min` : 'N/D'}</span>
                    </div>
                    <div className="finance-kpi">
                      <span className="finance-kpi-label"><LogIn size={12}/> Logueo</span>
                      <span className="finance-kpi-value sora">{sesionActiva ? 'Activo' : 'Inactivo'}</span>
                    </div>
                    <div className="finance-kpi">
                      <span className="finance-kpi-label"><Activity size={12}/> Inicio puntual</span>
                      <span className="finance-kpi-value sora">{iniciosRegistrados.length > 0 ? `${puntualidadInicio}%` : 'N/D'}</span>
                    </div>
                    <div className="finance-kpi">
                      <span className="finance-kpi-label"><AlertTriangle size={12}/> Retraso medio</span>
                      <span className="finance-kpi-value sora">{retrasoMedio > 0 ? `${retrasoMedio} min` : 'N/D'}</span>
                    </div>
                    <div className="finance-kpi">
                      <span className="finance-kpi-label"><ClipboardList size={12}/> Cobertura triage</span>
                      <span className="finance-kpi-value sora">{citasOperativasDia.length > 0 ? `${coberturaTriage}%` : 'N/D'}</span>
                    </div>
                    <div className="finance-kpi">
                      <span className="finance-kpi-label"><Users size={12}/> Ocupación hoy</span>
                      <span className="finance-kpi-value sora">{formatMetricMinutes(ocupacionHoyMin)}</span>
                    </div>
                  </div>

                  <div className="finance-insights">
                    <div className="finance-insights-title"><Info size={12}/> Sugerencias</div>
                    {sugerenciasComportamiento.map((sugerencia, idx) => (
                      <div key={idx} className="finance-insight-item">• {sugerencia}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CENTER: TIMELINE */}
              <div className="timeline-panel panel">
                <div className="timeline-header">
                  <h2 className="timeline-title sora">Consultas del día</h2>
                  <div className="timeline-meta">
                    <button className={`count-badge timeline-action-btn ${timelineFiltro === 'pacientes' ? 'active' : ''}`} onClick={onClickPacientes}>
                      {citasDelDia.length} pacientes
                    </button>
                    <button className={`timeline-chip timeline-chip-btn timeline-action-btn now ${timelineFiltro === 'all' ? 'active' : ''}`} onClick={onClickAhora}>
                      <Clock size={11}/> Ahora {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </button>
                    {rangoActual
                      ? (
                        <button className={`timeline-chip timeline-chip-btn timeline-action-btn current ${timelineFiltro === 'curso' ? 'active' : ''}`} onClick={onClickEnCurso}>
                          <Activity size={11}/> En curso {rangoActual}
                        </button>
                      )
                      : (
                        <button className="timeline-chip timeline-chip-btn timeline-action-btn next" onClick={onClickEnCurso}>
                          <Stethoscope size={11}/> Sin consulta en curso
                        </button>
                      )}
                    {atrasadasTimeline > 0 && (
                      <button className={`timeline-chip timeline-chip-btn timeline-action-btn warn ${timelineFiltro === 'vencidas' ? 'active' : ''}`} onClick={onClickVencidas}>
                        <AlertTriangle size={11}/> {atrasadasTimeline} vencida{atrasadasTimeline > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                </div>

                <div ref={timelineBodyRef} className="timeline-body scroll">
                  {(() => {
                    const slotsVisibles = timeSlots.filter((slot) => {
                      if (citasDelDia.length === 0) return true;
                      const citasEnSlot = citasPorSlot.get(slot.key) || [];
                      if (timelineFiltro === 'pacientes') return citasEnSlot.length > 0;
                      if (timelineFiltro === 'curso') {
                        if (slotActual) return slot.key === slotActual.key;
                        return citasEnSlot.some(c => c.id === siguienteCitaId);
                      }
                      if (timelineFiltro === 'vencidas') return citasEnSlot.some(c => citasVencidasSet.has(c.id));
                      return true;
                    });

                    if (slotsVisibles.length === 0) {
                      return (
                        <div className="empty-state">
                          <div className="empty-icon"><Info size={22} strokeWidth={1.5}/></div>
                          <span className="empty-title">
                            {timelineFiltro === 'vencidas'
                              ? 'No hay consultas vencidas en el horario'
                              : timelineFiltro === 'curso'
                                ? 'No hay consulta activa en este momento'
                                : 'No hay pacientes en estos bloques'}
                          </span>
                        </div>
                      );
                    }

                    return slotsVisibles.map((slot) => {
                    const citasEnSlot = citasPorSlot.get(slot.key) || [];
                    const esBloqueado = !!slotsBloqueados[slot.startTime];
                    const estaSeleccionado = slotsSeleccionados.has(slot.startTime);
                    const justificacionSlot = esBloqueado ? slotsBloqueados[slot.startTime]?.justificacion : '';
                    const citasFiltradas = citasEnSlot.filter((cita) => {
                      if (timelineFiltro === 'vencidas') return citasVencidasSet.has(cita.id);
                      if (timelineFiltro === 'curso') {
                        if (slotActual) return slot.key === slotActual.key;
                        return cita.id === siguienteCitaId;
                      }
                      return true;
                    });
                    const todasCanceladas = citasFiltradas.length > 0 && citasFiltradas.every(c => c.estado === 'cancelada');
                    const nodeClass = esBloqueado
                      ? 'node-blocked'
                      : todasCanceladas
                      ? 'node-cancelled'
                      : slot.isCurrent
                      ? 'node-waiting'
                      : (citasFiltradas.length > 0 && citasFiltradas.every(c => c.estado === 'completada'))
                        ? 'node-done'
                        : 'node-pending';

                    return (
                      <div
                        key={slot.key}
                        ref={(node) => {
                          if (node) timelineSlotRefs.current[slot.key] = node;
                          else delete timelineSlotRefs.current[slot.key];
                        }}
                        className={`cita-row ${slot.isCurrent ? 'current-slot' : slot.isPast ? 'past-slot' : ''} ${esBloqueado ? 'blocked-slot' : ''}`}
                      >
                        {/* ── TIME PILL (clickable para bloquear) ── */}
                          <div
                            className={`cita-time cita-time-pill ${estaSeleccionado ? 'pill-selected' : ''} ${esBloqueado ? 'pill-blocked' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleSlotSeleccionado(slot.startTime, e.shiftKey); }}
                            title={esBloqueado ? `Bloqueado: ${justificacionSlot || 'Sin justificación'}` : 'Click para seleccionar y bloquear'}
                          >
                            {estaSeleccionado ? (
                              <CheckCircle size={12} style={{ position: 'absolute', top: 4, right: 2, color: esBloqueado ? 'var(--green-500, #22c55e)' : 'var(--red-500, #ef4444)' }}/>
                            ) : (
                              <div className="pill-checkbox" />
                            )}
                            <span className="cita-time-main sora">{slot.startTime}</span>
                            <span className="cita-time-range">{slot.value}</span>
                          </div>

                        <div className="cita-node-col">
                          <div className={`cita-node ${nodeClass}`}></div>
                        </div>

                        <div style={{ flex: 1 }}>
                          {(() => {
                            const citasActivas = citasFiltradas.filter(c => c.estado !== 'cancelada');
                            
                            return (
                              <>
                                {citasFiltradas.map((cita) => {
                                  const estadoKey = getEstadoDetallado(cita).key;
                                  const isDone = estadoKey === 'completada';
                                  const isWaiting = estadoKey === 'esperando_consulta';
                                  const isCancelada = estadoKey === 'cancelada';
                                  const isEnTriage = estadoKey === 'en_triage';
                                  const isEnConsulta = estadoKey === 'en_consulta';
                                  const isSiguiente = cita.id === siguienteCitaId;
                                  const isVencida = citasVencidasSet.has(cita.id) && !isCancelada;

                                  return (
                                    <div
                                      key={cita.id}
                                      className={`cita-card ${isCancelada ? 'cancelled' : isEnConsulta ? 'waiting' : isWaiting ? 'waiting' : isDone ? 'done' : ''} ${isSiguiente && !isCancelada ? 'siguiente' : ''} ${isVencida && !isDone ? 'overdue' : ''}`}
                                      onDragOver={(e) => handleDragOverCard(e, cita.id, cita)}
                                      onDragLeave={handleDragLeaveCard}
                                      onDrop={(e) => handleDropOnCard(e, cita)}
                                      style={dragOverCitaId === cita.id && !isCancelada ? { border: '2px solid #14b8a6', boxShadow: '0 0 0 4px rgba(20,184,166,0.15)', background: 'rgba(240,253,250,0.6)', transform: 'scale(1.02)', transition: 'all .15s ease' } : {}}
                                    >
                                      {isSiguiente && !isCancelada && (
                                        <div className="badge-siguiente">
                                          <Stethoscope size={12}/> Turno Actual
                                        </div>
                                      )}

                                      <div>
                                        <div className={`cita-name ${isDone || isCancelada ? 'done-name' : ''}`}>{cita.paciente}</div>
                                        <div className="cita-tags">
                                          <span className="tag tag-motivo">{cita.motivo}</span>
                                          {(() => {
                                            const consultorioStr = cita.consultorioNombre || 
                                              (typeof cita.consultorio === 'string' ? cita.consultorio : cita.consultorio?.nombre);
                                            if (consultorioStr && consultorioStr.trim() !== '') {
                                              return (
                                                <span className="tag tag-consultorio" style={{ background: 'var(--slate-50)', color: 'var(--slate-500)', border: '1px solid var(--slate-200)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                  <MapPin size={10}/> {consultorioStr}
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                          {isCancelada && <span className="tag" style={{ background: 'var(--red-100)', color: 'var(--red-700)' }}><XCircle size={10}/> Cancelada</span>}
                                          {slot.isCurrent && !isCancelada && <span className="tag tag-waiting"><Clock size={10}/> En horario</span>}
                                          {slot.isPast && !isDone && !isCancelada && <span className="tag tag-pending"><AlertTriangle size={10}/> Reprogramar</span>}
                                          {isVencida && !isDone && !isCancelada && <span className="tag tag-overdue"><AlertTriangle size={10}/> Vencida</span>}
                                          {/* Estado detallado del paciente */}
                                          {isEnTriage && !isCancelada && <span className="tag tag-triage"><Activity size={10}/> En triage</span>}
                                          {isWaiting && !isCancelada && <span className="tag tag-en-espera"><Clock size={10}/> Esperando consulta</span>}
                                          {isEnConsulta && !isCancelada && !isDone && <span className="tag tag-en-consulta"><Stethoscope size={10}/> En consulta</span>}
                                          {cita.estado === 'pendiente' && !isEnTriage && !isDone && !isCancelada && <span className="tag tag-pending">Esperando triage</span>}
                                          {cita.notificadoWhatsApp && !isCancelada && <span className="tag tag-done"><Send size={10}/> Notificado</span>}
                                          {isDone && !isCancelada && <span className="tag tag-done"><Check size={10}/> Terminado</span>}
                                          {cita.esTeleconsulta && <span className="tag tag-tele"><Video size={10}/> Teleconsulta</span>}
                                        </div>
                                      </div>

                                      <div className="cita-actions">
                                        {!isCancelada && cita.pacienteTelefono && !isDone && !cita.notificadoWhatsApp && (
                                          <button
                                            className="act-btn green"
                                            onClick={() => notificarPaciente(cita)}
                                            disabled={notificandoCitaId === cita.id}
                                            title="Notificar por WhatsApp"
                                          >
                                            {notificandoCitaId === cita.id ? <RefreshCw size={15} className="spin-icon"/> : <Send size={15}/>}
                                          </button>
                                        )}
                                        {!isCancelada && cita.pacienteTelefono && !isDone && cita.notificadoWhatsApp && (
                                          <button className="act-btn" style={{color:'var(--green-600)',cursor:'default'}} title="Ya notificado">
                                            <Check size={15}/>
                                          </button>
                                        )}
                                        {!isDone && cita.estado !== 'pendiente' && !isCancelada && (
                                          <button className="act-btn green" onClick={() => cambiarEstado(cita.id, 'completada')} title="Marcar finalizada">
                                            <ShieldCheck size={15}/>
                                          </button>
                                        )}
                                        {cita.estado === 'pendiente' && !isCancelada && (
                                          <button className="act-pill act-pill-rose" onClick={() => setCitaUrgencia(cita)}>
                                            <AlertTriangle size={12}/> Urgencia
                                          </button>
                                        )}
                                        {cita.estado !== 'pendiente' && !isCancelada && (
                                          <button
                                            className="act-pill act-pill-blue"
                                            onClick={() => navigate('/doctor/expediente', {
                                              state: {
                                                pacienteId: cita.pacienteId,
                                                citaId: cita.id,
                                                pacienteNombre:
                                                  cita.pacienteNombre
                                                  || cita.paciente
                                                  || [cita.nombre, cita.apellidoPaterno, cita.apellidoMaterno].filter(Boolean).join(' ').trim()
                                              }
                                            })}
                                          >
                                            {isDone ? 'Ver expediente' : 'Iniciar consulta'}
                                          </button>
                                        )}
                                        <button className="act-pill" style={{background:'white',color:'var(--blue-700)',border:'1px solid var(--blue-200)'}} onClick={() => setSelectedCita(cita)}>
                                          {isCancelada ? 'Detalles' : isDone ? 'Ver' : cita.estado === 'pendiente' ? 'Ver' : 'Detalles'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                {citasActivas.length === 0 && (
                                  esBloqueado ? (
                                    <div
                                      className="slot-empty"
                                      style={{ borderColor: 'var(--red-200, #fecaca)', background: 'var(--red-50, #fef2f2)', color: 'var(--red-500, #ef4444)', fontWeight: 700, cursor: 'default' }}
                                    >
                                      <Lock size={14} style={{ marginRight: 6, opacity: .7 }}/>
                                      Horario bloqueado{justificacionSlot ? ` — ${justificacionSlot}` : ''}
                                    </div>
                                  ) : (
                                    <div
                                      className="slot-empty"
                                      style={{ cursor: 'pointer', transition: 'all .15s' }}
                                      onClick={() => {
                                        const duracionMotivo = getDuracionMotivo(nuevaCita.motivoId);
                                        setNuevaCita(prev => ({
                                          ...prev,
                                          fecha: toInputDateValue(currentDate),
                                          hora: slot.startTime,
                                          horaFin: calcularHoraFin(slot.startTime, duracionMotivo)
                                        }));
                                        setShowCitaModal(true);
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-300)'; e.currentTarget.style.background = 'var(--blue-50, #eff6ff)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
                                    >
                                      <Plus size={14} style={{ marginRight: 6, opacity: .5 }}/>
                                      Agendar en este horario
                                    </div>
                                  )
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  });
                })()}
                </div>

                {/* Barra flotante selección de horarios */}
                {slotsSeleccionados.size > 0 && (
                  <div style={{
                    padding: '12px 20px', borderTop: '2px solid var(--slate-200)',
                    background: 'white', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12, flexShrink: 0,
                    flexWrap: 'wrap',
                    boxShadow: '0 -4px 12px rgba(0,0,0,.06)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={16} style={{ color: 'var(--slate-500)' }}/>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>
                        {slotsSeleccionados.size} horario{slotsSeleccionados.size !== 1 ? 's' : ''} seleccionado{slotsSeleccionados.size !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end', flex: '1 1 280px' }}>
                      <button
                        onClick={cancelarSeleccion}
                        style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--slate-200)', background: 'white', color: 'var(--slate-600)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                      {(accionBloqueoSeleccion === 'desbloquear' || accionBloqueoSeleccion === 'mixto') && (
                        <button
                          onClick={() => { setShowBloqueoModal('desbloquear'); setJustificacionBloqueo(''); }}
                          style={{
                            padding: '8px 20px', borderRadius: 10, border: '1px solid var(--green-300, #86efac)',
                            background: 'var(--green-50, #f0fdf4)', color: 'var(--green-700, #15803d)',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={13}/> Desbloquear</span>
                        </button>
                      )}
                      {(accionBloqueoSeleccion === 'bloquear' || accionBloqueoSeleccion === 'mixto') && (
                        <button
                          onClick={() => { setShowBloqueoModal('bloquear'); setJustificacionBloqueo(''); }}
                          style={{
                            padding: '8px 20px', borderRadius: 10, border: 'none',
                            background: 'var(--red-600, #dc2626)', color: 'white',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13}/> Bloquear</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT SIDEBAR: INVENTORY & TOOLS */}
              <div className="sidebar-right" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="panel inv-panel" style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="inv-header" style={{ flexShrink: 0 }}>
                    <div className="inv-title"><Syringe size={14}/> Alertas de Inventario</div>
                    <div className="inv-sub">Medicamentos próximos a caducar</div>
                  </div>
                  <div className="inv-list scroll" style={{ flex: 1, overflowY: 'auto' }}>
                    {alertasCaducidad.length > 0 ? alertasCaducidad.map(item => (
                      <div key={item.id} className="inv-item">
                        <div style={{ flex:1, overflow:'hidden' }}>
                          <div className="inv-item-name">{item.medicamento || item.compuesto}</div>
                          <div className="inv-item-lot">Lote: {item.lote}</div>
                        </div>
                        <div className={`inv-days ${item.riesgo === 'alto' ? 'high' : 'mid'}`}>
                          <div className="inv-days-num sora">{item.diasRestantes}</div>
                          <div className="inv-days-label">días</div>
                        </div>
                      </div>
                    )) : (
                      <div className="inv-empty">
                        <ShieldCheck size={30} strokeWidth={1.5}/>
                        <div className="inv-empty-text">Sin medicamentos<br/>en riesgo</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* NUEVA SECCIÓN: HERRAMIENTAS / ACCIONES */}
                <div className="panel tools-panel" style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="inv-header">
                    <div className="inv-title"><Syringe size={14}/> Herramientas</div>
                    <div className="inv-sub">Accesos rápidos</div>
                  </div>
                  <div className="tools-list scroll" style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', overflowY: 'auto', flex: 1, alignContent: 'start' }}>
                    
                    <button className="tool-btn" onClick={() => setShowCatalogoMedicamentos(true)}>
                      <div className="tool-btn-icon"><Pill size={18}/></div>
                      <div className="tool-btn-label sora">Catálogo</div>
                    </button>

                    <button className="tool-btn" onClick={() => navigate(isDoctorRole ? '/doctor/capacitacion' : '/enfermeria/capacitacion')}>
                      <div className="tool-btn-icon"><BookOpen size={18}/></div>
                      <div className="tool-btn-label sora">Capacitación</div>
                    </button>

                    <button className="tool-btn">
                      <div className="tool-btn-icon"><AlertTriangle size={18}/></div>
                      <div className="tool-btn-label sora">Mermas</div>
                    </button>

                    <button className="tool-btn">
                      <div className="tool-btn-icon"><Users size={18}/></div>
                      <div className="tool-btn-label sora">Directorio</div>
                    </button>

                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── VISTA SEMANAL ────────────────────────────────────── */}
          {vista === 'semanal' && (
            <div className="weekly-panel">
              <div className="weekly-scroll">
                {/* Header días */}
                <div className="weekly-header" style={{ gridTemplateColumns: '72px repeat(6, 1fr)' }}>
                  <div style={{ borderRight:'1px solid var(--slate-100)', background:'white' }}></div>
                  {weekDays.map((day, i) => {
                    const isToday = new Date().toDateString() === day.toDateString();
                    return (
                      <div key={i} className="weekly-header-cell" style={{ background: isToday ? 'var(--blue-50)' : 'white' }}>
                        <div className="wday-name" style={{ color: isToday ? 'var(--blue-600)' : 'var(--slate-400)' }}>
                          {day.toLocaleDateString('es-MX', { weekday: 'short' })}
                        </div>
                        <div className={`wday-num ${isToday ? 'wday-today' : 'wday-other'} sora`}>{day.getDate()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Grid de horas */}
                <div className="weekly-body scroll">
                  {hours.map((hour) => (
                    <div key={hour} className="weekly-row" style={{ gridTemplateColumns: '72px repeat(6, 1fr)' }}>
                      <div className={`weekly-hour-cell ${isCurrentHour(hour) ? 'now' : ''}`}>
                        {hour}:00
                      </div>
                      {weekDays.map((day, di) => {
                        const citasHora = getCitasPorHora(day, hour);
                        return (
                          <div key={di} className="weekly-day-cell"
                            onClick={() => {
                              const hora = `${String(hour).padStart(2,'0')}:00`;
                              const duracionMotivo = getDuracionMotivo(nuevaCita.motivoId);
                              setNuevaCita({ ...nuevaCita, fecha: toInputDateValue(day), hora, horaFin: calcularHoraFin(hora, duracionMotivo) });
                              setShowCitaModal(true);
                            }}>
                            <div className="weekly-add-hint">
                              <div className="weekly-add-icon"><Plus size={14}/></div>
                            </div>
                            <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:4 }}>
                              {citasHora.map(cita => {
                                const isDone    = cita.estado === 'completada';
                                const isWaiting = cita.estado === 'en_espera';
                                return (
                                  <div key={cita.id}
                                    className={`weekly-cita ${isDone ? 'wc-done' : isWaiting ? 'wc-waiting' : 'wc-default'}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedCita(cita); }}>
                                    <div className="weekly-cita-name sora">{cita.paciente}</div>
                                    {!isDone && <div className="weekly-cita-motivo">{cita.motivo}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ DETAIL DRAWER ════════════════════════════════════════ */}
        <div className={`detail-overlay ${selectedCita ? 'open' : ''}`}>
          <div className="detail-backdrop" onClick={() => setSelectedCita(null)}/>
          <div className="detail-drawer">
            {selectedCita && (
              <>
                {/* Hidden file input for upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                  className="hidden"
                  accept="*/*"
                />
                <div className="drawer-hdr">
                  <button className="drawer-close" onClick={() => setSelectedCita(null)}><XCircle size={18}/></button>
                  <div className="drawer-meta">
                    <Clock size={13} style={{ color:'var(--blue-500)' }}/>
                    {selectedCita.fechaHora?.split('T')[1]?.substring(0,5)} • {selectedCita.motivo}
                  </div>
                  <div className="drawer-name">{selectedCita.paciente}</div>
                  {selectedCita.pacienteId && (
                    <button
                      onClick={async () => {
                        try {
                          const snap = await getDoc(doc(db, 'pacientes', selectedCita.pacienteId));
                          if (snap.exists()) { setPacienteAEditar({ id: snap.id, ...snap.data() }); setShowPacienteModal(true); }
                        } catch (e) { console.error('Error cargando paciente', e); }
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '6px 12px', borderRadius: 8, border: '1px solid #bfdbfe', cursor: 'pointer', marginTop: 8, transition: 'all .15s' }}
                    >
                      <Edit3 size={12}/> Editar Paciente
                    </button>
                  )}
                </div>

                {selectedCita.signos_vitales && (
                  <div className="vitals-grid">
                    <div className="vital-card">
                      <div className="vital-label">Presión</div>
                      <div className="vital-value sora">{selectedCita.signos_vitales.ta || '--'}</div>
                    </div>
                    <div className={`vital-card ${selectedCita.signos_vitales.temp > 37.5 ? 'alert' : ''}`}>
                      <div className={`vital-label ${selectedCita.signos_vitales.temp > 37.5 ? 'alert-label' : ''}`}>Temp</div>
                      <div className={`vital-value sora ${selectedCita.signos_vitales.temp > 37.5 ? 'alert-value' : ''}`}>
                        {selectedCita.signos_vitales.temp || '--'}°
                      </div>
                    </div>
                    <div className="vital-card">
                      <div className="vital-label">SpO₂</div>
                      <div className="vital-value sora">{selectedCita.signos_vitales.spo2 || '--'}%</div>
                    </div>
                  </div>
                )}

                <div className="drawer-body">
                  {selectedCita.estado === 'pendiente' && !selectedCita.signos_vitales && (
                    <div style={{ margin: '0 16px 8px', padding: '8px 12px', borderRadius: 10, background: '#fefce8', border: '1px solid #fef08a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={14} style={{ color: '#ca8a04' }}/>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#854d0e' }}>Triage pendiente — signos vitales no capturados</span>
                    </div>
                  )}
                  {(() => {
                    return (
                    <>
                    <div className="action-grid">
                      <button
                        className="action-card ac-neutral"
                        onClick={() => navigate('/doctor/expediente', {
                          state: {
                            pacienteId: selectedCita.pacienteId,
                            citaId: selectedCita.id,
                            pacienteNombre:
                              selectedCita.pacienteNombre
                              || selectedCita.paciente
                              || [selectedCita.nombre, selectedCita.apellidoPaterno, selectedCita.apellidoMaterno].filter(Boolean).join(' ').trim()
                          }
                        })}
                      >
                        <div className="action-card-icon"><ClipboardList size={22}/></div>
                        {selectedCita.estado === 'completada' ? 'Ver expediente clínico' : 'Abrir expediente clínico'}
                      </button>
                      {selectedCita.pacienteId && !isDoctorRole && (
                        <button
                          className="action-card ac-neutral"
                          onClick={() => navigate('/enfermeria/antecedentes', {
                            state: {
                              pacienteId: selectedCita.pacienteId,
                              nombre: selectedCita.paciente || selectedCita.pacienteNombre || ''
                            }
                          })}
                        >
                          <div className="action-card-icon"><FileText size={22}/></div>
                          Antecedentes
                        </button>
                      )}
                    </div>

                    {/* ── ACCIONES RÁPIDAS ── */}
                    <div style={{ padding: '12px 16px 0' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Acciones Rápidas</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

                        {/* Llegada */}
                        <button
                          onClick={handleRegistrarLlegada}
                          disabled={selectedCita.llegadaRegistrada || actionLoading === 'llegada'}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: `1px solid ${selectedCita.llegadaRegistrada ? '#bbf7d0' : '#e2e8f0'}`, background: selectedCita.llegadaRegistrada ? '#f0fdf4' : 'white', cursor: selectedCita.llegadaRegistrada ? 'default' : 'pointer', transition: 'all .15s', textAlign: 'center' }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedCita.llegadaRegistrada ? '#dcfce7' : '#f1f5f9', color: selectedCita.llegadaRegistrada ? '#16a34a' : '#64748b' }}>
                            {actionLoading === 'llegada' ? <RefreshCw size={16} className="spin-icon"/> : <LogIn size={16}/>}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: selectedCita.llegadaRegistrada ? '#15803d' : '#334155' }}>{selectedCita.llegadaRegistrada ? 'Llegada ✓' : 'Llegada'}</div>
                            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{selectedCita.llegadaRegistrada ? 'Paciente presente' : 'Confirmar presencia'}</div>
                          </div>
                        </button>

                        {/* Recordatorio WhatsApp */}
                        <button
                          onClick={handleEnviarRecordatorio}
                          disabled={selectedCita.recordatorioEnviado || actionLoading === 'whatsapp'}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: `1px solid ${selectedCita.recordatorioEnviado ? '#bbf7d0' : '#e2e8f0'}`, background: selectedCita.recordatorioEnviado ? '#f0fdf4' : 'white', cursor: selectedCita.recordatorioEnviado ? 'default' : 'pointer', transition: 'all .15s', textAlign: 'center' }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedCita.recordatorioEnviado ? '#dcfce7' : '#f1f5f9', color: selectedCita.recordatorioEnviado ? '#16a34a' : '#64748b' }}>
                            {actionLoading === 'whatsapp' ? <RefreshCw size={16} className="spin-icon"/> : <MessageSquare size={16}/>}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: selectedCita.recordatorioEnviado ? '#15803d' : '#334155' }}>{selectedCita.recordatorioEnviado ? 'Enviado ✓' : 'Recordatorio'}</div>
                            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{selectedCita.recordatorioEnviado ? 'Ya notificado' : 'Enviar WhatsApp'}</div>
                          </div>
                        </button>

                        {/* Reprogramar */}
                        <button
                          onClick={() => {
                            setReprogramarData({
                              fecha: selectedCita.fecha || toInputDateValue(new Date()),
                              hora: selectedCita.hora || selectedCita.fechaHora?.split('T')[1]?.substring(0,5) || '',
                              horaFin: selectedCita.horaFin || ''
                            });
                            setShowReprogramar(true);
                          }}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b' }}><CalendarClock size={16}/></div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Reprogramar</div>
                            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Cambiar fecha/hora</div>
                          </div>
                        </button>

                        {/* Documentos */}
                        {selectedCita.pacienteId && (
                          <button
                            onClick={handleGenerarDocumento}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}
                          >
                            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b' }}><FileText size={16}/></div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Documentos</div>
                              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Generar plantilla</div>
                            </div>
                          </button>
                        )}

                        {/* Cargar Estudio (upload) */}
                        {selectedCita.pacienteId && (
                          <button
                            onClick={handleUploadEstudioClick}
                            disabled={uploadingEstudio}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: '1px solid #ccfbf1', background: '#f0fdfa', cursor: uploadingEstudio ? 'default' : 'pointer', transition: 'all .15s', textAlign: 'center', opacity: uploadingEstudio ? 0.6 : 1 }}
                          >
                            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ccfbf1', color: '#0d9488' }}>
                              {uploadingEstudio ? <RefreshCw size={16} className="spin-icon"/> : <Upload size={16}/>}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e' }}>Cargar Estudio</div>
                              <div style={{ fontSize: 9, color: '#5eead4', marginTop: 2 }}>{uploadingEstudio ? 'Subiendo...' : 'Arrastra o haz clic'}</div>
                            </div>
                          </button>
                        )}

                        {/* Unificar */}
                        {selectedCita.pacienteId && (
                          <button
                            onClick={() => setShowUnificar(true)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}
                          >
                            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b' }}><GitMerge size={16}/></div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Unificar</div>
                              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Fusionar duplicados</div>
                            </div>
                          </button>
                        )}

                        {/* Editar cita */}
                        <button
                          onClick={() => {
                            setEditarCitaData({
                              paciente: selectedCita.paciente || '',
                              motivo: selectedCita.motivo || '',
                              motivoId: selectedCita.motivoId || '',
                              tipoConsulta: selectedCita.tipoConsulta || 'primera_vez',
                              doctorUid: selectedCita.doctorUid || '',
                              doctorAsignado: selectedCita.doctorAsignado || '',
                              notas: selectedCita.notas || ''
                            });
                            setShowEditarCita(true);
                          }}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b' }}><Edit3 size={16}/></div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Editar cita</div>
                            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Corregir datos</div>
                          </div>
                        </button>

                        {/* Abrir Orden Enfermeria */}
                        {selectedCita.esCitaEnfermeria && (
                          <button
                            onClick={() => window.open(`/enfermeria/orden-servicio?citaId=${selectedCita.id}`, '_blank')}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14, border: '1px solid #a7f3d0', background: '#ecfdf5', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}
                          >
                            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#d1fae5', color: '#059669' }}><ClipboardList size={16}/></div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>Orden</div>
                              <div style={{ fontSize: 9, color: '#047857', marginTop: 2 }}>Abrir Enfermería</div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                    </>
                    );
                  })()}
                </div>

                <div className="drawer-footer">
                  {selectedCita.estado !== 'completada' && selectedCita.estado !== 'pendiente' && (
                    <button className="btn-finish" onClick={() => { cambiarEstado(selectedCita.id,'completada'); setSelectedCita(null); }}>
                      Finalizar consulta
                    </button>
                  )}
                  {/* Cancelar cita */}
                  <button
                    onClick={() => setShowCancelarConfirm(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 10, background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all .15s' }}
                  >
                    <XCircle size={13}/> Cancelar esta cita
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══ SUB-MODAL REPROGRAMAR ═══ */}
        {showReprogramar && (
          <div className="modal-overlay" onClick={() => setShowReprogramar(false)}>
            <div className="modal-box" style={{ maxWidth: 380, padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}><CalendarClock size={17} style={{ color: '#6366f1' }}/> Reprogramar</div>
                <button onClick={() => setShowReprogramar(false)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><XCircle size={18}/></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nueva Fecha</label>
                  <input type="date" value={reprogramarData.fecha} onChange={e => setReprogramarData(p => ({ ...p, fecha: e.target.value }))}
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#334155', outline: 'none' }}/>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Hora Inicio</label>
                    <input type="time" value={reprogramarData.hora} onChange={e => setReprogramarData(p => ({ ...p, hora: e.target.value, horaFin: sumarMinutos(e.target.value, INTERVALO_MINUTOS) }))}
                      style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#334155', outline: 'none' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Hora Fin</label>
                    <input type="time" value={reprogramarData.horaFin} onChange={e => setReprogramarData(p => ({ ...p, horaFin: e.target.value }))}
                      style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#334155', outline: 'none' }}/>
                  </div>
                </div>
              </div>
              <button onClick={handleReprogramar} disabled={actionLoading === 'reprogramar'}
                style={{ width: '100%', marginTop: 16, padding: '12px 0', background: '#4f46e5', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: actionLoading === 'reprogramar' ? 0.6 : 1 }}>
                {actionLoading === 'reprogramar' ? <><RefreshCw size={14} className="spin-icon"/> Reprogramando...</> : 'Confirmar Reprogramación'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ SUB-MODAL CANCELAR ═══ */}
        {/* ═══ SUB-MODAL EDITAR CITA ═══ */}
        {showEditarCita && selectedCita && (
          <div className="modal-overlay" onClick={() => setShowEditarCita(false)}>
            <div className="modal-box" style={{ maxWidth: 420, padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}><Edit3 size={17} style={{ color: '#6366f1' }}/> Editar Cita</div>
                <button onClick={() => setShowEditarCita(false)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><XCircle size={18}/></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nombre del paciente</label>
                  <input
                    type="text"
                    value={editarCitaData.paciente}
                    onChange={e => setEditarCitaData(p => ({ ...p, paciente: e.target.value }))}
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#334155', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Motivo de consulta</label>
                  <select
                    value={editarCitaData.motivoId}
                    onChange={e => {
                      const m = catalogoMotivos.find(x => x.id === e.target.value);
                      setEditarCitaData(p => ({ ...p, motivoId: e.target.value, motivo: m?.nombre || p.motivo }));
                    }}
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#334155', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">— Sin cambiar —</option>
                    {catalogoMotivos.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Tipo de consulta</label>
                  <select
                    value={editarCitaData.tipoConsulta}
                    onChange={e => setEditarCitaData(p => ({ ...p, tipoConsulta: e.target.value }))}
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#334155', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="primera_vez">Primera vez</option>
                    <option value="seguimiento">Seguimiento</option>
                    <option value="urgencia">Urgencia</option>
                  </select>
                </div>
                {catalogoDoctores.length > 0 && (
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Médico responsable</label>
                    <select
                      value={editarCitaData.doctorUid}
                      onChange={e => {
                        const d = catalogoDoctores.find(x => x.id === e.target.value);
                        setEditarCitaData(p => ({ ...p, doctorUid: e.target.value, doctorAsignado: d?.nombre || p.doctorAsignado }));
                      }}
                      style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#334155', outline: 'none', boxSizing: 'border-box' }}
                    >
                      <option value="">— Sin cambiar —</option>
                      {catalogoDoctores.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Notas adicionales</label>
                  <textarea
                    value={editarCitaData.notas}
                    onChange={e => setEditarCitaData(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Notas u observaciones..."
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#334155', outline: 'none', resize: 'none', height: 60, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <button
                onClick={handleGuardarEditarCita}
                disabled={actionLoading === 'editarCita' || !editarCitaData.paciente.trim()}
                style={{ width: '100%', marginTop: 16, padding: '12px 0', background: '#4f46e5', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (actionLoading === 'editarCita' || !editarCitaData.paciente.trim()) ? 0.6 : 1 }}>
                {actionLoading === 'editarCita' ? <><RefreshCw size={14} className="spin-icon"/> Guardando...</> : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {showCancelarConfirm && selectedCita && (
          <div className="modal-overlay" onClick={() => { setShowCancelarConfirm(false); setCancelarMotivo(''); }}>
            <div className="modal-box" style={{ maxWidth: 380, padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, background: '#fef2f2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={18} style={{ color: '#ef4444' }}/></div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Cancelar Cita</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Esta acción no se puede deshacer</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                ¿Cancelar la cita de <strong>{selectedCita.paciente}</strong>?
              </p>
              <textarea
                value={cancelarMotivo} onChange={e => setCancelarMotivo(e.target.value)}
                placeholder="Motivo de cancelación (opcional)..."
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#334155', outline: 'none', resize: 'none', height: 70, marginBottom: 14 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowCancelarConfirm(false); setCancelarMotivo(''); }}
                  style={{ flex: 1, padding: '10px 0', background: '#f1f5f9', color: '#475569', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                  Volver
                </button>
                <button onClick={handleCancelarCita} disabled={actionLoading === 'cancelar'}
                  style={{ flex: 1, padding: '10px 0', background: '#ef4444', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: actionLoading === 'cancelar' ? 0.6 : 1 }}>
                  {actionLoading === 'cancelar' ? <><RefreshCw size={14} className="spin-icon"/> Cancelando...</> : 'Sí, Cancelar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL UNIFICAR ═══ */}
        {showUnificar && selectedCita?.pacienteId && (
          <ModalUnificarExpedientes
            pacienteId={selectedCita.pacienteId}
            pacienteNombre={selectedCita.paciente}
            onClose={() => setShowUnificar(false)}
            showToast={showToast}
          />
        )}

        {/* ══ MODAL URGENCIA ════════════════════════════════════════ */}
        {citaUrgencia && (
          <div className="modal-overlay">
            <div className="modal-box urg-modal">
              <div className="urg-hdr">
                <div className="urg-icon"><AlertTriangle size={30} strokeWidth={2}/></div>
                <div className="urg-title">Protocolo de Urgencia</div>
                <div className="urg-desc">Saltar Triage para <strong>{citaUrgencia.paciente}</strong></div>
              </div>
              <div className="urg-actions">
                <button className="btn-urg-cancel" onClick={() => setCitaUrgencia(null)}>Cancelar</button>
                <button className="btn-urg-confirm" onClick={() => {
                  navigate('/doctor/expediente', {
                    state: {
                      pacienteId: citaUrgencia.pacienteId,
                      citaId: citaUrgencia.id,
                      motivo: "URGENCIA: " + citaUrgencia.motivo,
                      pacienteNombre:
                        citaUrgencia.pacienteNombre
                        || citaUrgencia.paciente
                        || [citaUrgencia.nombre, citaUrgencia.apellidoPaterno, citaUrgencia.apellidoMaterno].filter(Boolean).join(' ').trim()
                    }
                  });
                  setCitaUrgencia(null);
                }}>
                  <Stethoscope size={15}/> Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL NUEVA CITA ══════════════════════════════════════ */}
        {showCitaModal && (() => {
          const inputStyle = "w-full p-3 bg-white/50 border border-slate-200/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700 placeholder:text-slate-400";
          const labelStyle = "text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 ml-1";

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" style={{ margin: 0 }}>
              <div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-[2rem] w-full max-w-[600px] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center bg-white/40 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                      <CalendarClock size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 leading-tight">Agendar Cita</h2>
                      <p className="text-xs font-medium text-slate-500">Complete los detalles de la consulta</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowCitaModal(false)}
                    className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm border border-slate-100 transition-all"
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                {/* Body */}
                <form onSubmit={handleGuardarCita} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                  
                  {/* 1. Paciente */}
                  <div className="bg-white/60 p-4 rounded-2xl border border-white shadow-sm space-y-4">
                    <div>
                        <label className={labelStyle}>Paciente</label>
                        <div className="flex gap-2 relative">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    required 
                                    type="text" 
                                    placeholder="Buscar paciente por nombre o ID..."
                                    className={`${inputStyle} pl-10`}
                                    value={nuevaCita.paciente}
                                    onChange={e => {
                                        setNuevaCita({ ...nuevaCita, paciente: e.target.value, pacienteId: '', pacienteTelefono: '' });
                                        const txt = e.target.value.toLowerCase().trim();
                                        if (txt.length > 1) {
                                            fetchPacientesSugerencias(txt);
                                        } else setMostrarSugerencias(false);
                                    }}
                                />
                                {mostrarSugerencias && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-48 overflow-y-auto custom-scrollbar py-1">
                                        {sugerencias.length > 0 ? sugerencias.map(p => (
                                            <div 
                                                key={p.id} 
                                                className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 transition-colors"
                                                onClick={() => { seleccionarPaciente(p); setMostrarSugerencias(false); }}
                                            >
                                                {p.nombre}{p.idPaciente ? <span className="text-slate-400 text-xs ml-1">({p.idPaciente})</span> : ''}
                                            </div>
                                        )) : (
                                            <div className="px-4 py-3 text-xs text-slate-400 text-center font-medium">No hay coincidencias</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowPacienteModal(true)}
                                className="w-[46px] h-[46px] shrink-0 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all border border-indigo-100 hover:shadow-md"
                                title="Nuevo Paciente"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>
                  </div>

                  {/* 2. Fecha y Horarios */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                          <label className={labelStyle}>Fecha</label>
                          <input 
                              required 
                              type="date" 
                              className={inputStyle}
                              value={nuevaCita.fecha}
                              onChange={e => setNuevaCita({ ...nuevaCita, fecha: e.target.value })}
                          />
                      </div>
                      <div className="flex gap-2">
                          <div className="flex-1">
                              <label className={labelStyle}>Inicio</label>
                              <input 
                                  required 
                                  type="time" 
                                  className={inputStyle}
                                  value={nuevaCita.hora}
                                  onChange={e => {
                                      const duracionMotivo = getDuracionMotivo(nuevaCita.motivoId);
                                      setNuevaCita({ ...nuevaCita, hora: e.target.value, horaFin: calcularHoraFin(e.target.value, duracionMotivo) });
                                  }}
                              />
                          </div>
                          <div className="flex-1">
                              <label className={labelStyle}>Fin</label>
                              <input 
                                  required 
                                  type="time" 
                                  className={`${inputStyle} bg-slate-50/50 cursor-not-allowed text-slate-400`}
                                  value={nuevaCita.horaFin || ''}
                                  readOnly
                              />
                          </div>
                      </div>
                  </div>

                  {/* 3. Motivo */}
                  <div>
                      <label className={labelStyle}>Motivo de consulta</label>
                      <CustomDropdown 
                          options={catalogoMotivos.map(m => ({ 
                              value: m.id, 
                              label: isAdminRole 
                                  ? `${m.nombre} • $${Number(m.precio || 0).toFixed(2)} • ${m.area} • ${Number(m.duracionMin || INTERVALO_MINUTOS)} min${m.atendidoPorEnfermeria ? ' • Enfermería' : ''}`
                                  : m.nombre 
                          }))}
                          value={nuevaCita.motivoId}
                          onChange={val => {
                              const selected = catalogoMotivos.find(m => m.id === val);
                              const duracionMotivo = Number(selected?.duracionMin || INTERVALO_MINUTOS);
                              const horaFin = nuevaCita.hora ? calcularHoraFin(nuevaCita.hora, duracionMotivo) : nuevaCita.horaFin;
                              setNuevaCita({
                                  ...nuevaCita,
                                  motivoId: val,
                                  motivo: selected?.nombre || 'Consulta',
                                  horaFin,
                                  esTeleconsulta: selected?.teleconsultaPermitida === false ? false : nuevaCita.esTeleconsulta,
                                  enfermeroAsignadoId: selected?.atendidoPorEnfermeria ? nuevaCita.enfermeroAsignadoId : '',
                                  enfermeroAsignadoNombre: selected?.atendidoPorEnfermeria ? nuevaCita.enfermeroAsignadoNombre : ''
                              });
                          }}
                          placeholder="Seleccionar motivo..."
                          inputStyle={inputStyle}
                      />
                  </div>

                  {/* 4. Médico/Enfermero, Tipo, Sucursal, Consultorio */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Enfermero */}
                      {catalogoMotivos.find(m => m.id === nuevaCita.motivoId)?.atendidoPorEnfermeria && (
                          <div>
                              <label className={`${labelStyle} text-indigo-600`}>Enfermero/a asignado/a</label>
                              <CustomDropdown 
                                  options={catalogoEnfermeros.map(enf => ({ value: enf.id, label: enf.nombre }))}
                                  value={nuevaCita.enfermeroAsignadoId}
                                  onChange={val => {
                                      const enf = catalogoEnfermeros.find(en => en.id === val);
                                      setNuevaCita({ ...nuevaCita, enfermeroAsignadoId: val, enfermeroAsignadoNombre: enf?.nombre || '' });
                                  }}
                                  placeholder="Seleccionar enfermero/a..."
                                  inputStyle={`${inputStyle} border-indigo-200 bg-indigo-50/30`}
                              />
                          </div>
                      )}

                      {/* Médico responsable (visible para no-doctores) */}
                      {!isDoctorRole && !catalogoMotivos.find(m => m.id === nuevaCita.motivoId)?.atendidoPorEnfermeria && (
                          <div>
                              <label className={`${labelStyle} text-blue-700`}>Médico responsable</label>
                              <CustomDropdown 
                                  options={catalogoDoctores.map(doc => ({ value: doc.id, label: doc.nombre }))}
                                  value={nuevaCita.doctorUid}
                                  onChange={val => {
                                      const docSelected = catalogoDoctores.find(d => d.id === val);
                                      setNuevaCita({ ...nuevaCita, doctorUid: val, doctorAsignado: docSelected?.nombre || '' });
                                  }}
                                  placeholder="Seleccionar médico..."
                                  inputStyle={`${inputStyle} border-blue-200 bg-blue-50/30`}
                              />
                          </div>
                      )}

                      {/* Tipo de Consulta */}
                      <div>
                          <label className={labelStyle}>Tipo de Consulta</label>
                          <CustomDropdown 
                              options={[
                                  { value: 'primera_vez', label: 'Primera vez' },
                                  { value: 'subsecuente', label: 'Subsecuente' }
                              ]}
                              value={nuevaCita.tipoConsulta}
                              onChange={val => setNuevaCita({ ...nuevaCita, tipoConsulta: val })}
                              placeholder="Seleccionar..."
                              inputStyle={inputStyle}
                          />
                      </div>

                      {/* Sucursal */}
                      {!consultorioSeleccionadoModal && (
                          <div>
                              <label className={labelStyle}>Sucursal</label>
                              <CustomDropdown 
                                  options={catalogoSucursales.map(s => ({ value: s.id, label: `${s.nombre} • ${s.ubicacion}` }))}
                                  value={nuevaCita.sucursalId}
                                  onChange={val => setNuevaCita({ ...nuevaCita, sucursalId: val })}
                                  placeholder="Seleccionar sucursal..."
                                  inputStyle={inputStyle}
                              />
                          </div>
                      )}

                      {/* Consultorio */}
                      {!consultorioSeleccionadoModal && (
                          <div>
                              <label className={labelStyle}>Consultorio</label>
                              <CustomDropdown 
                                    options={[...catalogoConsultorios].sort((a, b) => {
                                        const aEs = String(a.sucursalId || '') === String(nuevaCita.sucursalId || '');
                                        const bEs = String(b.sucursalId || '') === String(nuevaCita.sucursalId || '');
                                        if(aEs && !bEs) return -1;
                                        if(!aEs && bEs) return 1;
                                        return (a.nombre || '').localeCompare(b.nombre || '');
                                    }).map(c => {
                                        const sucursalDeConsultorio = catalogoSucursales.find(s => String(s.id) === String(c.sucursalId))?.nombre || 'General';
                                        const esDeSucursalSeleccionada = String(c.sucursalId || '') === String(nuevaCita.sucursalId || '');
                                        const labelAdmin = isAdminRole ? `${c.nombre} • ${c.especialidad} • ${c.horaInicio || '08:00'}-${c.horaFin || '18:00'}` : c.nombre;
                                        return { 
                                            value: c.id, 
                                            label: labelAdmin,
                                            sucursalNombre: sucursalDeConsultorio,
                                            esDeSucursalSeleccionada
                                        };
                                    })}
                                    value={nuevaCita.consultorioId}
                                    onChange={val => {
                                        const consultorio = catalogoConsultorios.find(c => c.id === val);
                                        setNuevaCita(prev => ({ 
                                            ...prev, 
                                            consultorioId: val, 
                                            sucursalId: consultorio?.sucursalId || prev.sucursalId 
                                        }));
                                    }}
                                    placeholder="Asignar Sala..."
                                    inputStyle={inputStyle}
                                    renderOption={(opt) => (
                                        <div className="flex flex-col w-full">
                                            <span className={`text-sm font-bold ${nuevaCita.consultorioId === opt.value ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.label}</span>
                                            <div className="flex items-center mt-0.5">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${opt.esDeSucursalSeleccionada ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                    {opt.sucursalNombre}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                />
                          </div>
                      )}
                  </div>

                  {/* Alertas de Sucursal/Consultorio */}
                  <div className="space-y-2">
                      {consultorioSeleccionadoModal && (
                        <div className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                          <Info size={14} className="mt-0.5 shrink-0" />
                          <span className="text-[11px] font-medium leading-relaxed">
                            Consultorio: {consultorioSeleccionadoModal.nombre} • {formatScheduleLabel(horarioConsultorioModal)}
                          </span>
                        </div>
                      )}
                      {sucursalSeleccionadaModal && (
                        <div className={`flex items-start gap-2 p-3 rounded-xl border ${consultorioFueraDeHorarioSucursal ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {consultorioFueraDeHorarioSucursal ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Info size={14} className="mt-0.5 shrink-0" />}
                          <span className="text-[11px] font-medium leading-relaxed">
                            Sucursal: {sucursalSeleccionadaModal.nombre} • {formatScheduleLabel(horarioSucursalModal)}
                            {consultorioSeleccionadoModal?.sucursalId ? ' (Ligada al consultorio)' : ''}
                            {consultorioFueraDeHorarioSucursal ? ' • ADVERTENCIA: El horario es menor al del consultorio.' : ''}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* 6. Teleconsulta */}
                  <div className="pt-2">
                      <label className="flex items-center p-4 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group">
                          <div className="relative flex items-center">
                              <input 
                                  type="checkbox" 
                                  className="peer sr-only"
                                  checked={nuevaCita.esTeleconsulta}
                                  onChange={e => setNuevaCita({ ...nuevaCita, esTeleconsulta: e.target.checked })}
                              />
                              <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                          </div>
                          <div className="ml-4 flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${nuevaCita.esTeleconsulta ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'} transition-colors`}>
                                  <Video size={16} />
                              </div>
                              <div>
                                  <div className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Teleconsulta</div>
                                  <div className="text-[10px] text-slate-500 font-medium">Generar enlace de Google Meet</div>
                              </div>
                          </div>
                      </label>
                  </div>

                </form>

                {/* Footer */}
                <div className="p-5 border-t border-white/40 bg-slate-50/50 shrink-0">
                  <button 
                      type="submit" 
                      onClick={handleGuardarCita}
                      className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                      <CheckCircle size={18} />
                      Confirmar Cita
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {showPacienteModal && (
          <ModalPaciente onClose={() => { setShowPacienteModal(false); setPacienteAEditar(null); }} onPacienteCreado={(p) => { handlePacienteCreado(p); setPacienteAEditar(null); }} pacienteAEditar={pacienteAEditar}/>
        )}

        {/* ── MODAL JUSTIFICACIÓN DE BLOQUEO ── */}
        {showBloqueoModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(4px)'
          }} onClick={() => { setShowBloqueoModal(null); setJustificacionBloqueo(''); }}>
            <div style={{
              background: 'white', borderRadius: 16, width: 420, maxWidth: '90vw', padding: '28px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,.18)'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                {showBloqueoModal === 'bloquear' ? (
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--red-50, #fef2f2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={18} style={{ color: 'var(--red-500, #ef4444)' }}/>
                  </div>
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--green-50, #f0fdf4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={18} style={{ color: 'var(--green-500, #22c55e)' }}/>
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--slate-800)' }}>
                    {showBloqueoModal === 'bloquear' ? 'Bloquear horarios' : 'Desbloquear horarios'}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--slate-500)' }}>
                    {slotsSeleccionados.size} horario{slotsSeleccionados.size !== 1 ? 's' : ''} seleccionado{slotsSeleccionados.size !== 1 ? 's' : ''}:
                    {' '}{Array.from(slotsSeleccionados).sort().join(', ')}
                  </p>
                </div>
              </div>

              {showBloqueoModal === 'bloquear' && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--slate-600)', marginBottom: 6 }}>
                    Justificación <span style={{ color: 'var(--red-500)' }}>*</span>
                  </label>
                  <textarea
                    value={justificacionBloqueo}
                    onChange={e => setJustificacionBloqueo(e.target.value)}
                    placeholder="Ej: Junta médica, capacitación, horario de comida..."
                    rows={3}
                    autoFocus
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--slate-200)',
                      fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--blue-400)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => { setShowBloqueoModal(null); setJustificacionBloqueo(''); }}
                  style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--slate-200)', background: 'white', color: 'var(--slate-600)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarBloqueo}
                  disabled={guardandoBloqueo || (showBloqueoModal === 'bloquear' && !justificacionBloqueo.trim())}
                  style={{
                    padding: '10px 24px', borderRadius: 10, border: 'none',
                    background: showBloqueoModal === 'bloquear' ? 'var(--red-600, #dc2626)' : 'var(--green-600, #16a34a)',
                    color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: (guardandoBloqueo || (showBloqueoModal === 'bloquear' && !justificacionBloqueo.trim())) ? 0.5 : 1
                  }}
                >
                  {guardandoBloqueo ? 'Guardando...' : showBloqueoModal === 'bloquear' ? 'Bloquear' : 'Desbloquear'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ══ MODAL CATÁLOGO MEDICAMENTOS ══════════════════════════════════════ */}
        {showCatalogoMedicamentos && (
          <ModalCatalogoMedicamentos onClose={() => setShowCatalogoMedicamentos(false)} />
        )}
      </div>
    </>
  );
};

export default Agenda;
