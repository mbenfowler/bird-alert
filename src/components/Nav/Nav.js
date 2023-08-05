import { Link } from "react-router-dom"
import PropTypes from "prop-types"
import './Nav.css'

const Nav = ({setNetworkError}) => {
    const handleClick = () => {
        setNetworkError(null)
    }

    return (
        <nav>
            <Link onClick={handleClick} className='text-link' to='/'><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            <div>
                <Link to='/saved'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/bird.png'} alt='saved birds'/></Link>
                <Link to='/settings'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/settings.png'} alt='user settings'/></Link>
            </div>
        </nav>
    )
}

export default Nav

Nav.propTypes = {
    setNetworkError: PropTypes.func.isRequired
}
