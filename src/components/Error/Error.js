import { useContext, useEffect } from 'react'
import BirdsContext from '../BirdsContext/BirdsContext'
import './Error.css'

const Error = ({networkError}) => {    
    const { setUser } = useContext(BirdsContext)

    useEffect(() => {
        setUser(prev => {
            return ({...prev, location: ""})
        })
    }, [])
    
    return (
        <section className='error'>
            <p>Something went wrong!</p>
            <p>Please return to home and try again</p>
            <p>{networkError}</p>
        </section>
    )
}

export default Error