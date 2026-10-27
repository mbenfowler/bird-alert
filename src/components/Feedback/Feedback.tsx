import { useId, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, sendFeedback } from '../../apiCalls'
import './Feedback.css'

type Kind = 'idea' | 'bug' | 'other'
const KINDS: [Kind, string][] = [['idea', '💡 Idea'], ['bug', '🐞 Something’s broken'], ['other', '💬 Other']]
const PLACEHOLDER: Record<Kind, string> = {
  idea: 'What would make your birding mornings better?',
  bug: 'What happened, and what did you expect? Which page were you on?',
  other: 'Anything at all.'
}

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
      <h2 className='fredericka'>Ideas &amp; feedback</h2>
      <form className='feedback__card' onSubmit={submit}>
        <p className='feedback__lede'>Tell me what to build next, or what’s broken. It goes straight to the person who makes Bird Alert!, and I’ll reply by email.</p>
        <div className='feedback__kinds' role='radiogroup' aria-label='What kind of feedback'>
          {KINDS.map(([value, label]) => (
            <button key={value} type='button' role='radio' aria-checked={kind === value} className={`feedback__kind ${kind === value ? 'is-on' : ''}`} onClick={() => setKind(value)}>{label}</button>
          ))}
        </div>
        <label className='visually-hidden' htmlFor={id}>Your message</label>
        <textarea id={id} className='feedback__text' rows={5} maxLength={4000} placeholder={PLACEHOLDER[kind]} value={message}
          onChange={(e) => { setMessage(e.target.value); if (send.isSuccess || send.isError) send.reset() }} />
        <div className='feedback__foot'>
          {send.isSuccess && <p className='feedback__thanks' role='status'>Thanks! I read every one.</p>}
          {send.isError && <p className='feedback__error' role='alert'>{errorMessage(send.error)}</p>}
          <button type='submit' className='pill-button pill-button--primary feedback__send' disabled={send.isPending || message.trim().length < 3}>{send.isPending ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </section>
  )
}

export default Feedback
