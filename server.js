const express = require('express')
const app = express()

app.set('port', process.env.PORT || 3001)
app.locals.title = 'Bird Alert'

app.get('/', (req, res) => {
    res.send('Hello World')
})

app.locals.user = {
  name: "",
  location: "",
  emailAddress: "",
  phoneNumber: ""
}

app.get('/api/v1/user', (req, res) => {
  res.json(app.locals.user)
})

app.listen(app.get('port'), () => {
    console.log(`${app.locals.title} is running on http://localhost:${app.get('port')}.`)
})
