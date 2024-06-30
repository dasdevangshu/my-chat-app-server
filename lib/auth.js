import { Lucia } from "lucia";
import { GitHub } from "arctic";
// import dotenv from "dotenv";
import { adapter } from "./mongo.js";

// import type { DatabaseUser } from "./db.js";

// import { webcrypto } from "crypto";
// globalThis.crypto = webcrypto as Crypto;

// dotenv.config();

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: process.env.NODE_ENV === "production"
		}
	},
	getUserAttributes: (attributes) => {
		return {
			githubId: attributes.github_id,
			username: attributes.username
		};
	}
});

export const github = new GitHub(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET);

// declare module "lucia" {
// 	interface Register {
// 		Lucia: typeof lucia;
// 		DatabaseUserAttributes: Omit<DatabaseUser, "id">;
// 	}
// }