import { useNavigate, useSearchParams } from 'react-router'
import Form from '../Form/Form'
import AlertCenter from '../AlertCenter/AlertCenter'
import LifeList from '../LifeList/LifeList'
import Places from '../AlertCenter/Places'
import PasskeySettings from '../PasskeySettings/PasskeySettings'
import Feedback from '../Feedback/Feedback'
import DeleteAccount from '../DeleteAccount/DeleteAccount'
import { useLogoutMutation } from '../../hooks/mutations'
import { settingsTabFor, SETTINGS_TABS, type SettingsTab } from './settingsTab'
import './Settings.css'
import { t } from '../../i18n'

/**
 * Settings in three tabs, so the page isn't one long scroll: your account (details, home area,
 * language, life list, passkeys), your alerts (the Alert center), and your places (home again, for
 * editing next to the places you travel to). The tab lives in the address; feedback is on every tab.
 */
const Settings = () => {
    const logoutMutation = useLogoutMutation()
    const navigate = useNavigate()
    const [params, setParams] = useSearchParams()
    const tab = settingsTabFor(params, window.location.hash)
    const pick = (next: SettingsTab) => setParams(next === 'account' ? new URLSearchParams() : { tab: next }, { replace: true })
    const handleLogout = () => logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') })

    return (
        <section id='userSettings'>
            <div className='settings-tabs'>
                <div className='timing settings-tabs__switch' role='group' aria-label={t('settings.tabsLabel')}>
                    {SETTINGS_TABS.map(name => (
                        <button key={name} type='button' className={`timing__option ${tab === name ? 'is-selected' : ''}`} aria-pressed={tab === name} onClick={() => pick(name)}>{t(`settings.tab.${name}`)}</button>
                    ))}
                </div>
            </div>
            {tab === 'account' && <>
                <Form />
                <LifeList />
                <PasskeySettings />
            </>}
            {tab === 'alerts' && <AlertCenter />}
            {tab === 'places' && (
                <section className='alert-center places-section' aria-labelledby='placesHeading'>
                    <h2 className='fredericka' id='placesHeading'>{t('places.title')}</h2>
                    <Places />
                </section>
            )}
            <Feedback />
            {tab === 'account' && (
                <div className='settings-footer'>
                    <button type='button' className='pill-button' id='logoutButton' onClick={handleLogout} disabled={logoutMutation.isPending}>{t('settings.logout')}</button>
                    <DeleteAccount />
                </div>
            )}
        </section>
    )
}

export default Settings
