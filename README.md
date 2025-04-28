# Real-Time Chat Application with AI Assistant

A real-time chat application with an integrated AI assistant.  
Features include:
- Natural language processing capabilities for intelligent responses.
- Real-time communication using RESTful APIs and WebSocket for seamless synchronization.
- MongoDB for managing historical chat data and enabling AI-driven insights.
- Secure authentication and robust data handling to ensure system integrity and reliability.

## Using the Web Server

While you can open `index.html` locally in a browser, it is recommended to serve the pages through a web server for proper functionality.

A basic web server (`server.js`) is included in this repository. You can serve your client-side application by running:

```bash
# Navigate to your project root
~/project-me$ node server.js
```

When the web server is running, your application will be available at:

```
http://localhost:3000
```

## Installing Dependencies

The server uses ExpressJS, a popular Node.js framework for building web servers.

You can install the necessary dependencies by running:

```bash
# Option 1: Install express directly
~/project-me$ npm install express
```

Or, since `express` is already declared as a dependency in `package.json`, you can simply run:

```bash
# Option 2: Install all declared dependencies
~/project-me$ npm install
```

This will install all required modules and set up the environment for the project.


## Test Accounts

The two test users initialized in the `initUsers.mongo` script are:
- **alice** with password: `secret`
- **bob** with password: `password`

## Important Note

Before running the server, you must add your own OpenAI API key at **line 219** in `server.js` to enable the AI assistant functionality.

---
