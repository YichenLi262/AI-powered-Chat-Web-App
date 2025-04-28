const cpen322 = require('./cpen322-tester.js');

cpen322.connect('http://3.98.223.41/cpen322/test-a4-server.js');


const path = require('path');
const express = require('express');
const WebSocket = require('ws'); // add WebSocket module


const SessionManager = require('./SessionManager.js');
const sessionManager = new SessionManager();


const messages = {
};

function sanitize(text) {
	return text.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}


/////////////////////////////////////////////////////////////
const Database = require('./Database.js');

const messageBlockSize = 2;

const mongoUrl = 'mongodb://localhost:27017';
// const dbName = 'chatrooms';
const dbName = 'cpen322-messenger'; // Update this to match your actual database name



const db = new Database(mongoUrl, dbName);



db.connected
	.then(() => {
		console.log(`[MongoClient] Connected to ${mongoUrl}/${dbName}`);
		return db.getRooms(); // obtain the list of chatrooms
	})
	.then(roomsFromDb => {
		chatrooms = roomsFromDb; // update the chatrooms array

		// Initialize messages for each room
		chatrooms.forEach(room => {
			messages[room._id.toString()] = [];
		});

		console.log('Chatrooms and messages initialized from database');
		return db.getRoom('ai-chat-room')
			.then(room => {
				if (!room) {
					const aiRoom = {
						_id: 'ai-chat-room',
						name: 'AI Assistant',
						image: 'assets/chat-icon.png',
					};
					return db.addRoom(aiRoom);
				}
				return room;
			})
			.then(room => {
				messages[room._id] = messages[room._id] || [];
				console.log('AI Chat Room Initialized');
			});
	})
	.catch(err => {
		console.error('Failed to initialize chatrooms and messages:', err);
	});



db.getRooms()
	.then(rooms => {
		rooms.forEach(room => {
			messages[room._id.toString()] = [];
		});
		console.log('Messages initialized:', messages);
	})
	.catch(err => console.error('Failed to initialize messages:', err));



/////////////////////////////////////////////////////////////

// initialize chatrooms
let chatrooms = [];


const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

let app = express();

app.use(express.json()); // analysis application/json
app.use(express.urlencoded({ extended: true })); // analysis application/x-www-form-urlencoded
// app.use(express.static(path.join(__dirname, 'client'), { extensions: ['html'] }));

// app.use('/cpen322', cpen322());



