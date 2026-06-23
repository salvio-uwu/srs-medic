import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import ExpedienteElectronicoPDF from '../src/components/pdf/ExpedienteElectronicoPDF.jsx';

const run = async () => {
  const consulta = {
    id: 'c1', fechaFormato: '08 de junio de 2026', horaFormato: '14:00', tipoNota: 'Consulta general',
    medicoNombre: 'Dr. House',
    padecimiento: 'Dolor abdominal de 3 dias de evolucion, intermitente.',
    signos: { ta: '120/80', temp: '36.5', fc: '72', fr: '16', spo2: '98' },
    antropometria: { peso: '70', talla: '1.70', imc: '24.2' },
    colesterol: {},
    fisica: { habitus: 'Integro', abdomen: 'Blando, depresible, doloroso en epigastrio' },
    diagnostico: 'Gastritis aguda',
    cie10: [{ codigo: 'K29.7', descripcion: 'Gastritis no especificada' }],
    tratamiento: [{ nombre: 'Omeprazol', presentacion: 'Capsula 20mg', dosis: '1 cada 24h por 14 dias' }],
    indicaciones: 'Dieta blanda, evitar irritantes.',
    pronostico: 'Bueno para la vida y la funcion.',
    estudios: { paquetes: ['Quimica sanguinea'], seleccionados: ['Biometria hematica', { nombre: 'USG abdominal' }], notas: '' },
    procedimientos: { seleccionados: [{ nombre: 'Toma de signos' }], notas: '' },
    pxInfo: {}
  };
  const antecedentes = {
    hereditarios: { diabetes: { mama: true, papa: false }, hipertension: { abuelos: true }, otros: 'Ninguno' },
    no_patologicos: { alimentacion: 'Regular', bano: 'Diario', sedentarismo: 'Si' },
    patologicos: { actuales: 'Gastritis', quirurgicos: 'Apendicectomia', adicciones: { tabaquismo: true, detalle: '5 al dia' }, especificos: { reflujo: 'Si', otro: '' } },
    alergias: { lista: [{ sustancia: 'Penicilina' }], otros: '' }
  };
  // Limpia todo y conserva solo el grupo indicado en KEEP
  const keep = process.env.KEEP || 'all';
  if (keep !== 'all') {
    consulta.fisica = {}; consulta.cie10 = []; consulta.estudios = { paquetes: [], seleccionados: [], notas: '' };
    consulta.procedimientos = { seleccionados: [], notas: '' }; consulta.indicaciones = ''; consulta.pronostico = '';
    consulta.tratamiento = [];
    if (keep === 'fisica') consulta.fisica = { habitus: 'Integro', abdomen: 'Blando' };
    if (keep === 'cie') consulta.cie10 = [{ codigo: 'K29.7', descripcion: 'Gastritis' }];
    if (keep === 'trat') consulta.tratamiento = [{ nombre: 'Omeprazol', presentacion: 'Cap 20mg', dosis: '1 c/24h' }];
    if (keep === 'est') consulta.estudios = { paquetes: ['Quimica'], seleccionados: ['BH', { nombre: 'USG' }], notas: '' };
    if (keep === 'proc') consulta.procedimientos = { seleccionados: [{ nombre: 'Toma signos' }], notas: '' };
    if (keep === 'ind') consulta.indicaciones = 'Dieta blanda.';
    if (keep === 'pron') consulta.pronostico = 'Bueno.';
  }
  const doc = React.createElement(ExpedienteElectronicoPDF, {
    paciente: { nombre: 'PACIENTE PRUEBA SAVANT', sexo: 'Masculino', fechaNacimiento: '1990-01-01', curp: 'XAXX010101HNEXXXA4', grupoSanguineo: 'O+', telefonoMovil: '8112345678', email: 'a@b.com', calleNumero: 'Calle 1', colonia: 'Centro', cp: '64000', municipioEstado: 'Monterrey, NL' },
    antecedentes,
    consultas: Array.from({ length: 20 }, (_, i) => ({ ...consulta, id: 'c' + i })),
    generadoPor: 'Admin Test',
    folio: 'ABC123'
  });
  try {
    const buf = await renderToBuffer(doc);
    console.log('OK bytes:', buf.length);
  } catch (e) {
    console.error('FAIL:', e && e.stack ? e.stack : e);
  }
};

run();
