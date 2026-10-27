import { NavLink } from 'react-router'
import './ListTabs.css'

/** Watch list and life list: two lists of birds, side by side as tabs. */
const ListTabs = ({ lifeCount }: { lifeCount?: number }) => (
  <nav className='list-tabs' aria-label='Your lists'>
    <NavLink to='/saved' end className={({ isActive }) => `list-tabs__tab ${isActive ? 'is-active' : ''}`}>Watch list</NavLink>
    <NavLink to='/life-list' className={({ isActive }) => `list-tabs__tab ${isActive ? 'is-active' : ''}`}>Life list{lifeCount ? ` (${lifeCount})` : ''}</NavLink>
  </nav>
)

export default ListTabs
