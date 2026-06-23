import React from 'react';

const PatientSkeletonRow = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px' }}>
    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#f3f4f6' }} />
    <div style={{ flex: 1 }}>
      <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: '50%', marginBottom: 6 }} />
      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, width: '30%' }} />
    </div>
    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: 50 }} />
    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: 80 }} />
    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: 100 }} />
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ height: 28, width: 80, background: '#f3f4f6', borderRadius: 6 }} />
      <div style={{ height: 28, width: 56, background: '#f3f4f6', borderRadius: 6 }} />
      <div style={{ height: 28, width: 64, background: '#f3f4f6', borderRadius: 6 }} />
    </div>
  </div>
);

export default PatientSkeletonRow;
