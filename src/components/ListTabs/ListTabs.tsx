import { NavLink } from 'react-router'
import './ListTabs.css'
import { t } from '../../i18n'

/** Watch list and life list: two lists of birds, side by side as tabs. */
const ListTabs = ({ lifeCount }: { lifeCount?: number }) => (
  <nav className='list-tabs' aria-label={t('listTabs.label')}>
    <NavLink to='/saved' end className={({ isActive }) => `list-tabs__tab ${isActive ? 'is-active' : ''}`}>{t('listTabs.watch')}</NavLink>
    <NavLink to='/life-list' className={({ isActive }) => `list-tabs__tab ${isActive ? 'is-active' : ''}`}>{lifeCount ? t('listTabs.lifeCount', { count: lifeCount }) : t('listTabs.life')}</NavLink>
  </nav>
)

export default ListTabs
