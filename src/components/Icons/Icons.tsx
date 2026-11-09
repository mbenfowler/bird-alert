import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, focusable: false }

/** Filled star, used for "birds on my watch list" alerts. */
export const StarIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
)

/** Circled exclamation mark, used for notable sightings. */
export const AlertIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
  </svg>
)

/** A flag on a pole: where a route starts (the meeting point), in the list and on the map. */
export const FLAG_PATH = 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z'
export const FlagIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d={FLAG_PATH} />
  </svg>
)

/** A closed padlock: a stop kept in place. */
export const LockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2m-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2m3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1z" />
  </svg>
)

/** An open padlock, outlined: a stop free to move. */
export const LockOpenIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2m0 12H6V10h12zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2" />
  </svg>
)

/** Chevron pointing down; add the `is-up` class to flip it. */
export const ChevronIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
  </svg>
)

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14" />
  </svg>
)

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

export const MapIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M10 5.47l4 1.4v11.66l-4-1.4z" />
  </svg>
)

/** Three birds on the wing, used for the arriving-soon feed. */
export const MigrationIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} fill='none' stroke='currentColor' strokeWidth={2.2} strokeLinecap='round' strokeLinejoin='round' {...props}>
    <path d="M2.5 14.5 6.5 11l4 3.5" />
    <path d="M9 9.5 13 6l4 3.5" />
    <path d="M13.5 18.5l4-3.5 4 3.5" />
  </svg>
)

/** A compass needle, for where to go. */
export const CompassIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16m4.24-12.24-6.36 2.12-2.12 6.36 6.36-2.12zM12 13.1a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2" />
  </svg>
)

/** Two columns of dots: a handle to drag a row by. */
export const DragIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M9 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
  </svg>
)

/** Crosshair: the device's own location. */
export const LocateIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8.94 3A8.99 8.99 0 0 0 13 3.06V1h-2v2.06A8.99 8.99 0 0 0 3.06 11H1v2h2.06A8.99 8.99 0 0 0 11 20.94V23h2v-2.06A8.99 8.99 0 0 0 20.94 13H23v-2zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7" />
  </svg>
)

/** iOS's Share glyph: a box with an arrow out of the top. */
export const ShareIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' {...props}>
    <path d='M12 3v12M7.5 7.5 12 3l4.5 4.5M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2' />
  </svg>
)

/** Safari's "Add to Home Screen": a rounded square with a plus. */
export const AddToHomeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' {...props}>
    <rect x='4' y='4' width='16' height='16' rx='4' />
    <path d='M12 8v8M8 12h8' />
  </svg>
)

/** Clock face, for something waiting to be sent. */
export const ClockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </svg>
)

// ---- Sun and weather ----
// The cloud is Material Icons' "cloud" (Google, Apache License 2.0); the rest are drawn here to match.

const CLOUD_PATH = 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z'
/** The cloud, smaller and higher, with room under it for rain, snow or lightning. */
const HighCloud = () => <path d={CLOUD_PATH} transform='translate(2.4 0) scale(0.8)' />
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

/** The sun: a clear day. */
export const SunIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx='12' cy='12' r='4.5' />
    {RAYS.map(a => <rect key={a} x='11' y='1' width='2' height='4' rx='1' transform={`rotate(${a} 12 12)`} />)}
  </svg>
)

/** A crescent moon: a clear night. */
export const MoonIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d='M12.5 3a9 9 0 1 0 8.5 11.9A7.5 7.5 0 0 1 12.5 3z' />
  </svg>
)

/** A cloud: overcast. */
export const CloudIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d={CLOUD_PATH} />
  </svg>
)

/** The sun behind a cloud: partly cloudy. */
export const PartlyCloudyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx='8' cy='8' r='3.2' />
    {RAYS.filter(a => a !== 135).map(a => <rect key={a} x='7.25' y='1' width='1.5' height='2.6' rx='0.75' transform={`rotate(${a} 8 8)`} />)}
    <path d={CLOUD_PATH} transform='translate(6 9.4) scale(0.75)' />
  </svg>
)

/** Bars of mist under a cloud: fog. */
export const FogIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <HighCloud />
    <rect x='3' y='18' width='18' height='2' rx='1' />
    <rect x='6' y='21.5' width='12' height='2' rx='1' />
  </svg>
)

/** Drops under a cloud: drizzle, rain or showers. */
export const RainIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <HighCloud />
    {[6, 11, 16].map(x => <rect key={x} x={x} y='17.5' width='2' height='5' rx='1' transform={`rotate(20 ${x + 1} 20)`} />)}
  </svg>
)

/** Flakes under a cloud: snow. */
export const SnowIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <HighCloud />
    {[[7, 19], [12, 21.5], [17, 19]].map(([x, y]) => <circle key={x} cx={x} cy={y} r='1.6' />)}
  </svg>
)

/** Lightning under a cloud: a thunderstorm. */
export const StormIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <HighCloud />
    <path d='M13 15.5 8.5 20.5H11.5L10.5 24 15.5 18.5H12.5z' />
  </svg>
)

/** Streaks of air: strong gusts. */
export const WindIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d='M3 8.5h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12.5h15a3 3 0 1 1-3 3M3 16.5h7' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
  </svg>
)

const Horizon = () => <rect x='2' y='19' width='20' height='2' rx='1' />

/** Half a sun on the horizon with an arrow up: sunrise. */
export const SunriseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <Horizon />
    <path d='M6.5 17.5a5.5 5.5 0 0 1 11 0z' />
    <path d='M12 2 8.5 6H11v3h2V6h2.5z' />
  </svg>
)

/** Half a sun on the horizon with an arrow down: sunset. */
export const SunsetIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <Horizon />
    <path d='M6.5 17.5a5.5 5.5 0 0 1 11 0z' />
    <path d='M12 10.5 15.5 6.5H13v-4h-2v4H8.5z' />
  </svg>
)

/** Rays over the horizon, the sun still under it: civil twilight. */
export const TwilightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <Horizon />
    {[-60, -30, 0, 30, 60].map(a => <rect key={a} x='11' y='7' width='2' height='6' rx='1' transform={`rotate(${a} 12 19)`} />)}
  </svg>
)
