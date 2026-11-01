import './Error.css'
import { t } from '../../i18n'

interface ErrorMessageProps {
    networkError: string
}

const ErrorMessage = ({ networkError }: ErrorMessageProps) => (
    <section className='error'>
        <p>{t('error.wrong')}</p>
        <p>{t('error.tryAgain')}</p>
        <p>{networkError}</p>
    </section>
)

export default ErrorMessage
