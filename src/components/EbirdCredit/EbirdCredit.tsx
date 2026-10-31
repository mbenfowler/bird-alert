import './EbirdCredit.css'

/**
 * The credit eBird's API terms ask for wherever its data is shown: one quiet line under every page
 * built from sightings and checklists. eBird is the Cornell Lab's; the line names both.
 */
const EbirdCredit = () => (
  <p className='ebird-credit'>
    Sightings and checklists from <a href='https://ebird.org' target='_blank' rel='noreferrer'>eBird</a>, the Cornell Lab of Ornithology
  </p>
)

export default EbirdCredit
