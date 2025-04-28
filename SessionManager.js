const crypto = require('crypto');

class SessionError extends Error { };

function SessionManager() {
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
		/* To be implemented */
		// 1. generate a random token
		const token = crypto.randomBytes(32).toString('hex');

		// 2. store the session data
		const sessionData = {
			username,
			createdAt: Date.now(),
			expiresAt: Date.now() + maxAge,
		};
		sessions[token] = sessionData;
		// console.log("[DEBUG] Session created:", sessions[token]);

		// 3. set the cookie
		// response.cookie('cpen322-session', token, { maxAge, httpOnly: true });
		response.cookie('cpen322-session', token, { maxAge: maxAge, encode: String });

		// 4. delete the session after maxAge
		setTimeout(() => {

			console.log(`Session expired and removed: ${token}`);
			delete sessions[token];
		}, maxAge);

		return token;
	};

	this.deleteSession = (request) => {
		/* To be implemented */
		const token = request.session;
		if (token && sessions[token]) {
			delete request.username;
			delete request.session;
			delete sessions[token];
		}
	};

	this.middleware = (request, response, next) => {
		/* To be implemented */
		const cookieHeader = request.headers['cookie'];
		// console.log("[DEBUG] Cookie header:", cookieHeader);

		// Check if cookie header exists
		if (!cookieHeader) {
			return next(new SessionError("No cookie header found"));
		}

		// Parse cookies
		const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
			const [name, value] = cookie.trim().split('=');
			acc[name] = value;
			return acc;
		}, {});

		// Extract the 'cpen322-session' token
		const token = cookies['cpen322-session'];
		// console.log("[DEBUG] Token extracted from cookies:", token);
		// console.log("[DEBUG] Current sessions:", JSON.stringify(sessions, null, 2));

		if (!token) {
			return next(new SessionError("Session token not found"));
		}

		// Verify the token in the sessions dictionary
		// if (!(token in sessions)) {
		// 	return next(new SessionError("Session token is invalid or expired"));
		// }
		if (!token || !sessions[token]) {
			console.log(`Invalid or missing session: ${token}`);
			next(new SessionError('Invalid session token'));
			return;
		}

		// Assign session and username to request object
		request.session = token;
		request.username = sessions[token].username;

		// Continue to the next middleware
		next();
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;