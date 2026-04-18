import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n/I18nProvider';
import Button from '../ui/Button';

export default function SchedulePage() {
  const { t, lang } = useI18n();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Optionally fetch by buyerId if logged in, fetching all for admin demo
    api.listConsultations()
      .then(res => {
        setConsultations(Array.isArray(res) ? res : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Consultation API error:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="inner" style={{ padding: '2rem 1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>{lang === 'ko' ? '상담 스케줄러' : 'Consultation Schedule'}</h2>
      <p style={{ marginBottom: '2rem', color: '#6b7280' }}>
        {lang === 'ko' 
          ? '선호하는 수출/수입 파트너와의 비대면/대면 상담 일정을 조율하고 관리합니다.' 
          : 'Schedule and manage your online/offline meetings with potential partners.'}
      </p>

      {loading ? (
        <p>{lang === 'ko' ? '불러오는 중...' : 'Loading...'}</p>
      ) : consultations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px' }}>
          <p>{lang === 'ko' ? '예정된 상담 일정이 없습니다.' : 'No scheduled consultations.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {consultations.map(c => (
            <div key={c._id} style={{ padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{c.companyName}</h3>
                <span style={{ 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '999px', 
                  fontSize: '0.8rem', 
                  fontWeight: 600,
                  background: c.status === 'CONFIRMED' ? '#dcfce7' : c.status === 'COMPLETED' ? '#f3f4f6' : '#fef9c3',
                  color: c.status === 'CONFIRMED' ? '#166534' : c.status === 'COMPLETED' ? '#374151' : '#854d0e'
                }}>
                  {c.status}
                </span>
              </div>
              <p style={{ margin: '0 0 1rem 0', color: '#4b5563', fontSize: '0.95rem' }}>
                <strong>{lang === 'ko' ? '일시:' : 'Date:'}</strong> {new Date(c.date).toLocaleDateString()} {c.timeSlot}
                <br />
                <strong>{lang === 'ko' ? '유형:' : 'Type:'}</strong> {c.reqType}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {c.reqType === 'ONLINE' && c.meetingLink && (
                  <Button onClick={() => window.open(c.meetingLink, '_blank')}>
                    {lang === 'ko' ? '온라인 미팅 참여' : 'Join Meeting'}
                  </Button>
                )}
                {c.reqType === 'OFFLINE' && c.boothNumber && (
                  <Button variant="secondary" onClick={() => alert(`${lang === 'ko' ? '부스 번호' : 'Booth'}: ${c.boothNumber}`)}>
                    {lang === 'ko' ? '부스 위치 보기' : 'View Booth'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
