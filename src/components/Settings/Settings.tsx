import { useState } from 'react'
import { useNavigate } from 'react-router'
import Form from '../Form/Form'
import AlertCenter from '../AlertCenter/AlertCenter'
import { useLogoutMutation } from '../../hooks/mutations'
import { EXPERIMENTS, readExperiments, writeExperiments } from '../../experiments'
import './Settings.css'

const Settings = () => {
    const logoutMutation = useLogoutMutation()
    const navigate = useNavigate()
    const handleLogout = () => logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') })
    const [experiments, setExperiments] = useState(() => readExperiments())
    const toggleExperiment = (key: string, on: boolean) => {
        const next = new Set(experiments)
        if (on) next.add(key); else next.delete(key)
        writeExperiments(next)
        setExperiments(next)
    }

    return (
        <section id='userSettings'>
            <Form />
            <AlertCenter />
            <section className='settings-card diagnostics' aria-labelledby='diagnosticsHeading'>
                <h2 id='diagnosticsHeading' className='fredericka'>Diagnostics</h2>
                <p className='notification__hint'>Temporary. Each switch turns off one feature of the home page; flip one, go home, tap the gear, come back.</p>
                {EXPERIMENTS.map(({ key, label, hint }) => (
                    <div className='notification notification--sub' key={key}>
                        <div className='notification__text'>
                            <label htmlFor={`x-${key}`}>{label}</label>
                            <p className='notification__hint'>{hint}</p>
                        </div>
                        <div className='notification__controls'>
                            <input className='switch switch--small' type='checkbox' id={`x-${key}`} checked={experiments.has(key)} onChange={(e) => toggleExperiment(key, e.target.checked)} />
                        </div>
                    </div>
                ))}
            </section>
            <div className='settings-footer'>
                <button type='button' className='pill-button' id='logoutButton' onClick={handleLogout} disabled={logoutMutation.isPending}>Log out</button>
            </div>
        </section>
    )
}

export default Settings
