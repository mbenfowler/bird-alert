import { useSearchParams } from 'react-router'

/**
 * Current page from the `?page=` search param, clamped to [1, pageCount]. Keeping it in the URL
 * means a reload or back button lands on the same page, and a new region (which navigates to `/`)
 * starts over at page one without any effect.
 */
export const usePageParam = (pageCount: number) => {
  const [params, setParams] = useSearchParams()
  const requested = Number.parseInt(params.get('page') ?? '1', 10)
  const page = Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), Math.max(1, pageCount))
  const setPage = (next: number) => setParams(next <= 1 ? {} : { page: String(next) })
  return [page, setPage] as const
}
