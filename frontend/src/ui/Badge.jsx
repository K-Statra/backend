export default function Badge({ children, tone = 'muted', className = '' }) {
  const cls = ['badge']
  if (tone) cls.push(tone)
  if (className) cls.push(className)
  return <span className={cls.join(' ')}>{children}</span>
}