function logRequest(req, res, next) {
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

app.use(logRequest);


// Protected static files (defined after unprotected ones)
app.get(['/app.js', '/index.html', '/index', '/'], sessionManager.middleware, express.static(clientApp, { extensions: ['html'] }));

app.get('/profile', sessionManager.middleware, (req, res) => {
	res.status(200).json({ username: req.username });
});

app.route('/chat')
	.get(sessionManager.middleware, (req, res) => {
		// db.getRooms()
		// 	.then((rooms) => res.status(200).json(rooms))
		// 	.catch((err) => {
		// 		console.error('Failed to get rooms:', err);
		// 		res.status(500).json({ message: 'Failed to retrieve rooms.' });
		// 	});
		db.getRooms()
			.then(rooms => {
				const result = rooms.map(room => ({
					...room,
					messages: messages[room._id] || [] // send the messages array for each room
				}));
				res.json(result); // send the updated result
			})
			.catch(err => {
				console.error('Failed to get rooms:', err);
				res.status(500).json({ error: 'Failed to get rooms' });
			});
	})
	.post(sessionManager.middleware, (req, res) => {
		const data = req.body;

		if (!data.name) {
			return res.status(400).json({ message: 'Room name is required' });
		}

		const newRoom = {
			_id: data._id,
			name: data.name,
			image: data.image || 'assets/everyone-icon.png',
		};

		db.addRoom(newRoom)
			.then(room => {
				// Initialize messages array for the new room
				messages[room._id.toString()] = []; // Add this line to update the messages object

				console.log('Added room:', room);
				res.json(room);
			})
			.catch(err => {
				console.error('Failed to add room:', err);
				res.status(500).json({ message: 'Failed to add room.' });
			});
	});



/////////////////////////////////////////////////////////////
app.get('/chat/:room_id', sessionManager.middleware, (req, res) => {
	const room_id = req.params.room_id;

	db.getRoom(room_id)
		.then(room => {
			if (room) {
				res.json(room);
			} else {
				res.status(404).json({ error: `Room ${room_id} was not found` });
			}
		})
		.catch(err => {
			console.error('Failed to get room:', err);
			res.status(500).json({ error: 'Failed to get room' });
		});
});


app.post('/chat', sessionManager.middleware, (req, res) => {
	const { name, image = 'assets/everyone-icon.png' } = req.body;

	if (!name) {
		return res.status(400).json({ message: 'Room name is required' });
	}

	const newRoom = { name, image };

	db.addRoom(newRoom)
		.then(room => {
			// update chatrooms and messages
			chatrooms.push(room); // add the new room to the chatrooms array
			messages[room._id.toString()] = []; // initialize the messages array for the new room

			console.log('Added room:', room);
			res.json(room);
		})
		.catch(err => {
			console.error('Failed to add room:', err);
			res.status(500).json({ message: 'Failed to add room.', error: err.message });
		});
});

/////////////////////////////////////////////////////////////
// Assigenment 6
/////////////////////////////////////////////////////////////
const OPENAI_API_KEY = 'sk-xxx';
const axios = require('axios'); // add axios module


app.post('/api/ai-chat', sessionManager.middleware, async (req, res) => {
	const username = req.username || 'Anonymous'; // make sure the username comes from the session
	const { message } = req.body;
	const roomId = 'ai-chat-room'; // fixed AI chat room ID

	try {
		// save the user message to memory
		const userMessage = { username, text: message, timestamp: Date.now() };
		if (!messages[roomId]) {
			messages[roomId] = [];
		}
		messages[roomId].push(userMessage);

		// call the OpenAI API
		const analysisResponse = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-3.5-turbo',
				messages: [
					{ role: 'system', content: 'You are an assistant that analyzes if a question needs to refer to historical chat data.' },
					{ role: 'user', content: `Does the following question require historical chat data? Answer "yes" or "no": "${message}"` },
				],
			},
			{
				headers: {
					'Authorization': `Bearer ${OPENAI_API_KEY}`,
					'Content-Type': 'application/json',
				},
			}
		);

		const requiresHistory = analysisResponse.data.choices[0].message.content.trim().toLowerCase() === 'yes';

		let reply;

		if (requiresHistory) {
			// fetch all messages from the database
			const allMessages = await db.connected.then(db =>
				db.collection('conversations').find({}).toArray()
			);

			// create a context string from all messages
			const context = allMessages.map(conv =>
				conv.messages.map(
					msg => `Room: ${conv.room_id}, ${msg.username}: ${msg.text}`
				).join('\n')
			).join('\n');

			// call the OpenAI API with the context
			const historyResponse = await axios.post(
				'https://api.openai.com/v1/chat/completions',
				{
					model: 'gpt-3.5-turbo',
					messages: [
						{ role: 'system', content: 'You are an AI assistant for analyzing chat data.' },
						{ role: 'user', content: `Chat data:\n${context}\n\nAnswer the question: ${message}` },
					],
				},
				{
					headers: {
						'Authorization': `Bearer ${OPENAI_API_KEY}`,
						'Content-Type': 'application/json',
					},
				}
			);

			reply = historyResponse.data.choices[0].message.content;
		} else {
			// call the OpenAI API without context
			const aiResponse = await axios.post(
				'https://api.openai.com/v1/chat/completions',
				{
					model: 'gpt-3.5-turbo',
					messages: [{ role: 'user', content: message }],
				},
				{
					headers: {
						'Authorization': `Bearer ${OPENAI_API_KEY}`,
						'Content-Type': 'application/json',
					},
				}
			);

			reply = aiResponse.data.choices[0].message.content;
		}

		// save the AI reply to memory
		const aiMessage = { username: 'AI Assistant', text: reply, timestamp: Date.now() };
		messages[roomId].push(aiMessage);

		// save the conversation to the database if the message count reaches the batch size
		if (messages[roomId].length >= messageBlockSize) {
			const conversation = {
				room_id: roomId,
				timestamp: Date.now(),
				messages: [...messages[roomId]],
			};

			await db.addConversation(conversation);
			messages[roomId] = []; // clear the messages in memory
		}

		res.json({ reply });
	} catch (err) {
		console.error('Error processing AI chat:', err.response?.data || err.message);
		res.status(500).json({ error: 'AI service unavailable.' });
	}
});




/////////////////////////////////////////////////////////////
// Assignment 6 end
/////////////////////////////////////////////////////////////


// server.js

app.get('/chat/:room_id/messages', sessionManager.middleware, (req, res) => {
	const room_id = req.params.room_id;
	const before = parseInt(req.query.before, 10) || Date.now();

	db.getLastConversation(room_id, before)
		.then(conversation => {
			if (conversation) {
				res.json(conversation);
			} else {
				res.status(404).json({ message: 'No conversation found' });
			}
		})
		.catch(err => {
			console.error('Failed to get conversation:', err);
			res.status(500).json({ error: 'Failed to get conversation' });
		});
});

// app.use((req, res, next) => {
// 	if (req.path.startsWith('/profile') || ['/', '/app.js', '/index.html', '/index'].includes(req.path)) {
// 		return sessionManager.middleware(req, res, next);
// 	} else {
// 		next();
// 	}
// })
// protected static files (defined after unprotected ones)
/////////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////////
// Assignment 5
/////////////////////////////////////////////////////////////

const crypto = require('crypto');


/**
 * Compares a plaintext password with the stored salted hash.
 * @param {string} password - The plaintext password.
 * @param {string} saltedHash - The stored salted SHA256 hash.
 * @returns {boolean} True if the password matches, false otherwise.
 */
