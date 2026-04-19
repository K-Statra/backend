import { useEffect, useState } from 'react'
import { api } from './api.js'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Overview from './pages/Overview.jsx'
import PartnerSearch from './pages/PartnerSearch.jsx'
import Partners from './pages/Partners.jsx'
import CompanyList from './pages/CompanyList.jsx'
import BuyerForm from './pages/BuyerForm.jsx'
import CompanyInputForm from './pages/CompanyInputForm.jsx'
import Matches from './pages/Matches.jsx'
import PaymentsPage from './pages/PaymentsPage.jsx'
import SchedulePage from './pages/SchedulePage.jsx'
import PaymentCheckout from './pages/PaymentCheckout2.jsx'
import PaymentStatus from './pages/PaymentStatus.jsx'
import AdminPayments from './pages/AdminPayments.jsx'
import AdminMatches from './pages/AdminMatches.jsx'
import AdminStats from './pages/AdminStats.jsx'
import ContactPage from './pages/ContactPage.jsx'
import About from './pages/About.jsx'
import LanguageSwitcher from './ui/LanguageSwitcher.jsx'
import FeedbackButton from './ui/FeedbackButton.jsx'
import Button from './ui/Button.jsx'
import Modal from './ui/Modal.jsx'
import Footer from './ui/Footer.jsx'
import { useI18n } from './i18n/I18nProvider.jsx'
import { track } from './utils/analytics.js'

const navItems = [
  { to: '/overview', key: 'nav_overview' },
  { to: '/partners', key: 'nav_my_partners' },
  { to: '/schedule', key: 'nav_schedule' },
  { to: '/payments', key: 'nav_payments' },
  { to: '/about', key: 'nav_about' },
]

const notificationCount = 3

function NotFound() {
  const location = useLocation()
  return (
    <div>
      <h2>404</h2>
      <p>Page not found: {location.pathname}</p>
    </div>
  )
}

