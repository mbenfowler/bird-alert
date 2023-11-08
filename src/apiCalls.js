const getApiBaseURL = () => {
    if (process.env.NODE_ENV === 'development') {
        return process.env.REACT_APP_LOCAL_API_BASE;
    } else if (process.env.NODE_ENV === 'production') {
        return process.env.REACT_APP_PROD_API_BASE;
    }
};

const apiBaseURL = getApiBaseURL();

const getBirdKeysByLocation = async (region) => {
    const res = await fetch(`https://api.ebird.org/v2/product/spplist/${region}`, {
        headers: {
            "X-eBirdApiToken": process.env.REACT_APP_EBIRD_API_KEY
        }
    })

    return await handleError(res)
}

const getBirdsData = async (keys) => {
    let birdsData = [];
    for (const key of keys) {
        const birdData = await getBirdData(key)
        // const nuthatchData = await getBirdImg(birdData[0].comName)
        // const birdImg = nuthatchData.entities[0]?.images[0]
        const wikiData = await getBirdWiki(birdData[0].comName)
        const wikiURL = `https://en.wikipedia.org/?curid=${wikiData.pages[0].id}`
        birdsData.push({...birdData[0], wikiURL})
    }

    return birdsData
}

const getBirdData = async (key) => {
    const res = await fetch(`https://api.ebird.org/v2/ref/taxonomy/ebird?species=${key}&fmt=json`)
    return await handleError(res)
}

// eslint-disable-next-line no-unused-vars
const getBirdImg = async (comName) => {
    const res = await fetch(`https://nuthatch.lastelm.software/v2/birds?page=1&pageSize=25&name=${comName}&operator=AND`, {
        headers: {
            "API-Key": process.env.NUTHATCH_API_KEY
        }
    })

    return await handleError(res)
}

const getBirdWiki = async (comName) => {
    const res = await fetch(`https://api.wikimedia.org/core/v1/wikipedia/en/search/page?q=${comName}&User-Agent=bird alert&limit=1`)
    return await handleError(res)
}

const getUser = async (userID) => {
    const res = await fetch(`${apiBaseURL}/getUser`)
    return await handleError(res)
}

const patchUser = async (user) => {
    console.log(user)
    const queryParameters = new URLSearchParams({
        username: '',
        password: '',
        location: user.location,
        email: user.email,
        phone: user.phone,
        state: ''
    });
    const res = await fetch(`${apiBaseURL}/patchUserpostSaved?${queryParameters.toString()}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
    })

    return await handleError(res, false)
}

const getSavedBirds = async () => {
    const res = await fetch(`${apiBaseURL}/getSaved`)
    return await handleError(res)
}


const isBirdSaved = async (bird) => {
    try {
      const res = await fetch(`${apiBaseURL}/getSavedSpeciesCode?speciesCode=${bird.speciesCode}`)
      if (res.ok) {
        const data = await res.json()
        return data
      } else {
        console.error("Error response:", res.status, res.statusText)
        return false
      }
    } catch (error) {
      console.error("Fetch error:", error);
      return false;
    }
}

const postSavedBird = async (bird) => {
    const queryParameters = new URLSearchParams({
        comName: bird.comName,
        sciName: bird.sciName,
        speciesCode: bird.speciesCode,
        category: bird.category,
        order: bird.order,
        familyCode: bird.familyCode,
        familyComName: bird.familyComName,
        familySciName: bird.familySciName,
        wikiURL: bird.wikiURL,
        taxonOrder: bird.taxonOrder,
    });
    console.log(queryParameters.toString())
    const res = await fetch(`${apiBaseURL}/postSaved?${queryParameters.toString()}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })

    return await handleError(res)
}

const deleteSavedBird = async (bird) => {
    const res = await fetch(`${apiBaseURL}/deleteSaved?speciesCode=${bird.speciesCode}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })

    return await handleError(res)
}

const handleError = (res, required = true) => {
    if (res.ok && required) {
      return res.json();
    } else if (res.bad) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }
}

export { getBirdKeysByLocation, getBirdsData, getUser, patchUser, getSavedBirds, isBirdSaved, postSavedBird, deleteSavedBird }
