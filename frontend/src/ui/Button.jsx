export default function Button({ children, variant = 'primary', size = 'md', loading = false, disabled, ...props }) {
  const cls = ['btn']
  if (variant === 'secondary') cls.push('secondary')
  if (variant === 'ghost') cls.push('ghost')
  if (size === 'sm') cls.push('sm')
  if (loading) cls.push('loading')
  const isDisabled = disabled || loading
  return (
    <button className={cls.join(' ')} disabled={isDisabled} {...props}>
      {loading ? <span className="spinner" aria-hidden /> : children}
    </button>
  )
}
