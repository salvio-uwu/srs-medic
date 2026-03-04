import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalIcon, Clock, Users, Plus, ChevronLeft, ChevronRight, 
  Search, MapPin, CheckCircle, XCircle, Video, MessageCircle, 
  AlertTriangle, DollarSign, Activity, CalendarDays, LayoutGrid,
  ShieldCheck, AlertCircle, Zap, FileText, Check, Bell, Info,
  Lock, Stethoscope, TrendingUp, Syringe, ChevronDown, ClipboardList, HeartPulse
} from 'lucide-react';
import { db } from '../config/firebase'; 
import { collection, addDoc, query, where, orderBy, updateDoc, doc, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ModalPaciente from '../components/ModalPaciente';
import sonidoCampana from '../assets/notificaciondeconsulta.wav';
import ChatPanel from '../components/ChatPanel';

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
    background: #ffffff; /* OPTIMIZACIÓN: Color sólido, sin blur */
    border-bottom: 1px solid var(--slate-200);
    box-shadow: var(--shadow-sm);
    padding: 0 32px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .header-left { display: flex; align-items: center; gap: 16px; }

  .user-avatar {
    width: 44px; height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--blue-500) 0%, var(--blue-700) 100%);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 700; font-size: 18px;
    font-family: 'Sora', sans-serif;
    box-shadow: 0 4px 12px rgba(0,119,182,.25);
    flex-shrink: 0;
    border: 2px solid rgba(255,255,255,.9);
  }

  .user-name {
    font-family: 'Sora', sans-serif;
    font-size: 17px; font-weight: 700;
    color: var(--slate-900); line-height: 1.2;
  }

  .user-meta { display: flex; align-items: center; gap: 10px; margin-top: 4px; }

  .badge-branch {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--slate-50); border: 1px solid var(--slate-200);
    border-radius: 6px; padding: 2px 8px;
    font-size: 10px; font-weight: 700; color: var(--slate-500);
    text-transform: uppercase; letter-spacing: .06em;
  }

  .status-online {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 600; color: var(--emerald-500);
  }

  .dot-pulse {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--emerald-500);
    box-shadow: 0 0 0 0 rgba(5,150,105,.5);
    animation: pulse-ring 1.8s ease infinite;
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(5,150,105,.5); }
    70%  { box-shadow: 0 0 0 6px rgba(5,150,105,0); }
    100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
  }

  .header-right { display: flex; align-items: center; gap: 10px; }

  /* ── VIEW SWITCHER ── */
  .view-switcher {
    display: flex; background: var(--slate-100);
    border: 1px solid var(--slate-200); border-radius: 8px;
    padding: 3px; gap: 2px;
  }
  .view-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 6px;
    font-size: 12px; font-weight: 600;
    border: none; cursor: pointer;
    transition: all .18s ease;
    color: var(--slate-500); background: transparent;
  }
  .view-btn.active {
    background: white; color: var(--blue-600);
    box-shadow: var(--shadow-sm);
  }
  .view-btn:not(.active):hover { color: var(--slate-700); }

  .divider-v { width: 1px; height: 32px; background: var(--slate-200); }

  /* ── ICON BUTTON ── */
  .icon-btn {
    position: relative;
    width: 40px; height: 40px; border-radius: 10px;
    border: 1px solid var(--slate-200); background: white;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-500); cursor: pointer;
    transition: all .18s ease;
    box-shadow: var(--shadow-sm);
  }
  .icon-btn:hover { color: var(--blue-600); border-color: var(--blue-200); background: var(--blue-50); }

  .notif-badge {
    position: absolute; top: -5px; right: -5px;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--rose-500); color: white;
    font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid white;
  }

  /* ── TEXT BUTTONS ── */
  .text-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 14px; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    border: none; cursor: pointer; background: transparent;
    color: var(--slate-600); transition: all .18s ease;
  }
  .text-btn:hover { color: var(--blue-600); background: var(--blue-50); }

  .chat-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 14px; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    border: 1px solid #e9d5ff; background: #faf5ff;
    color: #7c3aed; cursor: pointer; transition: all .18s ease;
  }
  .chat-btn:hover { background: #f3e8ff; border-color: #d8b4fe; }

  /* ── PRIMARY BUTTON ── */
  .btn-primary {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 20px; border-radius: 10px;
    font-size: 13px; font-weight: 700;
    font-family: 'Sora', sans-serif;
    background: var(--blue-600); color: white; border: none;
    cursor: pointer; box-shadow: var(--shadow-blue);
    transition: all .18s ease;
  }
  .btn-primary:hover { background: var(--blue-700); transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }

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
  }

  /* ── CALENDAR WIDGET ── */
  .cal-widget {
    padding: 24px; text-align: center;
    position: relative; overflow: hidden;
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

  .timeline-body {
    flex: 1; overflow-y: auto;
    padding: 24px 28px 80px;
    background: white;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
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
  .cita-row.completed { opacity: .5; }
  .cita-row.completed:hover { opacity: 1; }

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
  .cita-card.waiting {
    background: var(--blue-50); border-color: var(--blue-200);
  }
  .cita-card.waiting:hover { border-color: var(--blue-300); }
  .cita-card.done { background: var(--slate-50); border-style: solid; border-color: var(--slate-200); }

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
    font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
    text-transform: uppercase; letter-spacing: .04em;
  }
  .tag-motivo { color: var(--slate-600); background: var(--slate-100); border: 1px solid var(--slate-200); }
  .tag-waiting { background: white; color: var(--blue-700); border: 1px solid var(--blue-200); }
  .tag-pending { background: white; color: var(--amber-500); border: 1px solid #fde68a; }
  .tag-done    { background: transparent; color: var(--emerald-500); border: 1px solid #a7f3d0; }
  .tag-tele    { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }

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
  .notif-avatar {
    width: 34px; height: 34px; border-radius: 8px;
    background: var(--blue-100); color: var(--blue-600);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .notif-name { font-size: 13px; font-weight: 700; color: var(--slate-900); margin-bottom: 2px; }
  .notif-desc { font-size: 11px; color: var(--slate-500); }
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

  /* ── DETAIL DRAWER ── */
  .detail-overlay {
    position: fixed; inset: 0; z-index: 50;
    display: flex; justify-content: flex-end;
    pointer-events: none;
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
    width: 420px; background: white;
    display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform .35s cubic-bezier(.4,0,.2,1);
    box-shadow: -8px 0 20px rgba(15,23,42,.08);
  }
  .detail-overlay.open .detail-drawer { transform: translateX(0); }

  .drawer-hdr {
    padding: 28px 28px 24px;
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
    font-size: 26px; font-weight: 800;
    color: var(--slate-900); line-height: 1.15;
  }

  .vitals-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 10px; padding: 20px 28px;
    border-bottom: 1px solid var(--slate-200);
    background: var(--slate-50);
  }
  .vital-card {
    background: white; border: 1px solid var(--slate-200);
    border-radius: 10px; padding: 12px; text-align: center;
  }
  .vital-card.alert { background: #fff1f2; border-color: #fecdd3; }
  .vital-label { font-size: 9px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px; }
  .vital-label.alert-label { color: var(--rose-500); }
  .vital-value { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 800; color: var(--slate-900); }
  .vital-value.alert-value { color: #be123c; }

  .drawer-body { flex: 1; padding: 20px 28px; }

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

  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .action-card {
    padding: 20px; border-radius: 10px; border: 1px solid;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    cursor: pointer; transition: all .15s; font-size: 13px; font-weight: 700;
    background: white;
  }
  .action-card-icon {
    width: 44px; height: 44px; border-radius: 10px;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const START_HOUR = 8;
  const END_HOUR   = 20;
  const hours      = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const MOTIVOS_CONSULTA = [
    "Consulta","Valoración","Estudios","Vacunas","Valoracion sin costo",
    "Aplicacion de medicamento","Nota de urgencia","Nota de evolución",
    "Nota de traslado","Nota de interconsulta","Rehabilitación","Post-cirugía"
  ];

  /* ── STATES ── */
  const [citas, setCitas]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [currentDate, setCurrentDate]       = useState(new Date());
  const [audio]                             = useState(new Audio(sonidoCampana));
  const prevCitasLength                     = useRef(0);
  const [toast, setToast]                   = useState(null);
  const [vista, setVista]                   = useState('dashboard');
  const [isChatOpen, setIsChatOpen]         = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCitaModal, setShowCitaModal]   = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [selectedCita, setSelectedCita]     = useState(null);
  const [citaUrgencia, setCitaUrgencia]     = useState(null);
  const [todosLosPacientes, setTodosLosPacientes] = useState([]);
  const [sugerencias, setSugerencias]       = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [alertasCaducidad, setAlertasCaducidad]     = useState([]);
  const [nuevaCita, setNuevaCita]           = useState({
    paciente: '', pacienteId: '', pacienteTelefono: '',
    fecha: new Date().toISOString().split('T')[0], hora: '',
    motivo: 'Consulta', esTeleconsulta: false,
    doctorAsignado: user?.rol === 'medico' ? user.nombre : ''
  });
  const COMISIONES = { dia: 1200, semana: 8500, mes: 34200 };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── CITAS SNAPSHOT ── */
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const citasRef = collection(db, "citas");
    const q = user?.rol === 'medico'
      ? query(citasRef, where("doctorUid","==",user.uid), orderBy("fechaHora","asc"))
      : query(citasRef, orderBy("fechaHora","asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nuevasCitas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (prevCitasLength.current > 0) {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          if (change.type === "added") { audio.volume = 0.4; audio.play().catch(() => {}); }
          if (change.type === "modified" && data.estado === 'en_espera') {
            audio.volume = 1.0; audio.play().catch(() => {});
            if (Notification.permission === "granted")
              new Notification("Paciente Listo", { body: `${data.paciente} está listo para consulta.` });
            showToast(`${data.paciente} está listo para pasar`, 'success');
          }
        });
      }
      prevCitasLength.current = nuevasCitas.length;
      setCitas(nuevasCitas);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, audio]);

  /* ── INVENTARIO ── */
  useEffect(() => {
    const unsubInventario = onSnapshot(collection(db, 'inventario'), (snap) => {
      const hoy = new Date();
      const limit = new Date(); limit.setMonth(hoy.getMonth() + 3);
      const alertas = [];
      snap.docs.forEach(doc => {
        const item = doc.data();
        if (item.caducidad) {
          const fCad = new Date(item.caducidad);
          if (fCad <= limit && item.stock > 0) {
            const dias = Math.ceil((fCad - hoy) / 86400000);
            alertas.push({ id: doc.id, ...item, diasRestantes: dias, riesgo: dias <= 30 ? 'alto' : 'medio' });
          }
        }
      });
      setAlertasCaducidad(alertas.sort((a,b) => a.diasRestantes - b.diasRestantes));
    });
    return () => unsubInventario();
  }, []);

  /* ── NOTIFICATIONS ── */
  useEffect(() => {
    if (Notification.permission !== "granted" && Notification.permission !== "denied")
      Notification.requestPermission();
  }, []);

  /* ── PACIENTES ── */
  const fetchPacientes = async () => {
    try {
      const q = query(collection(db, "pacientes"), orderBy("nombre"));
      const snapshot = await getDocs(q);
      setTodosLosPacientes(snapshot.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombreCompleto || d.data().nombre,
        telefono: d.data().telefonoMovil || ''
      })));
    } catch {}
  };
  useEffect(() => { if (user) fetchPacientes(); }, [user]);

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
    const p = { id: nuevoPaciente.id, nombre: nuevoPaciente.nombreCompleto, telefono: nuevoPaciente.telefonoMovil };
    setTodosLosPacientes(prev => [...prev, p]);
    seleccionarPaciente(p);
    setShowPacienteModal(false);
  };

  const seleccionarPaciente = (p) => {
    setNuevaCita({ ...nuevaCita, paciente: p.nombre, pacienteId: p.id, pacienteTelefono: p.telefono });
    setMostrarSugerencias(false);
  };

  const generarLinkMeet = () => `https://meet.google.com/abc-defg-hij`;

  const enviarWhatsApp = (telefono, mensaje) => {
    if (!telefono) return showToast("El paciente no tiene teléfono registrado","error");
    let phone = telefono.replace(/\D/g,'');
    if (phone.length === 10) phone = `52${phone}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const handleGuardarCita = async (e) => {
    e.preventDefault();
    try {
      let meetLink = '';
      if (nuevaCita.esTeleconsulta) meetLink = generarLinkMeet();
      await addDoc(collection(db, "citas"), {
        ...nuevaCita, meetLink,
        fechaHora: `${nuevaCita.fecha}T${nuevaCita.hora}`,
        doctorUid: user.rol === 'medico' ? user.uid : "uid_generico",
        sucursal: user.sucursal || "Central",
        estado: 'pendiente'
      });
      if (nuevaCita.esTeleconsulta && nuevaCita.pacienteTelefono) {
        const mensaje = `Hola ${nuevaCita.paciente}, su teleconsulta de "${nuevaCita.motivo}" es el ${nuevaCita.fecha} a las ${nuevaCita.hora}. Link: ${meetLink}`;
        if (window.confirm("¿Enviar enlace por WhatsApp?")) enviarWhatsApp(nuevaCita.pacienteTelefono, mensaje);
      }
      setShowCitaModal(false);
      setNuevaCita({ paciente:'',pacienteId:'',pacienteTelefono:'',fecha:'',hora:'',motivo:'Consulta',esTeleconsulta:false,doctorAsignado:'' });
      showToast("Cita agendada correctamente");
    } catch (error) { showToast(error.message,"error"); }
  };

  const cambiarEstado = async (id, estado) => {
    await updateDoc(doc(db,"citas",id), { estado });
    if (estado === 'cancelada') setSelectedCita(null);
    if (estado === 'completada') showToast("Consulta finalizada","success");
  };

  const getCitasPorHora = (date, hour) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return citas.filter(c => {
      const [cDate, cTime] = c.fechaHora.split('T');
      return cDate === dateStr && parseInt(cTime.split(':')[0]) === hour;
    });
  };

  const getCitasDelDia = () => {
    const dateStr = currentDate.toLocaleDateString('en-CA');
    return citas.filter(c => c.fechaHora.startsWith(dateStr))
                .sort((a,b) => a.fechaHora.localeCompare(b.fechaHora));
  };

  const cambiarDia = (dias) => {
    const f = new Date(currentDate);
    f.setDate(f.getDate() + dias);
    setCurrentDate(f);
  };

  const isCurrentHour = (h) => new Date().getHours() === h;
  const pacientesEnEspera   = getCitasDelDia().filter(c => c.estado === 'en_espera');
  const totalNotificaciones = pacientesEnEspera.length;

  // --- Calcular el siguiente paciente a atender ---
  const citasDelDia = getCitasDelDia();
  const siguienteCitaId = citasDelDia.find(c => c.estado !== 'completada')?.id;

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
            <div>
              <div className="user-name">Hola, {user?.nombre?.split(' ')[0] || 'Doctor'}</div>
              <div className="user-meta">
                <span className="badge-branch"><MapPin size={9}/> {user?.sucursal || 'Central'}</span>
                <span className="status-online"><span className="dot-pulse"></span>En línea</span>
              </div>
            </div>
          </div>

          <div className="header-right">
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

            <div className="divider-v"></div>

            {/* Notificaciones */}
            <div style={{ position:'relative' }}>
              <button className="icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={17}/>
                {totalNotificaciones > 0 && <span className="notif-badge">{totalNotificaciones}</span>}
              </button>
              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-hdr">
                    <span className="notif-hdr-title">Notificaciones</span>
                    <span className="notif-hdr-badge">{totalNotificaciones} nuevas</span>
                  </div>
                  {pacientesEnEspera.length > 0 ? pacientesEnEspera.map(p => (
                    <div key={p.id} className="notif-item" onClick={() => { setSelectedCita(p); setShowNotifications(false); }}>
                      <div className="notif-avatar"><Users size={15}/></div>
                      <div>
                        <div className="notif-name">{p.paciente}</div>
                        <div className="notif-desc">Listo en sala • Triage completado</div>
                      </div>
                    </div>
                  )) : (
                    <div className="notif-empty">
                      <ShieldCheck size={28} strokeWidth={1.5}/>
                      <p>Todo al día</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="text-btn" onClick={() => navigate('/pacientes')}>
              <Users size={15}/> Directorio
            </button>
            <button className="chat-btn" onClick={() => setIsChatOpen(true)}>
              <MessageCircle size={15}/> Chat
            </button>
            <button className="btn-primary" onClick={() => setShowCitaModal(true)}>
              <Plus size={15}/> Nueva Cita
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
                </div>

                {/* Finance widget */}
                <div className="panel finance-widget">
                  <div className="widget-label"><TrendingUp size={13}/> Finanzas</div>
                  <div className="finance-main">
                    <div className="finance-main-label">Generado hoy</div>
                    <div className="finance-main-value sora">${COMISIONES.dia.toLocaleString()}</div>
                  </div>
                  <div className="finance-grid">
                    <div className="finance-cell">
                      <div className="finance-cell-label">Semana</div>
                      <div className="finance-cell-value sora">${COMISIONES.semana.toLocaleString()}</div>
                    </div>
                    <div className="finance-cell">
                      <div className="finance-cell-label">Mes</div>
                      <div className="finance-cell-value sora">${COMISIONES.mes.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CENTER: TIMELINE */}
              <div className="timeline-panel panel">
                <div className="timeline-header">
                  <h2 className="timeline-title sora">Consultas del día</h2>
                  <span className="count-badge">{citasDelDia.length} pacientes</span>
                </div>

                <div className="timeline-body scroll">
                  {citasDelDia.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon"><CalIcon size={22} strokeWidth={1.5}/></div>
                      <span className="empty-title">Agenda despejada</span>
                      <button className="empty-action" onClick={() => setShowCitaModal(true)}>
                        + Agendar paciente
                      </button>
                    </div>
                  ) : citasDelDia.map((cita) => {
                    const isDone      = cita.estado === 'completada';
                    const isWaiting   = cita.estado === 'en_espera';
                    const isSiguiente = cita.id === siguienteCitaId; 
                    const hora        = cita.fechaHora.split('T')[1]?.substring(0,5);
                    const ampm        = parseInt(hora) < 12 ? 'AM' : 'PM';

                    return (
                      <div key={cita.id} className={`cita-row ${isDone ? 'completed' : ''}`}>
                        <div className="cita-time">
                          <span className="cita-time-main sora">{hora}</span>
                          <span className="cita-time-ampm">{ampm}</span>
                        </div>

                        <div className="cita-node-col">
                          <div className={`cita-node ${isDone ? 'node-done' : isWaiting ? 'node-waiting' : 'node-pending'}`}></div>
                        </div>

                        <div className={`cita-card ${isWaiting ? 'waiting' : isDone ? 'done' : ''} ${isSiguiente ? 'siguiente' : ''}`}>
                          
                          {/* Gafete flotante de "Turno Actual" */}
                          {isSiguiente && (
                             <div className="badge-siguiente">
                                <Stethoscope size={12}/> Turno Actual
                             </div>
                          )}

                          <div>
                            <div className={`cita-name ${isDone ? 'done-name' : ''}`}>{cita.paciente}</div>
                            <div className="cita-tags">
                              <span className="tag tag-motivo">{cita.motivo}</span>
                              {isWaiting && <span className="tag tag-waiting"><ShieldCheck size={10}/> En sala</span>}
                              {cita.estado === 'pendiente' && !isDone && <span className="tag tag-pending">Por llegar</span>}
                              {isDone && <span className="tag tag-done"><Check size={10}/> Terminado</span>}
                              {cita.esTeleconsulta && <span className="tag tag-tele"><Video size={10}/> Teleconsulta</span>}
                            </div>
                          </div>

                          <div className="cita-actions">
                            {cita.pacienteTelefono && !isDone && (
                              <button className="act-btn green" onClick={() => enviarWhatsApp(cita.pacienteTelefono, "Confirmar cita")} title="WhatsApp">
                                <MessageCircle size={15}/>
                              </button>
                            )}
                            {!isDone && cita.estado !== 'pendiente' && (
                              <button className="act-btn green" onClick={() => cambiarEstado(cita.id, 'completada')} title="Marcar finalizada">
                                <ShieldCheck size={15}/>
                              </button>
                            )}
                            {cita.estado === 'pendiente' && (
                              <button className="act-pill act-pill-rose" onClick={() => setCitaUrgencia(cita)}>
                                <AlertTriangle size={12}/> Urgencia
                              </button>
                            )}
                            {!isDone && cita.estado !== 'pendiente' && (
                              <button className="act-pill act-pill-blue" onClick={() => setSelectedCita(cita)}>
                                Expediente
                              </button>
                            )}
                            {cita.estado === 'pendiente' && !isDone && (
                              <button className="act-pill" style={{background:'white',color:'var(--blue-700)',border:'1px solid var(--blue-200)'}} onClick={() => setSelectedCita(cita)}>
                                Ver
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT SIDEBAR: INVENTORY */}
              <div className="sidebar-right">
                <div className="panel inv-panel">
                  <div className="inv-header">
                    <div className="inv-title"><Syringe size={14}/> Alertas de Inventario</div>
                    <div className="inv-sub">Medicamentos próximos a caducar</div>
                  </div>
                  <div className="inv-list scroll">
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
              </div>
            </>
          )}

          {/* ── VISTA SEMANAL ────────────────────────────────────── */}
          {vista === 'semanal' && (
            <div className="weekly-panel">
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
                            setNuevaCita({ ...nuevaCita, fecha: day.toLocaleDateString('en-CA'), hora: `${hour}:00` });
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
          )}
        </div>

        {/* ══ DETAIL DRAWER ════════════════════════════════════════ */}
        <div className={`detail-overlay ${selectedCita ? 'open' : ''}`}>
          <div className="detail-backdrop" onClick={() => setSelectedCita(null)}/>
          <div className="detail-drawer">
            {selectedCita && (
              <>
                <div className="drawer-hdr">
                  <button className="drawer-close" onClick={() => setSelectedCita(null)}><XCircle size={18}/></button>
                  <div className="drawer-meta">
                    <Clock size={13} style={{ color:'var(--blue-500)' }}/>
                    {selectedCita.fechaHora?.split('T')[1]?.substring(0,5)} • {selectedCita.motivo}
                  </div>
                  <div className="drawer-name">{selectedCita.paciente}</div>
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
                  {selectedCita.estado === 'pendiente' ? (
                    <div className="locked-state">
                      <div className="locked-icon"><Lock size={24} strokeWidth={1.5}/></div>
                      <div className="locked-title">Expediente bloqueado</div>
                      <div className="locked-desc">Esperando captura de signos vitales en Triage.</div>
                    </div>
                  ) : (
                    <div className="action-grid">
                      <button className="action-card ac-neutral"
                        onClick={() => navigate('/doctor/expediente', { state: { pacienteId: selectedCita.pacienteId, citaId: selectedCita.id } })}>
                        <div className="action-card-icon"><ClipboardList size={22}/></div>
                        Expediente completo
                      </button>
                      <button className="action-card ac-blue"
                        onClick={() => navigate('/doctor/consulta', { state: { pacienteId: selectedCita.pacienteId, citaId: selectedCita.id } })}>
                        <div className="action-card-icon"><HeartPulse size={22}/></div>
                        Consulta rápida
                      </button>
                    </div>
                  )}
                </div>

                <div className="drawer-footer">
                  {selectedCita.estado !== 'completada' && selectedCita.estado !== 'pendiente' && (
                    <button className="btn-finish" onClick={() => { cambiarEstado(selectedCita.id,'completada'); setSelectedCita(null); }}>
                      Finalizar consulta
                    </button>
                  )}
                  {selectedCita.estado === 'pendiente' && (
                    <button className="btn-cancel-cita" onClick={() => cambiarEstado(selectedCita.id,'cancelada')}>
                      Cancelar cita
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

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
                  navigate('/doctor/expediente', { state: { pacienteId: citaUrgencia.pacienteId, citaId: citaUrgencia.id, motivo: "URGENCIA: " + citaUrgencia.motivo } });
                  setCitaUrgencia(null);
                }}>
                  <Stethoscope size={15}/> Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL NUEVA CITA ══════════════════════════════════════ */}
        {showCitaModal && (
          <div className="modal-overlay">
            <div className="modal-box">
              <div className="modal-hdr">
                <span className="modal-title">Nueva Cita</span>
                <button className="modal-close" onClick={() => setShowCitaModal(false)}><XCircle size={22}/></button>
              </div>
              <form onSubmit={handleGuardarCita} className="modal-body">

                {/* Paciente */}
                <div className="form-group">
                  <label className="form-label">Paciente</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <div style={{ flex:1, position:'relative' }}>
                      <div className="form-input-icon">
                        <Search size={15}/>
                        <input required type="text" placeholder="Buscar paciente..."
                          className="form-input"
                          value={nuevaCita.paciente}
                          onChange={e => {
                            setNuevaCita({ ...nuevaCita, paciente: e.target.value });
                            const txt = e.target.value.toLowerCase();
                            if (txt.length > 1) {
                              setSugerencias(todosLosPacientes.filter(p => p.nombre.toLowerCase().includes(txt)));
                              setMostrarSugerencias(true);
                            } else setMostrarSugerencias(false);
                          }}
                        />
                      </div>
                      {mostrarSugerencias && (
                        <div className="suggest-list scroll">
                          {sugerencias.map(p => (
                            <div key={p.id} className="suggest-item" onClick={() => seleccionarPaciente(p)}>
                              {p.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setShowPacienteModal(true)}
                      style={{ width:44, height:44, borderRadius:8, background:'var(--blue-600)', color:'white', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, boxShadow:'0 2px 8px rgba(0,119,182,.2)' }}>
                      <Plus size={18}/>
                    </button>
                  </div>
                </div>

                {/* Fecha / Hora */}
                <div className="form-group">
                  <div className="form-grid">
                    <div>
                      <label className="form-label">Fecha</label>
                      <input required type="date" className="form-input"
                        value={nuevaCita.fecha}
                        onChange={e => setNuevaCita({ ...nuevaCita, fecha: e.target.value })}/>
                    </div>
                    <div>
                      <label className="form-label">Hora</label>
                      <input required type="time" className="form-input"
                        value={nuevaCita.hora}
                        onChange={e => setNuevaCita({ ...nuevaCita, hora: e.target.value })}/>
                    </div>
                  </div>
                </div>

                {/* Motivo */}
                <div className="form-group">
                  <label className="form-label">Motivo de consulta</label>
                  <select className="form-input" style={{ cursor:'pointer' }}
                    value={nuevaCita.motivo}
                    onChange={e => setNuevaCita({ ...nuevaCita, motivo: e.target.value })}>
                    {MOTIVOS_CONSULTA.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Teleconsulta */}
                <div className="form-group">
                  <label className="tele-toggle">
                    <input type="checkbox"
                      checked={nuevaCita.esTeleconsulta}
                      onChange={e => setNuevaCita({ ...nuevaCita, esTeleconsulta: e.target.checked })}/>
                    <span><Video size={15} style={{ color:'var(--blue-600)' }}/> Teleconsulta vía Google Meet</span>
                  </label>
                </div>

                <button type="submit" className="btn-submit">Confirmar cita</button>
              </form>
            </div>
          </div>
        )}

        {showPacienteModal && (
          <ModalPaciente onClose={() => setShowPacienteModal(false)} onPacienteCreado={handlePacienteCreado}/>
        )}
        <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)}/>
      </div>
    </>
  );
};

export default Agenda;