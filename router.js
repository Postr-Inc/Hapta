import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import validate from './routes/validate.js';
const app = express()
app.use(cors())
app.use(bodyParser.json())

app.get('/validate/:email/:username', (req, r)=>{
    validate(req, r)
})

app.listen(4000, ()=>{
    console.log(`working`)
})