const { MongoClient, ObjectId } = require('mongodb'); // require the mongodb driver

/**
 * Uses mongodb v6.3 - [API Documentation](http://mongodb.github.io/node-mongodb-native/6.3/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName) {
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		const client = new MongoClient(mongoUrl);

		client.connect()
			.then(() => {
				console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
				resolve(client.db(dbName));
			}, reject);
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function () {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			// Retrieve all chatrooms from the `db` and resolve as an array
			db.collection('chatrooms').find({}).toArray()
				.then(rooms => resolve(rooms))
				.catch(err => reject(err));
		})
	);
};

Database.prototype.getRoom = function (room_id) {
	const query = ObjectId.isValid(room_id)
		? { _id: new ObjectId(room_id) }
		: { _id: room_id };
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			// Retrieve a single chatroom from `db` based on room_id
			db.collection('chatrooms').findOne(query)
				.then(room => resolve(room))
				.catch(err => reject(err));
		})
	);
};

Database.prototype.addRoom = function (room) {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			// Insert a new room into the `chatrooms` collection
			if (!room.name) {
				reject(new Error('Room must have a name'));
				return;
			}

			db.collection('chatrooms').insertOne(room)
				.then(result => {
					const newRoom = { ...room, _id: result.insertedId };
					resolve(newRoom);
				})
				.catch(err => {
					reject(err);
				});
		})
	);
};

Database.prototype.addConversation = function (conversation) {
	console.log('[Database] Connected to MongoDB for adding conversation.');
	return this.connected.then(db => {
		const { room_id, timestamp, messages } = conversation;
		if (!room_id || !timestamp || !messages || !Array.isArray(messages)) {
			// Provide detailed error information if required fields are missing
			return Promise.reject(
				new Error(`Invalid conversation format. Required fields: room_id=${room_id}, timestamp=${timestamp}, messages=${Array.isArray(messages) ? 'array' : 'not array'}`)
			);
		}

		// Insert conversation into the `conversations` collection
		return db.collection('conversations')
			.insertOne(conversation)
			.then(result => {
				// Return the conversation with the MongoDB `_id`
				return { ...conversation, _id: result.insertedId };
			})
			.catch(err => {
				// Capture and return error encountered during database insertion
				return Promise.reject(new Error(`Database insert failed: ${err.message}`));
			});
	});
};

Database.prototype.getLastConversation = function (room_id, before) {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (!room_id) {
				return reject(new Error('room_id is required'));
			}

			const query = {
				room_id: room_id,
				timestamp: { $lt: before || Date.now() },
			};

			db.collection('conversations')
				.find(query)
				.sort({ timestamp: -1 })
				.limit(1)
				.toArray()
				.then(conversations => {
					if (conversations.length > 0) {
						resolve(conversations[0]);
					} else {
						resolve(null);
					}
				})
				.catch(err => reject(err));
		})
	);
};

////////////////////////// Assignment 5 //////////////////////////
Database.prototype.getUser = function (username) {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (!username) {
				return reject(new Error('Username is required'));
			}

			// Retrieve a single user from `db` based on username
			db.collection('users')
				.findOne({ username: username })
				.then(user => resolve(user || null)) // resolve null if user not found
				.catch(err => reject(new Error(`Database query failed: ${err.message}`)));
		})
	);
};


module.exports = Database;
