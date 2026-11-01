import { useId, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, sendFeedback } from '../../apiCalls'
import './Feedback.css'
import { t } from '../../i18n'

type Kind = 'idea' | 'bug' | 'other'
const KINDS: Kind[] = ['idea', 'bug', 'other']

/** Settings → Ideas & feedback: straight to the person who builds the app, who can reply by email. */
const Feedback = () => {
  const id = useId()
  const [kind, setKind] = useState<Kind>('idea')
  const [message, setMessage] = useState('')
  const send = useMutation({ mutationFn: sendFeedback, onSuccess: () => setMessage('') })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (message.trim().length < 3) return
    send.mutate({ kind, message: message.trim(), page: window.location.pathname })
  }

  return (
    <section className='feedback'>
      <h2 className='fredericka'>{t('feedback.title')}</h2>
      <form className='feedback__card' onSubmit={submit}>
        <p className='feedback__lede'>{t('feedback.lede')}</p>
        <div className='feedback__kinds' role='radiogroup' aria-label={t('feedback.kindLabel')}>
          {KINDS.map((value) => (
            <button key={value} type='button' role='radio' aria-checked={kind === value} className={`feedback__kind ${kind === value ? 'is-on' : ''}`} onClick={() => setKind(value)}>{t(`feedback.kind_${value}`)}</button>
          ))}
        </div>
        <label className='visually-hidden' htmlFor={id}>{t('feedback.message')}</label>
        <textarea id={id} className='feedback__text' rows={5} maxLength={4000} placeholder={t(`feedback.placeholder_${kind}`)} value={message}
          onChange={(e) => { setMessage(e.target.value); if (send.isSuccess || send.isError) send.reset() }} />
        <div className='feedback__foot'>
          {send.isSuccess && <p className='feedback__thanks' role='status'>{t('feedback.thanks')}</p>}
          {send.isError && <p className='feedback__error' role='alert'>{errorMessage(send.error)}</p>}
          <button type='submit' className='pill-button pill-button--primary feedback__send' disabled={send.isPending || message.trim().length < 3}>{send.isPending ? t('common.sending') : t('feedback.send')}</button>
        </div>
      </form>
    </section>
  )
}

export default Feedback
