'use client'

import { useState } from 'react'

export default function EndpointNameEditor({
  id,
  initialName,
  block = false,
  className = '',
}: {
  id: string
  initialName: string | null
  /** If true, the input stretches to full width (for use in list rows) */
  block?: boolean
  className?: string
}) {
  const [name, setName] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialName ?? '')

  function startEdit() {
    setValue(name ?? '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function commitEdit() {
    const trimmed = value.trim()
    setEditing(false)
    if ((trimmed || null) === name) return
    const res = await fetch(`/api/endpoints/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (res.ok) {
      const updated = await res.json()
      setName(updated.name)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') cancelEdit()
        }}
        onBlur={commitEdit}
        placeholder="endpoint label"
        className={`bg-gray-950 border border-green-700 rounded px-2 py-0.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none ${block ? 'w-full' : 'min-w-[180px]'}`}
      />
    )
  }

  return (
    <span className={`group/rename inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <span className="truncate">
        {name ?? <span className="text-gray-500 italic font-normal">unnamed</span>}
      </span>
      <button
        onClick={startEdit}
        title="Rename"
        className="shrink-0 opacity-0 group-hover/rename:opacity-100 text-gray-500 hover:text-gray-200 transition-opacity"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </span>
  )
}
