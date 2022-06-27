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

const participantSchema = joi.object({
    name: joi.string().required()
  });

app.post('/participants', async (req, res) => {
    const participant = { name:req.body.name, lastStatus: Date.now() };
    const validation = participantSchema.validate(req.body, { abortEarly: true });
    if (validation.error) {
      res.sendStatus(422);
      return;
    }
    console.log(participant.name)
    try {
       const nameAlreadyExists=await db.collection('participants').findOne({name:participant.name});
       if(nameAlreadyExists){
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

app.listen(5000, () => {
    console.log('Server is litening on port 5000.');
});