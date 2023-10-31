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
        const nuthatchData = await getBirdImg(birdData[0].comName)
        const birdImg = nuthatchData.entities[0]?.images[0]
        birdsData.push({...birdData[0], birdImg, isChecked: false})
    }

    console.log(birdsData)

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

const handleError = (res) => {
    if (res.ok) {
      return res.json();
    } else {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }
}

export { getBirdKeysByLocation, getBirdsData }
