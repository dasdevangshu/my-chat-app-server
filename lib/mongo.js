import { Lucia } from "lucia";
import { MongodbAdapter } from "@lucia-auth/adapter-mongodb";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

//console.log('MONGODB URI:', process.env.MONGODB_URI);
await mongoose.connect(process.env.MONGODB_URI);

export const User = mongoose.model(
	"User",
	new mongoose.Schema(
		{
			_id: {
				type: String,
				required: true
			},
			github_id: {
				type: String,
			},
			username: {
				type: String,
				required: true
			},
			password: {
				type: String,
			}
		},
		{ _id: false }
	)
);

export const Message = mongoose.model(
	"Message",
	new mongoose.Schema(
		{
			to: {
				type: String,
				required: true
			},
			from: {
				type: String,
				required: true
			},
			message: {
				type: String,
				required: true
			}
		},
		{
			timestamps: true
		}
	)
);

export const Conversation = mongoose.model(
	"Conversation",
	new mongoose.Schema(
		{
			to: {
				type: String,
				required: true
			},
			from: {
				type: String,
				required: true
			},
			status: {
				type: String,
				required: true
			}
		},
	)
);

export const Session = mongoose.model(
	"Session",
	new mongoose.Schema(
		{
			_id: {
				type: String,
				required: true
			},
			user_id: {
				type: String,
				required: true
			},
			expires_at: {
				type: Date,
				required: true
			}
		},
		{ _id: false }
	)
);

export const adapter = new MongodbAdapter(
	mongoose.connection.collection("sessions"),
	mongoose.connection.collection("users")
);
