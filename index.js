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
    try {
        const nameAlreadyExistis= await db.collection('participants').findOne({name:participant.name})
        if(nameAlreadyExistis){
            res.sendStatus(422);
            return;
        }
        await db.collection('participants').insertOne(participant);
        const message = {from:participant.name,to:"Todos",text:"entra na sala...",type:"status",time:dayjs().format('HH:mm:ss')}
        await db.collection('messages').insertOne(message);
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
        res.sendStatus(422);
        return;
    }
    try {
        const nameAlreadyExistis= await db.collection('participants').findOne({name:req.headers.user})
        if(!nameAlreadyExistis){
            res.sendStatus(422);
            return;
        }
        const message={to:req.body.to,
            text:req.body.text,
            type:req.body.type,
            from:req.headers.user,
            time:dayjs().format('HH:mm:ss')}
        await db.collection('messages').insertOne(message);
        res.sendStatus(201);
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    function messageFilter(message){
        if(message.type==="message"||message.type==="status"||message.from===req.headers.user||message.to===req.headers.user)
        {
            return true;
        }else{
        return false;
        }
    }
    let limit=0
    if(req.query.limit){
        limit = parseInt(req.query.limit);
    }
    try{
    const allMessages=await db.collection('messages').find().toArray();
    if (!allMessages) {
        return res.sendStatus(404);
    }

    const resMessages=allMessages.filter(messageFilter);
    if(limit>0){
        res.send(resMessages.slice(-limit));
    }else{
        res.send(resMessages);
    }
    }catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {

    try {
        const nameAlreadyExistis= await db.collection('participants').findOne({name:req.headers.user})
        if(!nameAlreadyExistis){
            res.sendStatus(404);
            return;
        }
        await db.collection('participants').updateOne({ 
			name:req.headers.user
		}, { $set: {lastStatus:Date.now()} })
				
        res.sendStatus(200);
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
});

app.delete('/messages/:id', async (req, res) => {
    const id=req.params.id;
    const user = req.headers.user;
    try {
        const message= await db.collection('messages').findOne({_id: new ObjectId(id)})
        if(!message){
            res.sendStatus(404);
            return;
        }
        if(message.from!==user){
            res.sendStatus(401);
            return;
        }

        await db.collection('messages').deleteOne({_id: new ObjectId(id)})
        res.sendStatus(200);

    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
});


async function removeInactiveUsers(){
    const deleteTime = Date.now() - 15000;
    console.log("tick")
    
    function filterUsersToRemove(user){
        if(user.lastStatus<deleteTime){
            return true;
        }
        return false;
    }
    async function handleRemoval(user){
        try{
            await db.collection('messages').insertOne({from: user.name, 
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'status', 
                time:dayjs().format('HH:mm:ss')})
            await db.collection('participants').deleteOne({ name: user.name })
        }
        catch (error) {
            console.error(error);
        }
    }

    const allUsers=await db.collection('participants').find().toArray();
    const usersToRemove=allUsers.filter(filterUsersToRemove);
    usersToRemove.forEach(handleRemoval)


}
setInterval(removeInactiveUsers, 15000);


app.listen(5000, () => {
    console.log('Server is litening on port 5000.');
});