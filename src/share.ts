import { toast } from 'react-toastify'
import { createShare, errorMessage, getInviteLink } from './apiCalls'
import { queryClient } from './queryClient'
import { t } from './i18n'

// A preview build shares links to itself, so they can be tried before going live.
const here = (url: string) => url.replace(/^https:\/\/[^/]+/, window.location.origin)

/**
 * Makes a share link and hands it on: the phone's share sheet where there is one (Messages,
 * WhatsApp, Facebook…), otherwise the clipboard. Cancelling the sheet is not an error.
 */
export const shareThing = async (payload: Parameters<typeof createShare>[0], title: string) => {
  let url: string
  try { url = (await createShare(payload)).url } catch (error) { toast.error(errorMessage(error), { position: 'bottom-center' }); return }
  await shareUrl(here(url), title)
}

/** Hands on a link that already exists (a shared page passing itself along): share sheet, else the clipboard. */
export const shareUrl = async (url: string, title: string, text?: string) => {
  if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share(text ? { title, text, url } : { title, url }); return } catch (error) { if ((error as Error).name === 'AbortError') return }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success(t('share.copied'), { position: 'bottom-center' })
  } catch {
    toast.info(url, { position: 'bottom-center', autoClose: false })
  }
}

/** This person's invite link, fetched once and kept for the visit (asked for early, so a tap shares at once). */
export const inviteLinkQuery = { queryKey: ['invite-link'] as const, queryFn: getInviteLink, staleTime: Infinity, retry: 1 }

/** Invites a birding friend: the share sheet with the invite link and a short message they can edit, else the link copied. */
export const shareInvite = async () => {
  let url: string
  try { url = (await queryClient.fetchQuery(inviteLinkQuery)).url } catch (error) { toast.error(errorMessage(error), { position: 'bottom-center' }); return }
  await shareUrl(here(url), t('invite.title'), t('invite.message'))
}
