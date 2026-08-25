'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, ListTodo, Trash2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Badge } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input, Label, Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDate } from '@/lib/utils'
import type { Client, Member, Task, TaskChecklistItem, TaskComment, TaskStatus } from '@/lib/types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
}
const STATUS_TONE: Record<TaskStatus, 'default' | 'brand' | 'success'> = {
  pendente: 'default',
  em_andamento: 'brand',
  concluida: 'success',
}

type MemberWithEmail = Member & { email?: string }

export default function TarefasPage() {
  const { permissions } = usePermissions()
  const canManage = permissions?.manageContent ?? false

  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [members, setMembers] = useState<MemberWithEmail[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const [tasksRes, clientsRes, equipeRes] = await Promise.all([
      fetch(`/api/tarefas?${params.toString()}`),
      fetch('/api/clientes'),
      fetch('/api/equipe'),
    ])
    if (tasksRes.ok) setTasks((await tasksRes.json()).tasks)
    if (clientsRes.ok) setClients((await clientsRes.json()).clients)
    if (equipeRes.ok) setMembers((await equipeRes.json()).members)
  }, [statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial via API + refiltro
    load()
  }, [load])

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]))
  const membersByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]))

  async function deleteTask(taskId: string) {
    if (!confirm('Excluir esta tarefa?')) return
    const res = await fetch(`/api/tarefas/${taskId}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-sm text-muted">Prazos, responsáveis e checklist do time.</p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            Nova tarefa
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {['', 'pendente', 'em_andamento', 'concluida'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              statusFilter === s ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
            }`}
          >
            {s ? STATUS_LABELS[s as TaskStatus] : 'Todas'}
          </button>
        ))}
      </div>

      {tasks === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ListTodo className="size-8" />} title="Nenhuma tarefa ainda" description="Crie uma tarefa pra organizar o trabalho do time." />
      ) : (
        <Card className="divide-y divide-border">
          {tasks.map((task) => {
            const done = task.checklist.filter((c) => c.done).length
            return (
              <div key={task.id} className="flex items-center justify-between gap-3 p-4">
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(task)}>
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted">
                    {task.client_id && clientsById[task.client_id] ? `${clientsById[task.client_id].name} · ` : ''}
                    {task.assigned_to && membersByUserId[task.assigned_to]
                      ? membersByUserId[task.assigned_to].display_name || membersByUserId[task.assigned_to].email
                      : 'Sem responsável'}
                    {task.due_date && ` · ${formatDate(task.due_date)}`}
                    {task.checklist.length > 0 && ` · ${done}/${task.checklist.length}`}
                  </p>
                </button>
                <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABELS[task.status]}</Badge>
                {canManage && (
                  <button onClick={() => deleteTask(task.id)} className="text-muted hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            )
          })}
        </Card>
      )}

      <TaskModal
        task={editing}
        clients={clients}
        members={members}
        canManage={canManage}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </div>
  )
}

function TaskModal({
  task,
  clients,
  members,
  canManage,
  onClose,
  onSaved,
}: {
  task: Task | 'new' | null
  clients: Client[]
  members: MemberWithEmail[]
  canManage: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = task === 'new'
  const existing = task && task !== 'new' ? task : null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<TaskStatus>('pendente')
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!task) return
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta o form ao trocar de tarefa
      setTitle(existing.title)
      setDescription(existing.description ?? '')
      setClientId(existing.client_id ?? '')
      setAssignedTo(existing.assigned_to ?? '')
      setDueDate(existing.due_date ?? '')
      setStatus(existing.status)
      setChecklist(existing.checklist)
      fetch(`/api/tarefas/${existing.id}/comentarios`)
        .then((r) => (r.ok ? r.json() : { comments: [] }))
        .then((d) => setComments(d.comments))
    } else {
      setTitle('')
      setDescription('')
      setClientId('')
      setAssignedTo('')
      setDueDate('')
      setStatus('pendente')
      setChecklist([])
      setComments([])
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task])

  if (!task) return null

  function addChecklistItem() {
    if (!newItem.trim()) return
    setChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }])
    setNewItem('')
  }

  function toggleItem(id: string) {
    setChecklist(checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)))
  }

  function removeItem(id: string) {
    setChecklist(checklist.filter((c) => c.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      title,
      description: description || undefined,
      client_id: clientId || null,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      status,
      checklist,
    }
    const res = await fetch(isNew ? '/api/tarefas' : `/api/tarefas/${existing!.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Não foi possível salvar.')
      return
    }
    onSaved()
    onClose()
  }

  async function handleComment() {
    if (!existing || !newComment.trim()) return
    const res = await fetch(`/api/tarefas/${existing.id}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment }),
    })
    if (res.ok) {
      const data = await res.json()
      setComments([...comments, data.comment])
      setNewComment('')
    }
  }

  return (
    <Modal open={!!task} onClose={onClose} title={isNew ? 'Nova tarefa' : 'Editar tarefa'} className="max-w-xl">
      <div className="space-y-4">
        <div>
          <Label htmlFor="task-title">Título</Label>
          <Input id="task-title" autoFocus disabled={!canManage} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="task-desc">Descrição</Label>
          <Textarea id="task-desc" rows={2} disabled={!canManage} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="task-client">Cliente</Label>
            <select
              id="task-client"
              value={clientId}
              disabled={!canManage}
              onChange={(e) => setClientId(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="task-assignee">Responsável</Label>
            <select
              id="task-assignee"
              value={assignedTo}
              disabled={!canManage}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
            >
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="task-due">Prazo</Label>
            <Input id="task-due" type="date" disabled={!canManage} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  status === s ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}

        <div>
          <Label>Checklist</Label>
          <div className="space-y-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.done} onChange={() => toggleItem(item.id)} className="size-4 accent-brand" />
                <span className={item.done ? 'flex-1 text-muted line-through' : 'flex-1'}>{item.text}</span>
                {canManage && (
                  <button onClick={() => removeItem(item.id)} className="text-muted hover:text-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canManage && (
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Novo item…"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
              />
              <Button type="button" size="sm" variant="secondary" onClick={addChecklistItem}>
                <Plus className="size-4" />
              </Button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {canManage && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button loading={saving} disabled={!title.trim()} onClick={handleSave}>
              Salvar
            </Button>
          </div>
        )}

        {existing && (
          <div className="border-t border-border pt-4">
            <Label>Comentários</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-surface p-2 text-sm">
                  {c.body}
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-muted">Nenhum comentário ainda.</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Escrever comentário…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              />
              <Button type="button" size="sm" variant="secondary" onClick={handleComment}>
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
