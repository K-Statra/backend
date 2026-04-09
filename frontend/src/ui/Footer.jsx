import React from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function Footer() {
  const { lang } = useI18n();

  const links = lang === 'ko' ? [
    { label: '이용약관', highlight: false },
    { label: '저작권정책', highlight: false },
    { label: '개인정보처리방침', highlight: true },
    { label: '고정형 영상정보처리기기 운영·관리방침', highlight: false },
    { label: '정보공개', highlight: false },
    { label: '사이트맵', highlight: false },
    { label: '관련사이트', highlight: false },
  ] : [
    { label: 'Terms of Use', highlight: false },
    { label: 'Copyright', highlight: false },
    { label: 'Privacy Policy', highlight: true },
    { label: 'CCTV Policy', highlight: false },
    { label: 'Sitemap', highlight: false },
  ];

  return (
    <footer style={{
      background: 'var(--accent)',
      padding: '40px 20px',
      marginTop: 'auto',
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '14px',
      width: '100%',
      fontFamily: "'NanumSquare', -apple-system, sans-serif"
    }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontWeight: 600 }}>
          {links.map((link, i) => (
            <React.Fragment key={link.label}>
              <a 
                href="#" 
                onClick={(e) => e.preventDefault()}
                style={{ 
                  color: link.highlight ? '#1EE4FF' : '#FFFFFF', 
                  textDecoration: 'none', 
                }}
              >
                {link.label}
              </a>
              {i < links.length - 1 && (
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              )}
            </React.Fragment>
          ))}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <span>서울시 서초구 헌릉로 13</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span>사업자등록번호 : 120-82-00275</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span>대표자명 : 강경성</span>
            <span style={{ marginLeft: '12px', fontWeight: 700, color: '#fff' }}>TEL. 1600-7119</span>
          </div>
          <div>
            <span>COPYRIGHT(c)2026 K-Statra. ALL RIGHTS RESERVED 대한무역투자진흥공사</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
