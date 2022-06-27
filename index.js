import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
import joi from 'joi';
import dayjs from 'dayjs';

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
  db = mongoClient.db('bate_papo_uol');
});

const participantsSchema = joi.object({
    name: joi.string().required()
  });
const messagesSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message','private_message').required(),
});

function checkIfNameExists(name){
    console.log(name)
    db.collection('participants').findOne({name:name}).then( foundName=>{
        if(foundName){
            return true;
        }else{
            return false;
        }
    });
    
}

app.post('/participants', async (req, res) => {
    const participant = { name:req.body.name, lastStatus: Date.now() };
    const validation = participantsSchema.validate(req.body, { abortEarly: true });
    if (validation.error) {
      res.sendStatus(422);
      return;
    }
    console.log(participant.name)
    try {
        const nameAlreadyExistis= await db.collection('participants').findOne({name:participant.name})
        if(nameAlreadyExistis){
            console.log("name já exist")
            res.sendStatus(422);
            return;
        }
        await db.collection('participants').insertOne(participant);
        const message = {from:participant.name,to:"Todos",text:"entra na sala...",type:"status",time:dayjs().format('HH:mm:ss')}
        await db.collection('messages').insertOne(message);
        console.log(message)
        res.sendStatus(201);
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
});

app.get('/participants', async (req, res) => {
    try{
    const participants=await db.collection('participants').find().toArray();
    if (!participants) {
        return res.sendStatus(404);
    }
    res.send(participants);
    }catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {
    const validation = messagesSchema.validate(req.body, { abortEarly: true });
    if (validation.error) {
        console.log("validation error")
        res.sendStatus(422);
        return;
    }
    try {
        const nameAlreadyExistis= await db.collection('participants').findOne({name:req.headers.user})
        if(!nameAlreadyExistis){
            console.log("name not exist")
            res.sendStatus(422);
            return;
        }
        const message={to:req.body.to,
            text:req.body.text,
            type:req.body.type,
            from:req.headers.user,
            time:dayjs().format('HH:mm:ss')}
        await db.collection('messages').insertOne(message);
        console.log(message)
        res.sendStatus(201);
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
});


app.listen(5000, () => {
    console.log('Server is litening on port 5000.');
});