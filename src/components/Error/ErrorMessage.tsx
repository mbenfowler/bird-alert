import './Error.css'

interface ErrorMessageProps {
    networkError: string
}

const ErrorMessage = ({ networkError }: ErrorMessageProps) => (
    <section className='error'>
        <p>Something went wrong!</p>
        <p>Please return to home and try again</p>
        <p>{networkError}</p>
    </section>
)

export default ErrorMessage
