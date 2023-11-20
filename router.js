import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import validate from './routes/validate.js';
import isNew from './routes/isnew.js';
import  Pocketbase  from 'pocketbase';
const app = express()
app.use(cors())
app.use(bodyParser.json())
 
 
 
app.get('/validate/:email/:username', (req, r)=>{
    validate(req, r)
})
app.get('/isnew/:id', (req, res) => {
    if(!req.params.id) res.json({error: true, message: 'id is required'});
    isNew(req, res)
})

app.listen(4000, ()=>{
    console.log(`working`)
})
