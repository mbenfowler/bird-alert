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

    return (
        <nav>
            <Link onClick={handleClick} className='text-link' to={user ? '/' : '/login'}><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            {user &&
                <div>
                    <Link to='/saved'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/bird.ico'} alt='saved birds'/></Link>
                    {/* <Link to='/settings'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/settings.png'} alt='user settings'/></Link> */}
                    <div id='settings'>
                        <div id="settingsActions">
                            <Link to='/settings'><p>Settings</p></Link>
                            <Link to='/login'><p onClick={handleClick}>Logout</p></Link>
                        </div>
                        <img className='nav-img' src={process.env.PUBLIC_URL + '/images/settings.png'} alt='user settings'/>
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
