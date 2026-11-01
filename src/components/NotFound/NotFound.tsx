import { Link } from 'react-router'
import './NotFound.css'
import { t } from '../../i18n'

const NotFound = () => (
    <section id='notFound'>
        <p>{t('notFound.missing')}</p>
        <Link to='/'><button className='navigate-button'>{t('notFound.home')}</button></Link>
    </section>
)

export default NotFound
