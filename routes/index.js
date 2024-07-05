import express from "express";
import dotenv from "dotenv";
import {lucia} from '../lib/auth.js'
import { User, Conversation, Message } from "../lib/mongo.js";
import mongoose from "mongoose";

dotenv.config();
export const mainRouter = express.Router();

mainRouter.use(express.json());



//BASE: CHECK STATUS

mainRouter.get("/", async (_, res) => {
    console.log(res.locals)
	if (!res.locals.session) {
		res.status(200).json({message: 'You are not logged in.', user: null});
	}
    else{
        res.status(200).json({message: 'You are logged in.', user: res.locals.user});
    }
});

mainRouter.get("/hi", async (_, res) => {
    res.status(200).message('Hi!')
});


//MESSAGES

mainRouter.post("/send-message", async (req, res) => {
    if (!res.locals.session) {
        return res.status(401).json({ message: 'You need log in first.'});
    }
    const toUsername = req.body.to || null;
    const fromUsername = res.locals.user.username;
    const message = req.body.message || null

    const existingUser = await User.findOne({ username: toUsername }).exec();

    if (toUsername === fromUsername) {
        return res.status(400).json({ message: 'You cannot send messgage to yourself.', user: toUsername, sent: false})
    }

    if (!existingUser) {
        console.log('User was not found.', toUsername);
        return res.status(400).json({ message: 'User was not found.', user: toUsername, sent: false});
    }

    try {
        const tempMessage = await Message.create({
            to: toUsername,
            from: fromUsername,
            message: message
        });
        return res.status(200).json({ message: 'Message was sent.', sent: true, data: tempMessage});
    } catch (e) {
        console.log(e);
    }
    return res.status(400).json({message: 'Something went wrong.'})
});

mainRouter.get("/get-messages", async (req, res) => {
    const numberOfMessages = process.env.INITIAL_LOAD || 15;

    if (!res.locals.session) {
        return res.status(401).json({ message: 'You need log in first.'});
    }
    const toUsername = req.query.to || null;
    const fromUsername = res.locals.user.username;

    //console.log('Getting initial messages from', fromUsername, 'to', toUsername);

    const existingUser = await User.findOne({ username: toUsername }).exec();

    if (toUsername === fromUsername) {
        return res.status(401).json({ message: 'You cannot send messgage to yourself.', user: toUsername})
    }

    if (!existingUser) {
        console.log('User was not found.', toUsername);
        return res.status(400).json({ message: 'User was not found.', user: toUsername});
    }

    const existingMessages = await Message.find({
        $or: [
          { to: toUsername, from: fromUsername },
          { to: fromUsername, from: toUsername }
        ]
      }).limit(numberOfMessages + 1).sort({ _id: -1 }).exec();

      //console.log('Got these messages.', existingMessages);

      const hasMore = existingMessages.length > numberOfMessages;
      const lastId = existingMessages.length > 0 ? existingMessages[existingMessages.length - 1]._id : ''

    res.status(200).json({ message: 'Got these messages.', data: existingMessages.slice(0, numberOfMessages), hasMore: hasMore, lastId: lastId});
})

mainRouter.get("/get-more-messages", async (req, res) => {
    const numberOfMessages = process.env.LOAD_MORE || 10;

    if (!res.locals.session) {
        return res.status(401).json({ message: 'You need log in first.'});
    }
    const toUsername = req.query.to || null;
    const lastId = req.query.lastId || null
    const fromUsername = res.locals.user.username;

    console.log('More messages', toUsername, lastId, fromUsername)
    const ObjectId = mongoose.Types.ObjectId;
    const lastObjectId = new ObjectId(lastId);

    const existingUser = await User.findOne({ username: toUsername }).exec();

    if (toUsername === fromUsername) {
        return res.status(401).json({ message: 'You cannot send messgage to yourself.', user: toUsername})
    }

    if (!existingUser) {
        console.log('User was not found.', toUsername);
        return res.status(200).json({ message: 'User was not found.', user: toUsername});
    }

    const existingMessages = await Message.find({
        $or: [
          { to: toUsername, from: fromUsername },
          { to: fromUsername, from: toUsername }
        ],
        _id: { $lte: lastObjectId }
      }).limit(numberOfMessages + 1).sort({ _id: -1 }).exec();

      const hasMore = existingMessages.length > numberOfMessages;
      const newLastId = existingMessages[existingMessages.length - 1]._id

    res.status(200).json({ message: 'Got these messages.', data: existingMessages.slice(0, numberOfMessages), hasMore: hasMore, lastId: newLastId});
})



//REQUESTS

