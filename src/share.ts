import { toast } from 'react-toastify'
import { createShare, errorMessage } from './apiCalls'

/**
 * Makes a share link and hands it on: the phone's share sheet where there is one (Messages,
 * WhatsApp, Facebook…), otherwise the clipboard. Cancelling the sheet is not an error.
 */
export const shareThing = async (payload: Parameters<typeof createShare>[0], title: string) => {
  let url: string
  try { url = (await createShare(payload)).url } catch (error) { toast.error(errorMessage(error), { position: 'bottom-center' }); return }
  // A preview build shares links to itself, so they can be tried before going live.
  url = url.replace(/^https:\/\/[^/]+/, window.location.origin)
  if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, url }); return } catch (error) { if ((error as Error).name === 'AbortError') return }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied. Paste it anywhere.', { position: 'bottom-center' })
  } catch {
    toast.info(url, { position: 'bottom-center', autoClose: false })
  }
}
