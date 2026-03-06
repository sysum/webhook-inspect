'use client'

import { useState } from 'react'

export default function CopyButton({
  text,
  label = 'copy',
}: {
  text: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="text-xs text-gray-500 hover:text-green-400 transition-colors px-2 py-0.5 rounded border border-gray-700 hover:border-green-700"
    >
      {copied ? '✓ copied' : label}
    </button>
  )
}
