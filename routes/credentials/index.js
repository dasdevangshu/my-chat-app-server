import express from "express";
import { hash, verify } from "@node-rs/argon2";
import { lucia } from "../../lib/auth.js";
import { generateId } from "lucia";
import { User } from "../../lib/mongo.js";
import dotenv from "dotenv";

dotenv.config();

export const credentialsLoginRouter = express.Router();

credentialsLoginRouter.use(express.json());

//SignUp
credentialsLoginRouter.get('/signup/credentials', async (req, res) => {
    if (res.locals.session) {
        return res.status(200).json({ message: 'You are logged in.', user: res.locals.user });
    }
    else {
        res.status(200).json({ message: 'You are not logged in.', user: null });
    }
});

credentialsLoginRouter.post('/signup/credentials', async (req, res) => {
    if (res.locals.session) {
        return res.status(200).json({ message: 'You are logged in.', user: res.locals.user });
    }
    const username = req.body.username || null;
    const password = req.body.password || null;

    //add validation for password

    if(username === null || password === null){
        return res.status(400).json({ message: 'Username or password is missing.'});
    }

    const existingUser = await User.findOne({ username: username }).exec();

    if (existingUser) {
        console.log('User already exists: ', existingUser);
        return res.status(400).json({ message: 'username is taken'});
    }

    const passwordHash = await hash(password, {
        // recommended minimum parameters
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
    });
    const userId = generateId(15);

    try {
        const tempUser = await User.create({
            _id: userId,
            username: username,
            password: passwordHash,
        });
    } catch (e) {
        console.log(e);
    }
    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    const clientUrl = process.env.CLIENT_URL;
    console.log('URL', clientUrl)
    return res
        .status(200)
        .cookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)
        .json({ message: 'You are signed up.' });
});

//LogIn
credentialsLoginRouter.get('/login/credentials', async (req, res) => {
    if (res.locals.session) {
        return res.status(200).json({ message: 'You are logged in.', user: res.locals.user });
    }
    else {
        res.status(200).json({ message: 'You are logged in.', user: res.locals.user });
    }
});

credentialsLoginRouter.post('/login/credentials', async (req, res) => {
    if (res.locals.session) {
        return res.status(200).json({ message: 'You are logged in.', user: res.locals.user });
    }

    const username = req.body.username || null;
    const password = req.body.password || null;

    const existingUser = await User.findOne({ username: username }).exec();

    if (!existingUser) {
        console.log('invalid username or password.');
        return res.status(400).json({ message: 'invalid username or password'});
    }

    const validPassword = await verify(existingUser.password, password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

    if (!validPassword) {
        console.log('Invalid username or password.');
        return res.status(400).json({ message: 'invalid username or password'});
    }

    const session = await lucia.createSession(existingUser.id, {});

    const sessionCookie = lucia.createSessionCookie(session.id);

	res
        .status(200)
		.cookie(sessionCookie.serialize())
        .json({ message: 'You are logged in.' });
});