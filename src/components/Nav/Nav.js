import { Link, useNavigate } from "react-router-dom"
import { useContext } from "react"
import PropTypes from "prop-types"
import BirdsContext from "../BirdsContext/BirdsContext"
import './Nav.css'

const Nav = ({ setNetworkError }) => {
    const { user, logout } = useContext(BirdsContext)
    const navigate = useNavigate()

    const clearError = () => setNetworkError(null)

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const changeSettingsText = (e) => {
        const settingsText = document.querySelector('#settingsText')
        if (!settingsText) return
        if (e.type === 'mouseover') settingsText.style.color = 'red'
        else if (e.type === 'mouseleave') settingsText.style.color = 'inherit'
    }

    return (
        <nav>
            <Link onClick={clearError} className='text-link' to={user ? '/' : '/login'}><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            {user &&
                <div>
                    <Link to='/saved' onClick={clearError}><img className='nav-img' src={process.env.PUBLIC_URL + '/images/bird.ico'} alt='saved birds'/></Link>
                    <div id='settings'>
                        <div id="settingsActions">
                            <Link to='/settings' onClick={clearError}><p id='settingsText' onMouseOver={changeSettingsText} onMouseLeave={changeSettingsText}>Settings</p></Link>
                            <button type='button' className='link-button' onClick={handleLogout}><p>Logout</p></button>
                        </div>
                        <Link to='/settings' onClick={clearError}><img className='nav-img' src={process.env.PUBLIC_URL + '/images/settings.png'} alt='user settings' onMouseOver={changeSettingsText} onMouseLeave={changeSettingsText}/></Link>
                    </div>
                </div>
            }
        </nav>
    )
}

export default Nav

Nav.propTypes = {
    setNetworkError: PropTypes.func.isRequired
}
