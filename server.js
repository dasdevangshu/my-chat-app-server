import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Accept", "X-Requested-With", "Origin", "Authorization"],
  credentials: true
}));

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Accept", "X-Requested-With", "Origin", "Authorization"],
    credentials: true
  },
})



//Lucia Stuff
import { verifyRequestOrigin } from "lucia";
import { lucia } from "./lib/auth.js";
import { mainRouter } from "./routes/index.js";
import { githubLoginRouter } from "./routes/github/index.js";
import { credentialsLoginRouter } from "./routes/credentials/index.js";

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.method === "GET") {
    return next();
  }
  const originHeader = req.headers.origin ?? null;
  const hostHeader = req.headers.host ?? null;
  
  // const allowedOrigins = [hostHeader, "http://localhost:3000", "http://localhost:4000"];
  const allowedOrigins = [hostHeader, process.env.CLIENT_URL, process.env.SERVER_URL];
  if (!originHeader || !hostHeader || !verifyRequestOrigin(originHeader, allowedOrigins)) {
    console.log(originHeader, hostHeader)
    console.log('CSRF!')
    return res.status(403).end();
  }
  return next();
});

app.use(async (req, res, next) => {
  // const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");
  // console.log('headers: ', req.headers)
  const sessionId = req.headers['authorization'] ?? null
  console.log('Session Id:', sessionId)
  if (!sessionId) {
    res.locals.user = null;
    res.locals.session = null;
    return next();
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    res.appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize());
  }
  if (!session) {
    res.appendHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize());
  }
  res.locals.session = session;
  res.locals.user = user;
  return next();
});

app.use(mainRouter, githubLoginRouter, credentialsLoginRouter);



//Socket stuff
const PORT = 4000;
let users = {};

function findSocketId(username) {
  for (const [id, name] of Object.entries(users)) {
    if (name === username) {
        return id;
    }
}
return null;
}

io.on('connection', (socket) => {
  console.log('a user connected with Id:', socket.id);

  socket.on('disconnect', (reason) => {
    console.log(`User with ID: ${socket.id} disconnected. Reason: ${reason}`);
    delete users[socket.id];
    console.log(users);
  });

  socket.on('give_name', (data) => {
    users[socket.id] = data.name;
    console.log(users);
  });

  socket.on('send_message_to_user', (data) => {
    console.log('Got new Message from', users[socket.id], 'to', data.to)
    const socketId = findSocketId(data.to)
    if(socketId){

      socket.to(socketId).emit('receive_new_message', data)
    }
    else{
      console.log('User not online.')
    }
  })

  socket.on('send_convo_req', (data) => {
    console.log('Convo Req from', users[socket.id], 'to', data.to)
    const socketId = findSocketId(data.to)
    socket.to(socketId).emit('receive_new_req', data)
  })

  socket.on('accepted_req', (data) => {
    console.log('Convo Req accepted from', users[socket.id], 'to', data.to)
    const socketId = findSocketId(data.to)
    socket.to(socketId).emit('update_accepted_req', data)
  })
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});