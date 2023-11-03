const express = require('express')
const cors = require('cors')
const app = express()

app.set('port', process.env.PORT || 3001)
app.locals.title = 'Bird Alert'

app.use(cors({ origin: 'http://localhost:3000' , credentials :  true}))

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World')
})

app.locals.user = {
  "name": "",
  "location": "",
  "emailAddress": "",
  "phoneNumber": ""
}

app.get('/api/v1/user', (req, res) => {
  res.json(app.locals.user)
})

app.patch('/api/v1/user', (req, res) => {
  app.locals.user = req.body
  res.json(app.locals.user)
})

app.listen(app.get('port'), () => {
    console.log(`${app.locals.title} is running on http://localhost:${app.get('port')}.`)
})
