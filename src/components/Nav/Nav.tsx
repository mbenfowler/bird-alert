import { Link, useNavigate } from 'react-router-dom'
import type { MouseEvent } from 'react'
import { useBirds } from '../BirdsContext/BirdsContext'
import './Nav.css'

interface NavProps {
    setNetworkError: (error: string | null) => void
}

const Nav = ({ setNetworkError }: NavProps) => {
    const { user, logout } = useBirds()
    const navigate = useNavigate()

    const clearError = () => setNetworkError(null)

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const changeSettingsText = (e: MouseEvent) => {
        const settingsText = document.querySelector<HTMLElement>('#settingsText')
        if (!settingsText) return
        if (e.type === 'mouseover') settingsText.style.color = 'red'
        else if (e.type === 'mouseleave') settingsText.style.color = 'inherit'
    }

    return (
        <nav>
            <Link onClick={clearError} className='text-link' to={user ? '/' : '/login'}><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            {user &&
                <div>
                    <Link to='/saved' onClick={clearError}><img className='nav-img' src='/images/bird.ico' alt='saved birds'/></Link>
                    <div id='settings'>
                        <div id="settingsActions">
                            <Link to='/settings' onClick={clearError}><p id='settingsText' onMouseOver={changeSettingsText} onMouseLeave={changeSettingsText}>Settings</p></Link>
                            <button type='button' className='link-button' onClick={handleLogout}><p>Logout</p></button>
                        </div>
                        <Link to='/settings' onClick={clearError}><img className='nav-img' src='/images/settings.png' alt='user settings' onMouseOver={changeSettingsText} onMouseLeave={changeSettingsText}/></Link>
                    </div>
                </div>
            }
        </nav>
    )
}

export default Nav
