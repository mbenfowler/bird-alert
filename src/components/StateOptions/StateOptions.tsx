import { CA_PROVINCES, MX_STATES, US_STATES, ZA_PROVINCES } from '../../usStates'

/** The <option>s for a state picker: US states, then Canada's provinces and territories, Mexico's states, and South Africa's provinces. */
const StateOptions = () => (
  <>
    <optgroup label='United States'>
      {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </optgroup>
    <optgroup label='Canada'>
      {CA_PROVINCES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </optgroup>
    <optgroup label='Mexico'>
      {MX_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </optgroup>
    <optgroup label='South Africa'>
      {ZA_PROVINCES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </optgroup>
  </>
)

export default StateOptions
