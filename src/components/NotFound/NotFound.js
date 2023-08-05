import { Link } from 'react-router-dom'
import './NotFound.css'

const NotFound = () => {
    return (
        <section id='notFound'>
            <p>This page doesn't exist</p>
            <Link to='/'><button>Return home</button></Link>
        </section>
    )
}

export default NotFound