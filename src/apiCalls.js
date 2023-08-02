const getBirdKeysByLocation = async (region) => {
    const res = await fetch(`https://api.ebird.org/v2/product/spplist/${region}`, {
        headers: {
            "X-eBirdApiToken": "f5n5l2qml9if"
        }
    })
    return await res.json()
}

const getBirdsData = (keys) => {
    let birdsData = [];
    keys.forEach(async key => {
        let thisBirdData;
        await getBirdData(key).then(result => thisBirdData = result)
        birdsData.push(thisBirdData[0])
    });

    return birdsData
}

const getBirdData = async (key) => {
    const res = await fetch(`https://api.ebird.org/v2/ref/taxonomy/ebird?species=${key}&fmt=json`)
    return await res.json()
}

export { getBirdKeysByLocation, getBirdsData }