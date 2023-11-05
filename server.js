const express = require('express')
const cors = require('cors')
const app = express()

const environment = process.env.NODE_ENV || 'development'
const configuration = require('./knexfile')[environment]
const db = require('knex')(configuration)

app.set('port', process.env.PORT || 3001)
app.locals.title = 'Bird Alert'

app.use(cors({ origin: 'http://localhost:3000' , credentials :  true}))

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World')
})

// app.locals.user = {
//   "name": "",
//   "location": "",
//   "emailAddress": "",
//   "phoneNumber": ""
// }

app.locals.saved = []

app.get('/api/v1/user', async (req, res) => {
  // res.json(app.locals.user)
  try {
    await db('users').select()
      .then(users => res.status(200).json(users))
  } catch (error) {
    res.status(500).json({ error })
  }
})

app.patch('/api/v1/user', (req, res) => {
  app.locals.user = req.body
  res.json(app.locals.user)
})

app.get('/api/v1/saved', (req, res) => {
  res.json(app.locals.saved)
})

app.post('/api/v1/saved', (req, res) => {
  const bird = req.body
  app.locals.saved.push(bird)
  res.json(app.locals.saved)
})

app.delete('/api/v1/saved', (req, res) => {
  const bird = req.body
  const index = app.locals.saved.findIndex(b => b.speciesCode === bird.speciesCode)
  app.locals.saved.splice(index, 1)
  res.json(app.locals.saved)
})

app.listen(app.get('port'), () => {
    console.log(`${app.locals.title} is running on http://localhost:${app.get('port')}.`)
})