function isCorrectPassword(password, saltedHash) {
	const salt = saltedHash.substring(0, 20);
	const saltedPassword = password + salt;
	const hash = crypto.createHash('sha256').update(saltedPassword).digest('base64');
	return hash === saltedHash.substring(20);
}

// Export the function for testing purposes
module.exports.isCorrectPassword = isCorrectPassword;

app.get('/logout', (req, res) => {
	sessionManager.deleteSession(req, res);
	res.redirect('/login');
});



// Unprotected static file serving middleware
app.use('/', express.static(clientApp, { extensions: ['html'] }));



app.use((err, req, res, next) => {
	if (err instanceof SessionManager.Error) {
		if (req.headers.accept && req.headers.accept.includes('application/json')) {
			res.status(401).json({ error: err.message });
		} else {
			res.redirect('/login');
		}
	} else {
		// return 500 for all other errors
		res.status(500).send('Internal Server Error');
	}
});

app.post('/login', (req, res) => {
	console.log('Received login request:', req.body);
	const { username, password } = req.body;

	if (!username || !password) {
		return res.redirect('/login'); // Redirect to login page on invalid input
	}

	db.getUser(username)
		.then(user => {
			if (!user) {
				console.error('User not found:', username);
				return res.redirect('/login');
			}

			if (!isCorrectPassword(password, user.password)) {
				console.error('Incorrect password for user:', username);
				return res.redirect('/login');
			}

			// Create a session for the user and redirect to the main page
			sessionManager.createSession(res, username);
			res.redirect('/');
		})
		.catch(err => {
			console.error('Error during login:', err);
			res.status(500).send('Internal Server Error');
		});
});


// start the server
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

// create a WebSocket server
// when a client connects, add a message event listener
const broker = new WebSocket.Server({
	port: 8000,
	verifyClient: (info, done) => {
		const cookieHeader = info.req.headers['cookie'];
		if (!cookieHeader) {
			console.log('No cookie header, rejecting connection');
			return done(false, 401, 'Unauthorized');
		}

		const cookies = parseCookies(cookieHeader);
		const token = cookies['cpen322-session'];

		if (!token || !sessionManager.getUsername(token)) {
			console.log('Invalid session token, rejecting connection');
			return done(false, 401, 'Unauthorized');
		}

		// add the username to the request object
		info.req.username = sessionManager.getUsername(token);
		done(true);
	}
});


console.log(`WebSocket server is listening on ws://localhost:8000`);

// handle WebSocket connections
// server.js

function parseCookies(cookieHeader) {
	const cookies = {};
	cookieHeader && cookieHeader.split(';').forEach(cookie => {
		const parts = cookie.split('=');
		const name = parts.shift().trim();
		const value = decodeURIComponent(parts.join('='));
		cookies[name] = value;
	});
	return cookies;
}


broker.on('connection', (ws, request) => {
	console.log('A new client has connected.');
	const username = request.username;
	if (!username) {
		console.log('No username associated with the connection, closing socket');
		ws.close();
		return;
	}

	// store the username in the WebSocket object
	ws.username = username;

	ws.on('message', (message) => {
		try {
			const messageString = message.toString(); // 将 Buffer 转换为字符串
			console.log('[Server] Received message (as string):', messageString);
			const msgData = JSON.parse(message);
			const { roomId, text } = msgData;

			// check if the message is valid
			if (!roomId || !text) {
				console.error('Invalid message format:', msgData);
				return;
			}

			// get the username from the WebSocket object
			const username = ws.username;

			const sanitizedText = sanitize(text);

			// check if the room exists
			if (messages[roomId]) {
				const newMessage = { username, text: sanitizedText };
				messages[roomId].push(newMessage);

				// create a JSON string from the message data
				const outgoingMessage = JSON.stringify({
					roomId,
					username,
					text: sanitizedText,
				});

				// send the message to all clients in the room
				broker.clients.forEach((client) => {
					if (client.readyState === WebSocket.OPEN) {
						client.send(outgoingMessage);
					}
				});

				// save the conversation if the message block size is reached
				if (messages[roomId].length >= messageBlockSize) {
					const conversation = {
						room_id: roomId,
						timestamp: Date.now(),
						messages: [...messages[roomId]],
					};

					console.log('Saving conversation:', conversation);

					db.addConversation(conversation)
						.then(() => {
							messages[roomId] = [];
						})
						.catch(err => {
							console.error('Failed to save conversation:', err);
						});
				}
			} else {
				console.error(`Room ID ${roomId} does not exist.`);
			}
		} catch (err) {
			console.error('Failed to process message:', err);
		}
	});


	ws.on('close', () => {
		console.log('A client has disconnected.');
	});
});
cpen322.export(__filename, { app, messages, chatrooms, broker, db, messageBlockSize });
// cpen322.export(__filename, { app, db, messages, messageBlockSize });


// export the app, messages, chatrooms, and broker objects
// cpen322.export(__filename, { app, messages, chatrooms, broker, db, messageBlockSize });

// cpen322.export(__filename, { app, db, messages, messageBlockSize, sessionManager, isCorrectPassword });
