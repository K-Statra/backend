import { useEffect, useState } from 'react'

export function useCountdown(expiresAt) {
  const [left, setLeft] = useState(calc(expiresAt))

  useEffect(() => {
    setLeft(calc(expiresAt))
    if (!expiresAt) return
    const id = setInterval(() => setLeft(calc(expiresAt)), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return left
}

function calc(expiresAt) {
  if (!expiresAt) return null
  const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  return s
}

