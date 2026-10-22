/** eBird's obsDt is 'YYYY-MM-DD HH:mm' in the region's local time; read it as such, not as UTC. */
export const formatObsDt = (obsDt: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(obsDt)
  if (!m) return obsDt
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 12), Number(m[5] ?? 0))
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return m[4] ? `${day}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : day
}
