import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSessionQuery } from '../../hooks/queries'
import { useLogoutMutation } from '../../hooks/mutations'
import './Nav.css'

const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

const Nav = () => {
    const { data: user } = useSessionQuery()
    const logoutMutation = useLogoutMutation()
    const navigate = useNavigate()

    const handleLogout = () => {
        logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') })
    }

    // Pages that fill exactly one screen size themselves under the bar through --nav-height.
    const navRef = useRef<HTMLElement>(null)
    useEffect(() => {
        const nav = navRef.current
        if (!nav) return
        const publish = () => document.documentElement.style.setProperty('--nav-height', `${nav.offsetHeight}px`)
        publish()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(publish)
        observer.observe(nav)
        return () => observer.disconnect()
    }, [])

    return (
        <nav ref={navRef}>
            <Link className='text-link' to={user ? '/' : '/login'}><span id='titleBird'>Bird </span><span id='titleAlert'>Alert!</span></Link>
            {user &&
                <div>
                    {/* The icons are backgrounds on the links, not <img> elements: on iOS an image inside a link
                        carries drag and preview gestures that were swallowing most taps on these two. */}
                    <Link to='/saved' className='nav-icon nav-icon--saved' aria-label='Saved birds' draggable={false}><span className='nav-img' aria-hidden='true' /></Link>
                    <div id='settings'>
                        {/* The hover menu exists only where hovering does. On touch screens it was hidden by a clip
                            under the gear, and iOS then dropped most taps on the gear; Log out lives on the settings page. */}
                        {canHover &&
                            <div id="settingsActions">
                                <Link to='/settings'><p id='settingsText'>Settings</p></Link>
                                <button type='button' className='link-button' onClick={handleLogout} disabled={logoutMutation.isPending}><p>Logout</p></button>
                            </div>}
                        <Link to='/settings' className='nav-icon nav-icon--settings' aria-label='Settings' draggable={false}>
                            <span className='nav-img' aria-hidden='true' />
                        </Link>
                    </div>
                </div>
            }
        </nav>
    )
}

export default Nav
