import express from "express";
import { OAuth2RequestError, generateState } from "arctic";
import { github, lucia } from "../../lib/auth.js";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { User } from "../../lib/mongo.js";
import { generateId } from "lucia";
import dotenv from "dotenv";

dotenv.config();

export const githubLoginRouter = express.Router();

githubLoginRouter.get("/login/github", async (_, res) => {
	const state = generateState();
	const url = await github.createAuthorizationURL(state);
	res
		.appendHeader(
			"Set-Cookie",
			serializeCookie("github_oauth_state", state, {
				path: "/",
				secure: process.env.NODE_ENV === "production",
				httpOnly: true,
				maxAge: 60 * 10,
				sameSite: "lax"
			})
		)
		.redirect(url.toString());
})

githubLoginRouter.get("/login/github/callback", async (req, res) => {
	const code = req.query.code?.toString() ?? null;
	const state = req.query.state?.toString() ?? null;
	//console.log(code, state);
	const storedState = parseCookies(req.headers.cookie ?? "").get("github_oauth_state") ?? null;
	if (!code || !state || !storedState || state !== storedState) {
		res.status(400).end();
		return;
	}
	try {
		const tokens = await github.validateAuthorizationCode(code);
		const githubUserResponse = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken}`
			}
		});
		const githubUser = await githubUserResponse.json();
		const existingUser = await User.findOne({ github_id: githubUser.id }).exec();
		console.log('ExistingUser', existingUser);

		if (existingUser) {
			const session = await lucia.createSession(existingUser.id, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			console.log('Github Cookie1', sessionCookie.value)
			const sessionId = sessionCookie.value;
			const encodedId = encodeURIComponent(sessionId);
			console.log('Github Cookie:', sessionId, encodedId)
			const clientUrl = process.env.CLIENT_URL;
			return res
				// .status(201)
				// .json({ message: 'You are signed up.', cookie: sessionCookie,  })
				.redirect(`${clientUrl}/github?id=${encodedId}`);
			// .cookie(sessionCookie.serialize())
		}

		const userId = generateId(15);
		try {
			const tempUser = await User.create({
				_id: userId,
				github_id: githubUser.id,
				username: githubUser.login
			});
		} catch (e) {
			console.log(e);
		}
		const session = await lucia.createSession(userId, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		const sessionId = sessionCookie.value;
		const encodedId = encodeURIComponent(sessionId);
		console.log('Github Cookie:', sessionId, encodedId)
		const clientUrl = process.env.CLIENT_URL;
		return res
			.redirect(`${clientUrl}/github?id=${encodedId}`);
		//.json({ message: 'You are signed up.', cookie: sessionCookie })
		// .cookie(sessionCookie.serialize())
	} catch (e) {
		if (e instanceof OAuth2RequestError && e.message === "bad_verification_code") {
			res.status(400).end();
			return;
		}
		res.status(500).end();
		return;
	}
});