const express = require('express')
const path = require('path')
const fs = require('fs')
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const {OAuth2Client} = require('google-auth-library')

const DB_FILE = path.join(__dirname, 'data.sqlite')
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

const app = express()
app.use(cors())
app.use(express.json())

// Serve static files from current directory
app.use(express.static(path.join(__dirname)))

// Initialize DB
if(!fs.existsSync(DB_FILE)){
  console.log('Creando base de datos...')
}
const db = new sqlite3.Database(DB_FILE)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'TU-ID-DE-CLIENTE-REAL.apps.googleusercontent.com' // <-- PEGA AQUÍ TU ID DE CLIENTE REAL
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS students (
    sid TEXT PRIMARY KEY,
    name TEXT,
    studentId TEXT,
    level TEXT,
    email TEXT,
    attendance TEXT DEFAULT '{}',
    grades TEXT DEFAULT '{}'
  )`)

  // ensure default admin
  db.get('SELECT username FROM users WHERE username = ?', ['admin'], (err,row)=>{
    if(err) return console.error(err)
    if(!row){
      const hashed = bcrypt.hashSync('123', 10)
      db.run('INSERT INTO users(username,password) VALUES(?,?)', ['admin', hashed])
      console.log('Usuario admin creado (admin/123)')
    }
  })
})

// Helpers
function authMiddleware(req,res,next){
  const auth = req.headers.authorization
  if(!auth) return res.status(401).json({error:'missing authorization'})
  const parts = auth.split(' ')
  if(parts.length!==2) return res.status(401).json({error:'invalid authorization'})
  const token = parts[1]
  jwt.verify(token, SECRET, (err, payload)=>{
    if(err) return res.status(401).json({error:'invalid token'})
    req.user = payload.user
    next()
  })
}

app.get('/api/ping', (req,res)=> res.json({ok:1}))

app.post('/api/register', (req,res)=>{
  const {username,password} = req.body || {}
  if(!username || !password) return res.status(400).json({error:'missing fields'})
  const hashed = bcrypt.hashSync(password, 10)
  db.run('INSERT INTO users(username,password) VALUES(?,?)', [username, hashed], function(err){
    if(err) return res.status(400).json({error:err.message})
    const token = jwt.sign({user:username}, SECRET, {expiresIn:'8h'})
    res.json({ok:1, user:username, token})
  })
})

app.post('/api/login', (req,res)=>{
  const {username,password} = req.body || {}
  if(!username || !password) return res.status(400).json({error:'missing fields'})
  db.get('SELECT password FROM users WHERE username = ?', [username], (err,row)=>{
    if(err) return res.status(500).json({error:err.message})
    if(!row) return res.status(401).json({error:'user not found'})
    const ok = bcrypt.compareSync(password, row.password)
    if(!ok) return res.status(401).json({error:'invalid credentials'})
    const token = jwt.sign({user:username}, SECRET, {expiresIn:'8h'})
    res.json({ok:1, user:username, token})
  })
})

// Endpoint para verificar un token existente
app.get('/api/verify-token', authMiddleware, (req, res) => {
  res.json({ ok: 1, user: req.user });
});

// Google ID token login: verify id token and upsert user
app.post('/api/google-login', async (req,res)=>{
  const { idToken } = req.body || {}
  if(!idToken) return res.status(400).json({error:'missing idToken'})
  if(!GOOGLE_CLIENT_ID) return res.status(500).json({error:'server not configured: missing GOOGLE_CLIENT_ID'})
  try{
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    const email = payload.email
    const name = payload.name || email
    if(!email) return res.status(400).json({error:'token missing email'})
    // ensure user exists
    db.get('SELECT username FROM users WHERE username = ?', [email], (err,row)=>{
      if(err) return res.status(500).json({error:err.message})
      if(row){
        const token = jwt.sign({user:email}, SECRET, {expiresIn:'8h'})
        return res.json({ok:1, user: email, token})
      }
      // create user with random password (not used) and return token
      const randomPass = Math.random().toString(36).slice(2)
      const hashed = bcrypt.hashSync(randomPass, 10)
      db.run('INSERT INTO users(username,password) VALUES(?,?)', [email, hashed], function(err2){
        if(err2) return res.status(500).json({error:err2.message})
        const token = jwt.sign({user:email}, SECRET, {expiresIn:'8h'})
        return res.json({ok:1, user: email, token})
      })
    })
  }catch(e){
    return res.status(401).json({error:'invalid id token', detail: e.message})
  }
})

// Students API
app.get('/api/students', authMiddleware, (req,res)=>{
  db.all('SELECT * FROM students', [], (err,rows)=>{
    if(err) return res.status(500).json({error:err.message})
    const out = rows.map(r=>({
      sid: r.sid,
      name: r.name,
      id: r.studentId,
      level: r.level,
      email: r.email,
      attendance: JSON.parse(r.attendance || '{}'),
      grades: JSON.parse(r.grades || '{}')
    }))
    res.json(out)
  })
})

app.post('/api/students', authMiddleware, (req,res)=>{
  const s = req.body
  if(!s || !s.sid) return res.status(400).json({error:'missing student sid'})
  db.run('INSERT INTO students(sid,name,studentId,level,email,attendance,grades) VALUES(?,?,?,?,?,?,?)', [s.sid,s.name,s.id,s.level,s.email,JSON.stringify(s.attendance||{}),JSON.stringify(s.grades||{})], function(err){
    if(err) return res.status(400).json({error:err.message})
    res.json({ok:1})
  })
})

app.put('/api/students/:sid', authMiddleware, (req,res)=>{
  const sid = req.params.sid
  const s = req.body
  db.run('UPDATE students SET name=?, studentId=?, level=?, email=?, attendance=?, grades=? WHERE sid=?', [s.name,s.id,s.level,s.email,JSON.stringify(s.attendance||{}),JSON.stringify(s.grades||{}), sid], function(err){
    if(err) return res.status(500).json({error:err.message})
    res.json({ok:1})
  })
})

app.delete('/api/students/:sid', authMiddleware, (req,res)=>{
  const sid = req.params.sid
  db.run('DELETE FROM students WHERE sid = ?', [sid], function(err){
    if(err) return res.status(500).json({error:err.message})
    res.json({ok:1})
  })
})

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
