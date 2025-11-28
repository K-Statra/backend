export function Field({ label, children, hint, error }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </label>
  )
}

export function TextInput({ className = '', error, ...props }) {
  const cls = ['input']
  if (className) cls.push(className)
  if (error) cls.push('error')
  return <input className={cls.join(' ')} {...props} />
}

export function TextArea({ className = '', error, ...props }) {
  const cls = ['textarea']
  if (className) cls.push(className)
  if (error) cls.push('error')
  return <textarea className={cls.join(' ')} {...props} />
}
