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
    try {
        const birdDataPromises = keys.map(async (key) => {
            // if bird exists in birds table get data there, else go external
            const thisBird = await getBird(key);
            if (thisBird.speciesCode) {
                return thisBird;
            } else {
                try {
                    const birdData = await getExternalBirdData(key);
                    const nuthatchData = await getExternalBirdImg(birdData[0].comName);
                    const birdImg = nuthatchData.entities[0]?.images[0]
                        ? `${nuthatchData.entities[0]?.images[0]}?q=75&fm=jpg&w=400&fit=max`
                        : undefined;
                    const wikiData = await getExternalBirdWiki(birdData[0].comName);
                    const wikiURL = wikiData.pages[0]?.id ? `https://en.wikipedia.org/?curid=${wikiData.pages[0].id}` : undefined
                    return { ...birdData[0], birdImg, wikiURL };
                } catch (error) {
                        console.error(`Error fetching external bird data for key ${key}: ${error}`);
                        throw error;
                }
            }
        });

        const birdsData = await Promise.all(birdDataPromises);

        return birdsData;
    } catch (error) {
        console.error(`Error fetching birds data: ${error}`);
        throw error;
    }
}

const getExternalBirdData = async (key) => {
    const res = await fetch(`https://api.ebird.org/v2/ref/taxonomy/ebird?species=${key}&fmt=json`)
    return await handleError(res)
}

const getExternalRegions = async (state) => {
    const res = await fetch(`https://api.ebird.org/v2/ref/region/list/subnational2/US-${state}`, {
        headers: {
            "X-eBirdApiToken": process.env.REACT_APP_EBIRD_API_KEY
        }
    })
    return await handleError(res)
}

const getExternalNotableBirds = async (region) => {
    const res = await fetch(`https://api.ebird.org/v2/data/obs/${region}/recent/notable?back=30`, {
        headers: {
            "X-eBirdApiToken": process.env.REACT_APP_EBIRD_API_KEY
        }
    })

    return await handleError(res)
}

const getExternalLastObserved = async (speciesCode, region) => {
    const res = await fetch(`https://api.ebird.org/v2/data/obs/${region}/recent/${speciesCode}?back=30`, {
        headers: {
            "X-eBirdApiToken": process.env.REACT_APP_EBIRD_API_KEY
        }
    })

    return await handleError(res)
}

const getExternalBirdImg = async (comName) => {
    const res = await fetch(`https://nuthatch.lastelm.software/v2/birds?page=1&pageSize=25&name=${comName}&operator=AND`, {
        headers: {
            "API-Key": process.env.REACT_APP_NUTHATCH_API_KEY
        }
    })

    return await handleError(res)
}

const getExternalBirdWiki = async (comName) => {
    const res = await fetch(`https://api.wikimedia.org/core/v1/wikipedia/en/search/page?q=${comName}&User-Agent=bird alert&limit=1`)
    return await handleError(res)
}

const getBirdObservationsByLocation = async (region) => {
    const res = await fetch(`https://api.ebird.org/v2/data/obs/${region}/recent`, {
        headers: {
            "X-eBirdApiToken": process.env.REACT_APP_EBIRD_API_KEY
        }
    })

    return await handleError(res)
}

const getUserExists = async (email) => {
    const res = await fetch(`${apiBaseURL}/getUserExists?email=${email}`)
    return await handleError(res)
}

const getIsCorrectPass = async (email, password) => {
    const res = await fetch(`${apiBaseURL}/getIsCorrectPass?email=${email}&password=${password}`)
    return await handleError(res)
}

const getUser = async (email) => {
    const res = await fetch(`${apiBaseURL}/getUser?email=${email}`)
    return await handleError(res)
}

const getBird = async (speciesCode) => {
    const res = await fetch(`${apiBaseURL}/getBird?speciesCode=${speciesCode}`)
    return await handleError(res)
}

const getAllBirds = async () => {
    const res = await fetch(`${apiBaseURL}/getAllBirds`)
    return await handleError(res)
}

const patchUser = async (emailLookup, user) => {
    const queryParameters = new URLSearchParams({
        emailLookup: emailLookup
    });

    if (user.email) queryParameters.append('email', user.email)
    if (user.state) queryParameters.append('state', user.state)
    if (user.location) queryParameters.append('location', user.location)
    if (user.confirmed) queryParameters.append('confirmed', user.confirmed)
    if (user.password) queryParameters.append('password', user.password)
    if (user.phone) queryParameters.append('phone', user.phone)

    const res = await fetch(`${apiBaseURL}/patchUser?${queryParameters.toString()}`)

    return await handleError(res, false)
}

const createUser = async (email, password) => {
    const res = await fetch(`${apiBaseURL}/createUser?email=${email}&password=${password}`, {
        method: 'POST'
    })

    sendPasswordConfirmationEmail(email)

    return await handleError(res)
}

const getSavedBirds = async (id) => {
    const res = await fetch(`${apiBaseURL}/getSaved?user_id=${id}`)
    return await handleError(res)
}


const isBirdSaved = async (bird, id) => {
    try {
      const res = await fetch(`${apiBaseURL}/getSavedSpeciesCode?speciesCode=${bird.speciesCode}&user_id=${id}`)
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

const postSavedBird = async (bird, id) => {
    const queryParameters = new URLSearchParams({
        comName: bird.comName,
        sciName: bird.sciName,
        speciesCode: bird.speciesCode,
        category: bird.category,
        order: bird.order,
        familyCode: bird.familyCode,
        familyComName: bird.familyComName,
        familySciName: bird.familySciName,
        birdImg: bird.birdImg,
        wikiURL: bird.wikiURL,
        taxonOrder: bird.taxonOrder,
        user_id: id
    });

    const res = await fetch(`${apiBaseURL}/postSaved?${queryParameters.toString()}`)

    return await handleError(res)
}

const deleteSavedBird = async (bird, id) => {
    try {
        const queryParameters = new URLSearchParams({
            speciesCode: bird.speciesCode,
            user_id: id
        });

        const res = await fetch(`${apiBaseURL}/deleteSaved?${queryParameters.toString()}`)

        if (!res.ok) {
            throw new Error('Network response was not ok');
        }

        const responseBody = await res.text();
        const data = responseBody ? JSON.parse(responseBody) : {}

        return data
    } catch(error) {
        console.error('Error deleting saved bird:', error);
        throw error;
    }
}

const sendPasswordConfirmationEmail = async (email) => {
    const res = await fetch(`${apiBaseURL}/sendPasswordConfirmationEmail?email=${email}`)
    return await handleError(res)
}

const getPasswordResetEmail = async (email) => {
    const res = await fetch(`${apiBaseURL}/getResetPass?email=${email}`)
    return await handleError(res)
}

const handleError = (res, required = true) => {
    if (res.ok && required) {
      return res.json();
    } else if (res.bad) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }
}

export {
            getBirdKeysByLocation,
            getBirdsData,
            getBirdObservationsByLocation,
            getUserExists,
            getIsCorrectPass,
            getUser,
            patchUser,
            createUser,
            getAllBirds,
            getSavedBirds,
            isBirdSaved,
            postSavedBird,
            deleteSavedBird,
            getExternalRegions,
            getExternalNotableBirds,
            getExternalLastObserved,
            sendPasswordConfirmationEmail,
            getPasswordResetEmail
       }
