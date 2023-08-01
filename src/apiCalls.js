fetch('https://api.ebird.org/v2/product/spplist/US-NV-001', {
    headers: {
      "X-eBirdApiToken": "f5n5l2qml9if"
    }
  })
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(err => console.error(err))