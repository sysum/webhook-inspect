const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400 bg-green-950 border-green-800',
  POST: 'text-blue-400 bg-blue-950 border-blue-800',
  PUT: 'text-yellow-400 bg-yellow-950 border-yellow-800',
  DELETE: 'text-red-400 bg-red-950 border-red-800',
  PATCH: 'text-purple-400 bg-purple-950 border-purple-800',
  HEAD: 'text-cyan-400 bg-cyan-950 border-cyan-800',
  OPTIONS: 'text-gray-400 bg-gray-800 border-gray-700',
}

export default function MethodBadge({ method }: { method: string }) {
  const classes =
    METHOD_COLORS[method.toUpperCase()] ?? 'text-gray-400 bg-gray-800 border-gray-700'
  return (
    <span
      className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wider uppercase ${classes}`}
    >
      {method}
    </span>
  )
}
