import './Settings.css'
import Form from "../Form/Form"

const Settings = ({ isLoaded }) => {
    return (
        <section id='userSettings'>
            <Form isLoaded={isLoaded}/>
        </section>
    )
}

export default Settings
