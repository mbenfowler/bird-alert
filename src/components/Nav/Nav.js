import { Link } from "react-router-dom"
import { useContext } from "react"
import PropTypes from "prop-types"
import BirdsContext from "../BirdsContext/BirdsContext"
import './Nav.css'

const Nav = ({setNetworkError}) => {
    const { user, setUser } = useContext(BirdsContext)

    const handleClick = (e) => {
        setNetworkError(null)
        if (e.target.innerText === 'Logout') {
            localStorage.removeItem('user')
            setUser(null)
        }
    }

    const changeSettingsText = (e) => {
        const settingsText = document.querySelector('#settingsText')
        if (e.type === 'mouseover') settingsText.style.color = 'red'
        else if (e.type === 'mouseleave') settingsText.style.color = 'inherit'
    }

    return (
        <nav>
            <Link onClick={handleClick} className='text-link' to={user ? '/' : '/login'}><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            {user &&
                <div>
                    <Link to='/saved'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/bird.ico'} alt='saved birds'/></Link>
                    <div id='settings'>
                        <div id="settingsActions">
                            <Link to='/settings'><p id='settingsText' onMouseOver={changeSettingsText} onMouseLeave={changeSettingsText}>Settings</p></Link>
                            <Link to='/login'><p onClick={handleClick}>Logout</p></Link>
                        </div>
                        <Link to='/settings'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/settings.png'} alt='user settings' onMouseOver={changeSettingsText} onMouseLeave={changeSettingsText}/></Link>
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
