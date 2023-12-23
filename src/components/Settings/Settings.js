import './Settings.css'
import Form from "../Form/Form"
import AlertCenter from '../AlertCenter/AlertCenter'

const Settings = ({ isLoaded }) => {
    return (
        <section id='userSettings'>
            <Form isLoaded={isLoaded}/>
            <AlertCenter isLoaded={isLoaded}/>
        </section>
    )
}

export default Settings
