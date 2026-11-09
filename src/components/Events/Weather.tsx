import type { ComponentType, SVGProps } from 'react'
import { CloudIcon, FogIcon, MoonIcon, PartlyCloudyIcon, RainIcon, SnowIcon, StormIcon, SunIcon, WindIcon } from '../Icons/Icons'
import { clockTimeIn, t } from '../../i18n'
import { useDistanceUnit, type DistanceUnit } from '../../distance'
import { GUSTY_KMH, speedIn, tempIn, type WeatherHour, type WeatherKind } from '../../weather'

const ICONS: Record<WeatherKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  clear: SunIcon, clearNight: MoonIcon, partly: PartlyCloudyIcon, cloudy: CloudIcon, fog: FogIcon, rain: RainIcon, snow: SnowIcon, storm: StormIcon, wind: WindIcon
}

export const WeatherIcon = ({ kind }: { kind: WeatherKind | null }) => {
  if (!kind) return null
  const Icon = ICONS[kind]
  return <Icon className='event-weather__icon' data-kind={kind} />
}

/** Rain shows from 10%, gusts once they're strong; the rest always. */
const parts = (hour: WeatherHour, unit: DistanceUnit) => ({
  temp: t(`dayWeather.temp.${unit}`, { n: tempIn(hour.tempC, unit) }),
  wind: hour.windKmh !== null ? t('dayWeather.wind', { speed: t(`dayWeather.speed.${unit}`, { n: speedIn(hour.windKmh, unit) }) }) : null,
  gusts: hour.gustKmh !== null && hour.gustKmh >= GUSTY_KMH ? t('dayWeather.gusts', { speed: t(`dayWeather.speed.${unit}`, { n: speedIn(hour.gustKmh, unit) }) }) : null,
  rain: hour.rain !== null && hour.rain >= 10 ? t('dayWeather.rain', { n: Math.round(hour.rain) }) : null
})

/** "Partly cloudy, 48°F, wind 6 mph, 20% rain". */
const weatherText = (hour: WeatherHour, unit: DistanceUnit) => {
  const p = parts(hour, unit)
  return [hour.kind ? t(`dayWeather.kind.${hour.kind}`) : null, p.temp, p.wind, p.gusts, p.rain].filter(Boolean).join(', ')
}

/** On a stop's row: the icon, then "48°F · wind 6 mph · 20% rain". */
export const StopWeather = ({ hour }: { hour: WeatherHour | null }) => {
  const unit = useDistanceUnit()
  if (!hour) return null
  const p = parts(hour, unit)
  const text = weatherText(hour, unit)
  return (
    <span className='event-weather' data-testid='stop-weather' title={text}>
      <WeatherIcon kind={hour.kind} />
      <span aria-hidden='true'>{[p.temp, p.wind, p.gusts, p.rain].filter(Boolean).join(' · ')}</span>
      <span className='visually-hidden'>{text}</span>
    </span>
  )
}

/** Under the sun's times: "Forecast at Sierra Vista Park & Ride, 5:30 AM: ☀ Clear, 41°F, wind 3 mph". */
export const StartWeather = ({ start, timeZone }: { start: { name: string; at: Date; hour: WeatherHour | null } | null; timeZone?: string }) => {
  const unit = useDistanceUnit()
  if (!start?.hour) return null
  return (
    <p className='event-weather event-weather--start' data-testid='start-weather'>
      <span>{t('dayWeather.atStart', { place: start.name, time: clockTimeIn(start.at, timeZone) })}</span>
      <span className='event-weather__summary'><WeatherIcon kind={start.hour.kind} />{weatherText(start.hour, unit)}</span>
    </p>
  )
}

/** Open-Meteo's data is CC BY 4.0: credited wherever it shows. */
export const WeatherCredit = () => (
  <p className='event-route__note' data-testid='weather-credit'>
    <a href='https://open-meteo.com/' target='_blank' rel='noreferrer'>{t('dayWeather.credit')}</a>
  </p>
)
