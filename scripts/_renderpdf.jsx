import React from 'react';
import { renderToFile } from '@react-pdf/renderer';
import ExpedienteElectronicoPDF from '../src/components/pdf/ExpedienteElectronicoPDF.jsx';

const run = async () => {
  const antecedentes = {
    hereditarios: {},
    no_patologicos: {},
    patologicos: {
      especificos: {
        calculo: 'NEGADOS', calculo_negado: true,
        reflujo: 'NEGADOS', reflujo_negado: true,
        glaucoma: 'NEGADOS', glaucoma_negado: true,
        dislipidemias: 'NEGADOS', dislipidemias_negado: true,
        incontinencia: 'NEGADOS', incontinencia_negado: true,
        otro: 'NEGADOS', otro_negado: true
      }
    },
    alergias: { lista: [{ sustancia: 'PENICILINA' }, { sustancia: 'IBUPROFENO' }] }
  };
  const doc = React.createElement(ExpedienteElectronicoPDF, {
    paciente: { nombre: 'PACIENTE', apellidoPaterno: 'PRUEBA', sexo: 'Masculino', fechaNacimiento: '1989-07-08' },
    antecedentes,
    consultas: [],
    generadoPor: 'Admin Test',
    folio: 'PACIENTE07081989'
  });
  await renderToFile(doc, 'scripts/_exp.pdf');
  console.log('OK');
};
run().catch((e) => { console.error('FAIL', e); process.exit(1); });