export default function App() {
  console.log('K-Statra v1.0.2 - Production Build (Env Check)');
  const { t, lang } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [loginOpen, setLoginOpen] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '', remember: true })
  const [ipSecure, setIpSecure] = useState(false)
  const [loginStatus, setLoginStatus] = useState({ submitting: false, success: false, error: '' })
  const [notifOpen, setNotifOpen] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)

  useEffect(() => {
    track('page_view', { path: location.pathname })
  }, [location])

  const loginTabs =
    lang === 'ko'
      ? [
        { id: 'id', label: 'ID/전화번호' },
        { id: 'one-time', label: '일회용 번호' },
        { id: 'qr', label: 'QR코드' },
      ]
      : [
        { id: 'id', label: 'ID / Phone' },
        { id: 'one-time', label: 'One-time number' },
        { id: 'qr', label: 'QR code' },
      ]
  const loginLabel = lang === 'ko' ? '로그인' : 'Log In'
  const signupLabel = lang === 'ko' ? '회원가입' : 'Sign Up'
  const personalSignupLabel = lang === 'ko' ? '개인 회원가입' : 'Personal Sign-up'
  const companySignupLabel = lang === 'ko' ? '기업 회원가입' : 'Company Sign-up'
  const signupDescription = lang === 'ko' ? '가입 유형을 선택해 주세요.' : 'Choose the option that fits you best.'
  const usernameLabel = lang === 'ko' ? '아이디 또는 전화번호' : 'ID or phone number'
  const passwordLabel = lang === 'ko' ? '비밀번호' : 'Password'
  const rememberLabel = lang === 'ko' ? '로그인 상태 유지' : 'Stay signed in'
  const ipLabel = lang === 'ko' ? 'IP보안' : 'IP security'
  const loginErrorMessage = lang === 'ko' ? '아이디와 비밀번호를 모두 입력해 주세요.' : 'Enter both ID and password.'
  const loginSuccessMessage = lang === 'ko' ? '임시 로그인 성공! (데모 화면)' : 'Temporary login success! (demo)'
  const notifications =
    lang === 'ko'
      ? [
        { id: 1, title: '새 매칭 제안', body: '3개의 신규 제안이 도착했습니다.' },
        { id: 2, title: '결제 알림', body: '어제 생성한 결제 건을 확인하세요.' },
      ]
      : [
        { id: 1, title: 'New matches', body: 'You have 3 fresh recommendations.' },
        { id: 2, title: 'Payment reminder', body: "Review yesterday's invoice." },
      ]

  const openLoginModal = () => {
    setLoginStatus({ submitting: false, success: false, error: '' })
    setIpSecure(false)
    setNotifOpen(false)
    setLoginOpen(true)
    track('login_modal_open')
  }

  const openSignupModal = () => {
    setSignupOpen(true)
    setNotifOpen(false)
    track('signup_modal_open')
  }

  const handlePersonalSignup = () => {
    setSignupOpen(false)
    track('signup_choice', { type: 'personal' })
    navigate('/buyers/new')
  }

  const handleCompanySignup = () => {
    setSignupOpen(false)
    track('signup_choice', { type: 'company' })
    navigate('/companies/new')
  }

  const handleLoginSubmit = async (event) => {
    event.preventDefault()
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setLoginStatus({ submitting: false, success: false, error: loginErrorMessage })
      return
    }
    setLoginStatus({ submitting: true, success: false, error: '' })
    track('login_modal_submit')

    try {
      // Demo: fetch the first buyer to simulate login
      const res = await api.listBuyers({ limit: 1 })
      const buyer = res.data?.[0]

      if (buyer) {
        localStorage.setItem('kstatra_buyer_id', buyer._id)
        localStorage.setItem('kstatra_buyer_name', buyer.name)
        setLoginStatus({ submitting: false, success: true, error: '' })
        setTimeout(() => {
          setLoginOpen(false)
          // Optional: reload or notify other components
        }, 1000)
      } else {
        // Fallback if no buyers exist
        setLoginStatus({ submitting: false, success: true, error: 'Demo login (no buyers found)' })
      }
    } catch (err) {
      console.error('Login failed', err)
      // Fallback to allow demo to continue even if API fails
      setLoginStatus({ submitting: false, success: true, error: '' })
    }
  }

  return (
    <div>
      <a className="skip-link" href="#main-content">
        {t('skip_to_content')}
      </a>
      <header className="header">
        <div className="inner">
          <div className="header-top">
            <div className="brand">
              <span className="logo-box" aria-hidden="true">
                K
              </span>
              <Link to="/" className="brand-link">
                K-Statra
              </Link>
            </div>
            <nav className="nav" aria-label="Primary">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                  onClick={() => track('nav_click', { target: item.to })}
                >
                  {t(item.key)}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="controls-row">
            <div className="control-group" aria-label="Language selector">
              <span className="control-icon" aria-hidden="true">
                🌐
              </span>
              <LanguageSwitcher />
            </div>
            <div className="notif-wrapper" style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                type="button"
                aria-label="Notifications"
                onClick={() => setNotifOpen((prev) => !prev)}
                style={{ borderRadius: '12px', border: '1px solid #eceff3' }}
              >
                <span className="bell-icon" aria-hidden="true">
                  🔔
                </span>
                <span className="notif-badge" aria-hidden={notificationCount === 0}>
                  {notificationCount}
                </span>
              </button>
              {notifOpen && (
                <div
                  className="notif-dropdown"
                  style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: 220,
                    padding: '0.75rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                    background: '#fff',
                    zIndex: 60,
                  }}
                >
                  {notifications.map((item) => (
                    <div key={item.id} style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ display: 'block', marginBottom: '0.15rem' }}>{item.title}</strong>
                      <span className="muted small">{item.body}</span>
                    </div>
                  ))}
                  <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => setNotifOpen(false)}>
                    {lang === 'ko' ? '닫기' : 'Close'}
                  </button>
                </div>
              )}
            </div>
            <button
              className="avatar-btn"
              type="button"
              aria-label={signupLabel}
              onClick={openSignupModal}
              style={{
                borderRadius: '999px',
                padding: '0.25rem 0.75rem',
                minWidth: lang === 'ko' ? 70 : 80,
                fontSize: '0.85rem',
                textTransform: 'none',
                fontWeight: 600,
                background: '#fff',
                color: '#111',
                border: '1px solid #d5dae0',
              }}
            >
              <span style={{ display: 'inline-block', minWidth: lang === 'ko' ? '4em' : '4.5em', textAlign: 'center' }}>
                {signupLabel}
              </span>
            </button>
            <button
              className="avatar-btn"
              type="button"
              aria-label={loginLabel}
              onClick={openLoginModal}
              style={{
                borderRadius: '999px',
                padding: '0.35rem 1.2rem',
                minWidth: lang === 'ko' ? 96 : 105,
                textTransform: 'none',
                fontWeight: 600,
                background: '#0066CC',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0, 102, 204, 0.2)'
              }}
            >
              <span style={{ display: 'inline-block', minWidth: lang === 'ko' ? '3.5em' : '4em', textAlign: 'center' }}>{loginLabel}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="container">
        <Routes>
          <Route path="/" element={<PartnerSearch />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/dashboard" element={<Overview />} /> {/* Redirect or alias */}
          <Route path="/analytics" element={<Overview />} /> {/* Redirect or alias */}
          <Route path="/partners" element={<Partners />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/companies" element={<CompanyList />} />
          <Route path="/companies/new" element={<CompanyInputForm />} />
          <Route path="/buyers/new" element={<BuyerForm />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/detail" element={<ContactPage />} />
          <Route path="/payments/checkout/:id" element={<PaymentCheckout />} />
          <Route path="/payments/:id" element={<PaymentStatus />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/matches" element={<AdminMatches />} />
          <Route path="/admin/stats" element={<AdminStats />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />

      <Modal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false)
          setIpSecure(false)
          setLoginStatus({ submitting: false, success: false, error: '' })
        }}
        title={loginLabel}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setLoginOpen(false)
              setIpSecure(false)
              setLoginStatus({ submitting: false, success: false, error: '' })
            }}
          >
            Close
          </Button>
        }
      >
        <div className="login-modal" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
          <div className="login-logo" style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center' }}>{loginLabel}</div>
          <div className="login-tabs" role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', background: '#f3f4f6', borderRadius: '8px' }}>
            {loginTabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                className={`login-tab ${index === 0 ? 'active' : ''}`}
                aria-selected={index === 0}
                style={{
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: index === 0 ? '1px solid #03c75a' : '1px solid transparent',
                  background: index === 0 ? '#fff' : 'transparent',
                  fontWeight: index === 0 ? 600 : 500,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form className="login-form" onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="filter-group">
              <span>{usernameLabel}</span>
              <input value={loginForm.username} placeholder="" autoComplete="username" onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))} />
            </label>
            <label className="filter-group">
              <span>{passwordLabel}</span>
              <input type="password" value={loginForm.password} placeholder="" autoComplete="current-password" onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))} />
            </label>

            <div className="login-options row space" style={{ fontSize: '0.9rem', alignItems: 'center' }}>
              <label className="checkbox">
                <input type="checkbox" checked={loginForm.remember} onChange={(event) => setLoginForm((prev) => ({ ...prev, remember: event.target.checked }))} />
                <span>{rememberLabel}</span>
              </label>
              <div className="ip-sec">
                <span>{ipLabel}</span>
                <button
                  type="button"
                  className={`ip-toggle ${ipSecure ? 'on' : 'off'}`}
                  style={{ marginLeft: '0.5rem', borderRadius: '999px', padding: '0.15rem 0.75rem', border: '1px solid #d1d5db', background: ipSecure ? '#03c75a' : '#f9fafb', color: ipSecure ? '#fff' : '#374151' }}
                  onClick={() => setIpSecure((prev) => !prev)}
                >
                  {ipSecure ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {loginStatus.error && (
              <div className="error" role="alert">
                {loginStatus.error}
              </div>
            )}
            {loginStatus.success && <p className="success small">{loginSuccessMessage}</p>}
            <Button type="submit" loading={loginStatus.submitting} style={{ width: '100%' }}>
              {loginLabel}
            </Button>
          </form>
        </div>
      </Modal>
      <Modal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        title={signupLabel}
        footer={
          <Button variant="secondary" onClick={() => setSignupOpen(false)}>
            Close
          </Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p className="muted">{signupDescription}</p>
          <div className="signup-options" style={{ display: 'grid', gap: '0.75rem' }}>
            <div
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                background: '#fafafa',
              }}
            >
              <h4 style={{ marginBottom: '0.25rem' }}>{personalSignupLabel}</h4>
              <p className="muted small" style={{ marginBottom: '0.75rem' }}>
                {lang === 'ko'
                  ? '매칭 피드를 받아보고 싶다면 개인 회원으로 가입해 주세요.'
                  : 'Sign up as an individual to get curated partner recommendations.'}
              </p>
              <Button style={{ width: '100%' }} onClick={handlePersonalSignup}>
                {personalSignupLabel}
              </Button>
            </div>
            <div
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
              }}
            >
              <h4 style={{ marginBottom: '0.25rem' }}>{companySignupLabel}</h4>
              <p className="muted small" style={{ marginBottom: '0.75rem' }}>
                {lang === 'ko'
                  ? '회사 정보를 등록하면 AI 추천 카드에 노출됩니다.'
                  : 'Add your company details to appear in AI recommendations.'}
              </p>
              <Button style={{ width: '100%' }} onClick={handleCompanySignup}>
                {companySignupLabel}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
