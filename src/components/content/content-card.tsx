'use client'

import { Badge } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { ContentItem } from '@/lib/types'
import { CalendarClock, Image as ImageIcon } from 'lucide-react'

export function ContentCard({
  item,
  onClick,
  onDragStart,
  draggable = true,
}: {
  item: ContentItem
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  draggable?: boolean
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      {item.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.cover_url} alt="" className="mb-2 aspect-video w-full rounded-md object-cover" />
      ) : (
        <div className="mb-2 flex aspect-video w-full items-center justify-center rounded-md bg-brand-soft text-brand">
          <ImageIcon className="size-6" />
        </div>
      )}
      <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="brand" className="capitalize">
          {item.content_type}
        </Badge>
        {item.channels.slice(0, 3).map((c) => (
          <Badge key={c} className="capitalize">
            {c}
          </Badge>
        ))}
      </div>
      {item.scheduled_at && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted">
          <CalendarClock className="size-3.5" />
          {formatDate(item.scheduled_at, { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
