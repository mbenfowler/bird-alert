import './EbirdCredit.css'
import { Trans } from 'react-i18next'

/**
 * The credit eBird's API terms ask for wherever its data is shown: one quiet line under every page
 * built from sightings and checklists. eBird is the Cornell Lab's; the line names both.
 */
const EbirdCredit = () => (
  <p className='ebird-credit'>
    <Trans i18nKey='credit.ebird' components={{ ebird: <a href='https://ebird.org' target='_blank' rel='noreferrer' /> }} />
  </p>
)

export default EbirdCredit
