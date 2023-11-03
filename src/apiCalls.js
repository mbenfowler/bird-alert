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
        birdsData.push({...birdData[0], wikiURL, isChecked: false})
    }

    return birdsData
}

const getBirdData = async (key) => {
    const res = await fetch(`https://api.ebird.org/v2/ref/taxonomy/ebird?species=${key}&fmt=json`)
    return await handleError(res)
}

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

const getUser = async () => {
    const res = await fetch('http://localhost:3001/api/v1/user')
    return await handleError(res)
}

const patchUser = async (user) => {
    console.log(JSON.stringify(user))
    const res = await fetch('http://localhost:3001/api/v1/user', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
    })

    return await handleError(res, false)
}

const getSavedBirds = async () => {
    const res = await fetch('http://localhost:3001/api/v1/saved')
    return await handleError(res)
}

const postSavedBird = async (bird) => {
    console.log('post')
    const res = await fetch('http://localhost:3001/api/v1/saved', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(bird)
    })

    return await handleError(res)
}

const deleteSavedBird = async (bird) => {
    console.log('delete')
    const res = await fetch('http://localhost:3001/api/v1/saved', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(bird)
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

export { getBirdKeysByLocation, getBirdsData, getUser, patchUser, getSavedBirds, postSavedBird, deleteSavedBird }
