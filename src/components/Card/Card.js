import { useContext, useState, useEffect } from "react"
import { toast } from 'react-toastify'
import PropTypes from "prop-types"
import './Card.css'
import BirdsContext from "../BirdsContext/BirdsContext"
import { postSavedBird, deleteSavedBird, isBirdSaved, getSavedBirds } from "../../apiCalls"

const Card = ({ bird }) => {
    const { birds, setBirds, savedBirds, setSavedBirds, user, recentObservations, setBirdAlerts } = useContext(BirdsContext)
    const [isChecked, setIsChecked] = useState(false)

    useEffect(() => {
        const checkSavedStatus = async () => {
            const saved = await isBirdSaved(bird, user.id)
            setIsChecked(saved)
        };
        checkSavedStatus();
    //eslint-disable-next-line
    }, [bird])

    const resolveAfter1Sec = new Promise(resolve => setTimeout(resolve, 500));
    const notify = (action) => {
        toast.promise(resolveAfter1Sec, {
          success: {
            render: action === 'delete' ? 'Bird removed from watch list!' : 'Bird saved to watch list!',
            position: 'bottom-center'
          }
        });
    }

    const handleClick = async () => {
        try {
            if (isChecked) {
                await deleteSavedBird(bird, user.id)
                notify('delete')
            } else {
                await postSavedBird(bird, user.id)
                notify('save')
            }

            setSavedBirds(await getSavedBirds(user.id))

            const updatedBirds = birds.map(b => {
                if (b.speciesCode === bird.speciesCode) {
                    return { ...b, isChecked: !isChecked }
                }
                return b
            })
            setBirds(updatedBirds)
            const savedBirdsObserved = recentObservations.filter(obs => savedBirds.find(savedBird => savedBird.speciesCode === obs.speciesCode))
            setBirdAlerts(savedBirdsObserved)
        } catch (error) {
            console.error("API call error:", error)
        } finally {
            setIsChecked(!isChecked)
        }
    };

    const img = bird.birdImg && bird.birdImg !== 'undefined' ? bird.birdImg : 'images/noBirdImg.png'

    return (
        <div className='card'>
            <img className='bird-img' src={img} alt={`a ${bird.comName}`}/>
            <div className='bird-details'>
                <p>{bird.comName}</p>
                <p className='sci-name'>{`(${bird.sciName})`}</p>
                <p className='last-observed'>
                    {bird.lastObserved
                        && (
                        <>
                            Last observed nearby: <br />
                            {bird.lastObserved}
                        </>
                        )
                    }
                </p>
            </div>
            <input type="checkbox" checked={isChecked} id={bird.speciesCode} name={bird.comName} value={bird.isChecked} onChange={handleClick} />
        </div>
    )
}

export default Card

Card.propTypes = {
    bird: PropTypes.object.isRequired
}
