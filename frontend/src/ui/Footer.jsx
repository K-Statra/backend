import React from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function Footer() {
  const { lang } = useI18n();

  const links = lang === 'ko' ? [
    { label: '이용약관', highlight: false },
    { label: '개인정보 처리방침', highlight: true },
    { label: '제휴 신청', highlight: false },
  ] : [
    { label: 'Terms of Use', highlight: false },
    { label: 'Privacy Policy', highlight: true },
    { label: 'Partnership', highlight: false },
  ];

  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: '#fafbfc',
      padding: '40px 20px',
      marginTop: 'auto',
      textAlign: 'center',
      color: 'var(--fg-secondary)',
      fontSize: '13px',
      width: '100%',
      fontFamily: "'NanumSquare', -apple-system, sans-serif"
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        fontWeight: 500
      }}>
        {links.map((link, i) => (
          <React.Fragment key={link.label}>
            <a 
              href="#" 
              onClick={(e) => e.preventDefault()}
              style={{ 
                color: link.highlight ? 'var(--fg)' : 'var(--fg-secondary)', 
                textDecoration: 'none', 
                fontWeight: link.highlight ? 700 : 500 
              }}
            >
              {link.label}
            </a>
            {i < links.length - 1 && (
              <span style={{ color: '#d1d5db' }}>|</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--fg)' }}>
        <strong style={{ fontSize: '15px', marginRight: '8px', fontWeight: 900, fontFamily: 'Arial, sans-serif' }}>Gran Oso</strong>
        <span style={{ color: 'var(--fg-secondary)' }}>Copyright © Gran Oso All Rights Reserved.</span>
      </div>
    </footer>
  );
}
