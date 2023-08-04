import { Link } from "react-router-dom"
import './Nav.css'

const Nav = () => {
    return (
        <nav>
            <Link className='text-link' to='/'><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            <div>
                <Link to='/saved'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/bird.png'} alt='saved birds'/></Link>
                <Link to='/settings'><img className='nav-img' src={process.env.PUBLIC_URL + '/images/settings.png'} alt='user settings'/></Link>
            </div>
        </nav>
    )
}

export default Nav
