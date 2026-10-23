import { useNavigate } from 'react-router'
import Form from '../Form/Form'
import AlertCenter from '../AlertCenter/AlertCenter'
import { useLogoutMutation } from '../../hooks/mutations'
import './Settings.css'

const Settings = () => {
    const logoutMutation = useLogoutMutation()
    const navigate = useNavigate()
    const handleLogout = () => logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') })

    return (
        <section id='userSettings'>
            <Form />
            <AlertCenter />
            <div className='settings-footer'>
                <button type='button' className='pill-button' id='logoutButton' onClick={handleLogout} disabled={logoutMutation.isPending}>Log out</button>
            </div>
        </section>
    )
}

export default Settings