mainRouter.get("/get-pending-requests", async (req, res) => {
    if (!res.locals.session) {
        return res.status(401).json({ message: 'You need log in first.'});
    }
    const username = res.locals.user.username;

    const existingRequests = await Conversation.find({ to: username, status: 'pending' }).exec();

    res.status(200).json(existingRequests);
})

mainRouter.get("/get-accepted-requests", async (req, res) => {
    if (!res.locals.session) {
        return res.status(401).json({ message: 'You need log in first.'});
    }
    const username = res.locals.user.username;

    const acceptedRequests = await Conversation.find({
        status: 'accepted',
        $or: [
          { to: username },
          { from: username }
        ]
      }).exec();

    res.status(200).json(acceptedRequests)

})

mainRouter.post("/add-request", async (req, res) => {
    if (!res.locals.session) {
        return res.status(401).json({ message: 'you need log in first'});
    }
    const toUsername = req.body.to || null;
    const fromUsername = res.locals.user.username;

    const existingUser = await User.findOne({ username: toUsername }).exec();

    if (toUsername === fromUsername) {
        return res.status(400).json({ message: 'you cannot send a request to yourself', user: toUsername, sent: false})
    }

    if (!existingUser) {
        console.log('User was not found.', toUsername);
        return res.status(400).json({ message: 'user was not found', user: toUsername, sent: false});
    }

    const existingConversation = await Conversation.findOne({ to: toUsername, from: fromUsername }).exec();

    if(existingConversation){
        if(existingConversation.status === 'accepted'){
            console.log('Conversation already exists.', existingConversation);
            return res.status(400).json({ message: 'conversation already exists', sent: false});
        }
        else
        {
            console.log('Request already sent.', existingConversation);
            return res.status(400).json({ message: 'request already sent', sent: false});
        }
    }

    const revExistingConversation = await Conversation.findOne({ to: fromUsername , from: toUsername }).exec();

    if(revExistingConversation){
        if(revExistingConversation.status === 'accepted'){
            console.log('Conversation already exists.', revExistingConversation);
            return res.status(400).json({ message: 'conversation already exists', sent: false});
        }
        else
        {
            console.log('The user has already sent you a request.', revExistingConversation);
            return res.status(400).json({ message: 'the user has already sent you a request', sent: false});
        }
    }

    try {
        const tempConversation = await Conversation.create({
            to: toUsername,
            from: fromUsername,
            status: 'pending'
        });
        return res.status(200).json({ message: 'request was successfully sent', sent: true, data: tempConversation});
    } catch (e) {
        console.log(e);
    }
    return res.status(400).json({message: 'something went wrong...'})
});

mainRouter.post("/accept-request", async (req, res) => {
    if (!res.locals.session) {
		return res.status(401).json({ message: 'You need log in first.'});
	}

    const reqId = req.body.id || null

    const existingConversation = await Conversation.findOne({ _id: reqId}).exec();
    
    if (!existingConversation) {
        return res.status(400).json({ message: 'Something went wrong. Could not find the req.'});
    }
     
    if (existingConversation.to !== res.locals.user.username) {
        console.log('Reqs can only be accepted by the receivers.')
        return res.status(403).json({ message: 'Reqs can only be accepted by the receivers.'});
    }

    const acceptedConversation = await Conversation.updateOne({ _id: reqId}, {status: 'accepted'}).exec();
    const newConversation = await Conversation.findOne({ _id: reqId}).exec();
    console.log(acceptedConversation)
    res.status(200).json({message: 'Req is accepted succesfully.', data: newConversation})
    
})

mainRouter.post("/reject-request", async (req, res) => {
    if (!res.locals.session) {
		return res.status(401).json({ message: 'You need log in first.'});
	}

    const reqId = req.body.id || null

    const existingConversation = await Conversation.findOne({ _id: reqId}).exec();
    
    if (!existingConversation) {
        return res.status(401).json({ message: 'Something went wrong. Could not find the req.'});
    }
     
    if (existingConversation.to !== res.locals.user.username) {
        console.log('Reqs can only be rejected by the receivers.')
        return res.status(403).json({ message: 'Reqs can only be rejected by the receivers.'});
    }

    const deletedConversation = await Conversation.deleteOne({ _id: reqId}).exec();
    res.status(200).json({message: 'Req is rejected succesfully.'})
    
})



//LOGOUT

mainRouter.post("/logout", async (req, res) => {
    //console.log('Got here', req.headers)
    if (!res.locals.session) {
		return res.status(401).end();
	}
	await lucia.invalidateSession(res.locals.session.id);
    const sessionCookie = lucia.createBlankSessionCookie();
    //console.log('Session Cookie:', sessionCookie);
    const clientUrl = process.env.CLIENT_URL;
	return res
        .status(200)
        .json({ message: 'You are logged out.', cookie: sessionCookie.value, clientUrl: clientUrl});
        // .cookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)
});