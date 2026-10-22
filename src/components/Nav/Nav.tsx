import { Link, useNavigate } from 'react-router'
import { useSessionQuery } from '../../hooks/queries'
import { useLogoutMutation } from '../../hooks/mutations'
import { postPushTrace } from '../../apiCalls'
import './Nav.css'

const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

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
                        {/* The hover menu exists only where hovering does. On touch screens it was hidden by a clip
                            under the gear, and iOS then dropped most taps on the gear; Log out lives on the settings page. */}
                        {canHover &&
                            <div id="settingsActions">
                                <Link to='/settings'><p id='settingsText'>Settings</p></Link>
                                <button type='button' className='link-button' onClick={handleLogout} disabled={logoutMutation.isPending}><p>Logout</p></button>
                            </div>}
                        <Link to='/settings' className='nav-gear' aria-label='Settings' onClick={(e) => { void postPushTrace({ event: 'nav-gear-click', source: 'app', path: window.location.pathname, pointer: (e.nativeEvent as PointerEvent).pointerType ?? null, target: (e.target as HTMLElement).tagName }) }}>
                            <img className='nav-img' src='/images/settings.png' alt=''/>
                        </Link>
                    </div>
                </div>
            }
        </nav>
    )
}

export default Nav
