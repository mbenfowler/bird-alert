import PropTypes from "prop-types"
import './Error.css'

const Error = ({ networkError }) => {
    return (
        <section className='error'>
            <p>Something went wrong!</p>
            <p>Please return to home and try again</p>
            <p>{networkError}</p>
        </section>
    )
}

export default Error

Error.propTypes = {
    networkError: PropTypes.string.isRequired
}
