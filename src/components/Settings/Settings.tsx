import { useNavigate } from 'react-router'
import Form from '../Form/Form'
import AlertCenter from '../AlertCenter/AlertCenter'
import LifeList from '../LifeList/LifeList'
import Places from '../AlertCenter/Places'
import PasskeySettings from '../PasskeySettings/PasskeySettings'
import Feedback from '../Feedback/Feedback'
import DeleteAccount from '../DeleteAccount/DeleteAccount'
import { useLogoutMutation } from '../../hooks/mutations'
import './Settings.css'
import { t } from '../../i18n'

const Settings = () => {
    const logoutMutation = useLogoutMutation()
    const navigate = useNavigate()
    const handleLogout = () => logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') })

    return (
        <section id='userSettings'>
            <Form />
            {/* Where you bird comes right after your details: home, then the places you travel to. */}
            <section className='alert-center places-section' aria-labelledby='placesHeading'>
                <h2 className='fredericka' id='placesHeading'>{t('places.title')}</h2>
                <Places />
            </section>
            <LifeList />
            <PasskeySettings />
            <AlertCenter />
            <Feedback />
            <div className='settings-footer'>
                <button type='button' className='pill-button' id='logoutButton' onClick={handleLogout} disabled={logoutMutation.isPending}>{t('settings.logout')}</button>
                <DeleteAccount />
            </div>
        </section>
    )
}

export default Settings
