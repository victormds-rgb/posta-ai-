'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import type { Notification } from '@/lib/types'

const POLL_INTERVAL_MS = 30_000

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/notificacoes')
    if (res.ok) {
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    await fetch(`/api/notificacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    await fetch('/api/notificacoes/mark-all-read', { method: 'POST' })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-muted hover:bg-brand-soft hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notificações</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-brand hover:underline">
                <Check className="size-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação ainda.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={cn(
                    'block w-full border-b border-border px-4 py-3 text-left text-sm last:border-0 hover:bg-brand-soft/40',
                    !n.read && 'bg-brand-soft/20',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('font-medium', !n.read && 'text-brand')}>{n.title}</p>
                    {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-muted line-clamp-2">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted">{formatDateTime(n.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
