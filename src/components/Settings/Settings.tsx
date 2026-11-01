import { useNavigate } from 'react-router'
import Form from '../Form/Form'
import AlertCenter from '../AlertCenter/AlertCenter'
import LifeList from '../LifeList/LifeList'
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
