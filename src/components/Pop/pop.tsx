import { toast } from 'react-toastify'
import './Pop.css'
import { Trans } from 'react-i18next'

/**
 * Small rewards for the taps that matter: a star that bounces with a few sparks when a bird goes
 * on the watch list (a softer dip coming off), and a burst of feathers with a "Lifer!" banner
 * when one goes on the life list. Driven by the Web Animations API from the click itself, so it
 * restarts on every tap without remounting the control (which would lose keyboard focus), and the
 * burst lives on the page, not inside the control, so a checkbox can have one too. With reduced
 * motion there is no movement at all: the control's own checked state says what happened.
 */
const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

const canAnimate = (el: Element | null): el is Element => Boolean(el) && !reducedMotion() && typeof el!.animate === 'function'

/** Marks the element while it moves, for styles and tests, and clears the mark when it stops. */
const mark = (el: Element, animation: Animation) => {
  el.classList.add('is-popping')
  const clear = () => el.classList.remove('is-popping')
  animation.addEventListener('finish', clear)
  animation.addEventListener('cancel', clear)
}

/** Pieces flung out from the element's centre, on a layer that removes itself when they land. */
const burst = (el: Element, kind: 'sparks' | 'feathers') => {
  const box = el.getBoundingClientRect()
  const layer = document.createElement('div')
  layer.className = `pop-burst pop-burst--${kind}`
  layer.setAttribute('aria-hidden', 'true')
  layer.style.left = `${box.left + box.width / 2}px`
  layer.style.top = `${box.top + box.height / 2}px`
  document.body.appendChild(layer)
  const count = kind === 'sparks' ? 6 : 12
  const flights = Array.from({ length: count }, (_, i) => {
    const piece = document.createElement('span')
    piece.className = 'pop-burst__piece'
    layer.appendChild(piece)
    // Evenly round the circle, nudged so no two bursts look alike.
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const reach = kind === 'sparks' ? 26 + Math.random() * 8 : 50 + Math.random() * 40
    const x = Math.cos(angle) * reach
    const y = Math.sin(angle) * reach
    const turn = angle + (Math.random() - 0.5) * 3
    return piece.animate(kind === 'sparks'
      ? [
          { transform: 'translate(-50%, -50%) rotate(45deg) scale(0.4)', opacity: 1 },
          { transform: `translate(calc(-50% + ${x * 0.8}px), calc(-50% + ${y * 0.8}px)) rotate(45deg) scale(1.1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(45deg) scale(0.8)`, opacity: 0 }
        ]
      // Feathers fly out, then drift down as they turn and fade.
      : [
          { transform: `translate(-50%, -50%) rotate(${angle}rad) scale(0.5)`, opacity: 1 },
          { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${(angle + turn) / 2}rad) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${x * 1.15}px), calc(-50% + ${y + 60}px)) rotate(${turn}rad) scale(0.9)`, opacity: 0 }
        ],
    { duration: kind === 'sparks' ? 480 : 1300, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' })
  })
  void Promise.all(flights.map((f) => f.finished.catch(() => undefined))).then(() => layer.remove())
}

/** The watch-list star: a bounce and sparks going on, a small dip coming off. */
export const popStar = (el: Element | null, on: boolean) => {
  if (!canAnimate(el)) return
  // A round star button can pop by a third; a whole tile (setup's bird tiles) only by a little.
  const big = el.getBoundingClientRect().width > 80
  const up = big ? 1.06 : 1.35
  const animation = el.animate(on
    ? [{ transform: 'scale(1)' }, { transform: `scale(${up})`, offset: 0.35 }, { transform: `scale(${big ? 0.98 : 0.9})`, offset: 0.65 }, { transform: `scale(${big ? 1.01 : 1.05})`, offset: 0.85 }, { transform: 'scale(1)' }]
    : [{ transform: 'scale(1)' }, { transform: `scale(${big ? 0.97 : 0.82})` }, { transform: 'scale(1)' }],
  { duration: on ? 520 : 260, easing: 'ease-out' })
  mark(el, animation)
  if (on) burst(el, 'sparks')
}

/** A bird going on the life list: feathers from the button and a "Lifer!" banner. */
export const celebrateLifer = (el: Element | null, comName: string) => {
  if (canAnimate(el)) {
    mark(el, el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' }))
    burst(el, 'feathers')
  }
  toast(<span className='lifer-toast__text'><Trans i18nKey='lifer.toast' values={{ name: comName }} components={{ b: <strong /> }} /></span>, { position: 'bottom-center', className: 'lifer-toast', icon: false, autoClose: 3500, hideProgressBar: true })
}
