import { Link, useNavigate } from 'react-router'
import { useSessionQuery } from '../../hooks/queries'
import { useLogoutMutation } from '../../hooks/mutations'
import './Nav.css'

const Nav = () => {
    const { data: user } = useSessionQuery()
    const logoutMutation = useLogoutMutation()
    const navigate = useNavigate()

    const handleLogout = () => {
        logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') })
    }

    return (
        <nav>
            <Link className='text-link' to={user ? '/' : '/login'}><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            {user &&
                <div>
                    <Link to='/saved'><img className='nav-img' src='/images/bird.ico' alt='saved birds'/></Link>
                    <div id='settings'>
                        <div id="settingsActions">
                            <Link to='/settings'><p id='settingsText'>Settings</p></Link>
                            <button type='button' className='link-button' onClick={handleLogout} disabled={logoutMutation.isPending}><p>Logout</p></button>
                        </div>
                        <Link to='/settings'><img className='nav-img' src='/images/settings.png' alt='user settings'/></Link>
                    </div>
                </div>
            }
        </nav>
    )
}

export default Nav
