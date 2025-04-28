// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM(elem) {
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// function sanitize(text) {
//     return text.replace(/&/g, "&amp;")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;")
//         .replace(/"/g, "&quot;")
//         .replace(/'/g, "&#039;");
// }



// Creates a DOM element from the given HTML string
function createDOM(htmlString) {
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}

// A) Define a profile object with a username property
let profile = {
    username: 'Alice' // Set the username to 'Alice'
};


class LobbyView {
    constructor(lobby) {
        // B) recive lobby object
        this.lobby = lobby;

        // create DOM element
        this.elem = createDOM(`
            <div class="content">
                <button id="ai-chat-button" class="floating-button">AI Chat</button>
                <ul class="room-list"></ul>
                <div class="page-control">
                    <input type="text" placeholder="New Room Name">
                    <button>Create New Room</button>
                </div>
            </div>
        `);

        // obtain reference to the list element
        this.listElem = this.elem.querySelector('ul.room-list');

        this.lobby.onNewRoom = (newRoom) => {
            // add new room to the list
            const roomItem = createDOM(`
                <li>
                    <img src="${newRoom.image}" alt="${newRoom.name}">
                    <a href="#/chat/${newRoom._id}">${newRoom.name}</a>
                </li>
            `);
            this.listElem.appendChild(roomItem);
        };

        this.inputElem = this.elem.querySelector('input[type="text"]');
        this.buttonElem = this.elem.querySelector('button');

        // C) use redrawList method to render the room list
        this.redrawList();


        this.buttonElem.addEventListener('click', () => {
            const roomName = this.inputElem.value.trim();
            if (roomName !== '') {
                const roomData = { name: roomName };
                Service.addRoom(roomData)
                    .then(newRoom => {
                        // up`date the lobby with the new room
                        this.lobby.addRoom(newRoom._id, newRoom.name, newRoom.image);

                        // redraw the list
                        this.redrawList();

                        // clear the input field
                        this.inputElem.value = '';
                    })
                    .catch(error => {
                        console.error('Failed to add room:', error);
                        alert('Failed to add room: ' + error.message);
                    });
            }
        });

    

        this.elem.querySelector('#ai-chat-button').addEventListener('click', () => {
            const aiRoomId = 'ai-chat-room'; // fixed AI chat room ID
            if (!this.lobby.rooms[aiRoomId]) {
                // add the AI chat room to the lobby
                this.lobby.addRoom(aiRoomId, 'AI Assistant', 'assets/chat-icon.png', []);
            }
            // navigate to the AI chat room
            window.location.hash = `#/chat/${aiRoomId}`;
        });


    }

    // C) redrawList method definition
    redrawList() {
        // clear the list element
        emptyDOM(this.listElem);

        // iterate through each room in the lobby
        for (let roomId in this.lobby.rooms) {
            const room = this.lobby.rooms[roomId];
            const roomItem = createDOM(`
                <li>
                    <img src="${room.image}" alt="${room.name}" style="width: 30px; height: 30px;" class="circle-img">
                    <a href="#/chat/${room._id}">${room.name}</a>
                </li>
            `);
            this.listElem.appendChild(roomItem);
        }
    }
}



class ChatView {
    constructor(socket) {
        this.socket = socket; // store the WebSocket client
        this.room = null; // store the current room object

        this.elem = createDOM(`
            <div class="content">
                <h4 class="room-name"></h4>
                <hr>
                <div class="message-list"></div>
                <div class="page-control">
                    <textarea id="chatInput"></textarea>
                    <button>Send</button>
                </div>
            </div>
        `);

        // obtain references to the elements
        this.titleElem = this.elem.querySelector('h4.room-name');
        this.chatElem = this.elem.querySelector('div.message-list');
        this.inputElem = this.elem.querySelector('textarea#chatInput');
        this.buttonElem = this.elem.querySelector('button');

        // add event listeners
        this.buttonElem.addEventListener('click', () => this.sendMessage());

        this.inputElem.addEventListener('keyup', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // prevent the default behavior
                this.sendMessage();
            }
        });

        this.chatElem.addEventListener('wheel', (event) => {
            // check if the room is set and the user is scrolling up
            if (event.deltaY < 0) {
                // check if the user has scrolled to the top and more messages can be loaded
                if (this.chatElem.scrollTop === 0 && this.room.canLoadConversation) {
                    // get the next conversationc
                    const result = this.room.getLastConversation.next();
                    if (result.value) {

                        result.value.then(() => {

                        });
                    }
                }
            }
        });
    }

    setRoom(room) {
        this.room = room;
        this.titleElem.textContent = room.name;

        // clear the chat element
        emptyDOM(this.chatElem);

        // add each message to the chat element
        room.messages.forEach((message) => {
            const messageBox = this.createMessageBox(message);
            this.chatElem.appendChild(messageBox);
        });

        // scroll to the bottom of the chat element
        this.chatElem.scrollTop = this.chatElem.scrollHeight;

        //set onNewMessage callback
        room.onNewMessage = (message) => {
            const messageBox = this.createMessageBox(message);
            this.chatElem.appendChild(messageBox);
            this.chatElem.scrollTop = this.chatElem.scrollHeight;
        };

        // set onFetchConversation callback
        // chatView.setRoom(room);
        room.onFetchConversation = (conversation) => {
            if (conversation && Array.isArray(conversation.messages)) {
                const previousHeight = this.chatElem.scrollHeight;

                // add each message to the chat element
                conversation.messages
                    .slice()
                    .reverse()
                    .forEach((message) => {
                        const messageBox = this.createMessageBox(message);
                        this.chatElem.insertBefore(messageBox, this.chatElem.firstChild);
                    });

                const newHeight = this.chatElem.scrollHeight;
                this.chatElem.scrollTop = newHeight - previousHeight;
            }
        };

    }


    // createMessageBox(message) {
    //     const isCurrentUser = message.username === profile.username;
    //     const messageClass = isCurrentUser ? 'message my-message' : 'message';

    //     return createDOM(`
    //         <div class="${messageClass}">
    //             <p class="message-user"><b>${message.username}</b></p>
    //             <p class="message-text">${message.text}</p>
    //         </div>
    //     `);
    // }

    createMessageBox(message) {
        const isCurrentUser = message.username === profile.username;
        const messageClass = isCurrentUser ? 'message my-message' : 'message';

        // vrreate message element
        const messageElem = document.createElement('div');
        messageElem.className = messageClass;

        // create user element
        const userElem = document.createElement('p');
        userElem.className = 'message-user';
        const userBold = document.createElement('b');
        userBold.textContent = message.username;
        userElem.appendChild(userBold);

        // create text element
        const textElem = document.createElement('p');
        textElem.className = 'message-text';
        textElem.textContent = message.text;

        // create message element
        messageElem.appendChild(userElem);
        messageElem.appendChild(textElem);

        return messageElem;
    }





    sendMessage() {
        const messageText = this.inputElem.value.trim();
        if (messageText === '') return;


        const message = {
            roomId: this.room._id,
            // username: profile.username,
            text: messageText,
        };


        // this.socket.send(JSON.stringify(message));
        if (this.room._id === 'ai-chat-room') {
            // AI chat logic
            const userMessage = { username: profile.username, text: messageText };
            this.room.addMessage(profile.username, messageText); // Add user's message

            fetch('/api/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText }),
            })
                .then(response => response.json())
                .then(data => {
                    if (data.reply) {
                        this.room.addMessage('AI Assistant', data.reply); // Add AI response
                    }
                })
                .catch(err => {
                    console.error('Error communicating with AI:', err);
                    this.room.addMessage('AI Assistant', 'Sorry, something went wrong.');
                });
        } else {
            // 普通聊天室逻辑
            const message = {
                roomId: this.room._id,
                text: messageText,
            };
            this.socket.send(JSON.stringify(message));
        }


        // this.room.addMessage(profile.username, messageText);


        this.inputElem.value = '';
    }
}


class ProfileView {
    constructor() {
        this.elem = createDOM(`
            <div class="content">
                <div class="profile-form">
                    <div class="form-field">
                        <label for="username">Username</label>
                        <input type="text" id="username" name="username">
                    </div>
                    <hr>
                    <div class="form-field">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password">
                    </div>
                    <hr>
                    <div class="form-field">
                        <label for="profile-picture">Profile Picture</label>
                        <img src="./assets/profile-icon.png" alt="Profile Icon"
                            style="width: 30px; height: 30px; border-radius: 50%;">
                        <input type="file" id="profile-picture" name="profile-picture">
                    </div>
                    <hr>
                    <div class="form-field">
                        <label for="information">About</label>
                        <textarea rows="8" cols="50" placeholder="Enter your text here" id="information"></textarea>
                    </div>
                </div>
                <div class="page-control">
                    <button>Save</button>
                </div>
            </div>
        `);
    }
}

// A) Room class definition
class Room {
    constructor(id, name, image = 'assets/everyone-icon.png', messages = []) {
        this._id = id;
        this.name = name;
        this.image = image;
        this.messages = messages;
        this.onNewMessage = null; // used to notify new messages
        this.onFetchConversation = null; // used to notify new conversations
        this.canLoadConversation = true; // indicates if more conversations can be loaded
        this.getLastConversation = makeConversationLoader(this); // generator function to load conversations
        this.createdAt = Date.now(); // store the creation time
    }

    addMessage(username, text) {
        if (text.trim() === '') return;  // ignore empty messages

        const message = { username, text };
        this.messages.push(message);  // add the new message to the list

        // B) if onNewMessage is defined, call it
        if (this.onNewMessage) {
            this.onNewMessage(message); // send the new message to the event handler
        }
    }


    addConversation(conversation) {
        if (conversation && Array.isArray(conversation.messages)) {
            // check if the conversation has new messages
            const newMessages = conversation.messages.filter(msg =>
                !this.messages.some(existingMsg => existingMsg.timestamp === msg.timestamp)
            );

            // add the new messages to the beginning of the list
            this.messages = newMessages.concat(this.messages);

            // inform the event handler about the new conversation
            if (this.onFetchConversation) {
                this.onFetchConversation(conversation);
            }
        }
    }
}


// C) Lobby class definition
class Lobby {
    constructor() {
        // Initialize rooms with four rooms
        this.rooms = {};
    }

    // D) getRoom method
    getRoom(roomId) {
        return this.rooms[roomId]; // return the room with the given id
    }

    // E) addRoom method
    addRoom(id, name, image, messages = []) {
        const newRoom = new Room(id, name, image, messages);
        this.rooms[id] = newRoom;


        if (this.onNewRoom) {
            this.onNewRoom(newRoom);
        }
    }
}



////////////////////////////////////////////////////////////////
//                       Assignment 3                         //
////////////////////////////////////////////////////////////////

// Global scope object named 'Service'
const Service = {
    // Store the origin of the server (same format as window.location.origin)
    origin: window.location.origin,

    getLastConversation(roomId, before) {
        const url = `/chat/${encodeURIComponent(roomId)}/messages`;
        const params = before ? `?before=${encodeURIComponent(before)}` : '';
        return fetch(url + params, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else if (response.status === 404) {
                    // return null if the room or conversation is not found
                    return null;
                } else {
                    throw new Error('Failed to fetch conversation');
                }
            })
            .catch(err => {
                console.error('Error fetching conversation:', err);
                return null; // return null if an error occurs
            });
    },

    getProfile: function () {
        // if the username is already cached, return it
        if (this.username) {
            return Promise.resolve({ username: this.username });
        }

        // else, fetch the profile from the server
        return fetch('/profile')
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else if (response.status === 401) {
                    // redirect to the login page if the user is not authenticated
                    window.location.href = '/login';
                    return Promise.reject(new Error('Unauthorized'));
                } else {
                    throw new Error('Failed to fetch profile');
                }
            })
            .then(profile => {
                this.username = profile.username; // cache the username
                return profile; // return the profile object
            })
            .catch(err => {
                console.error('Error fetching profile:', err);
                throw err; // re-throw the error
            });
    }

};


Service.getAllRooms = function () {
    const url = `${Service.origin}/chat`;

    return fetch(url)
        .then(response => {
            if (!response.ok) {
                // deal with server errors
                return response.text().then(text => {
                    let errorMessage = 'Server Error';
                    try {
                        const err = JSON.parse(text);
                        errorMessage = err.message || err.error || JSON.stringify(err);
                    } catch (e) {
                        // if it cannot be parsed as JSON, use the text as the error message
                        errorMessage = text || 'Server Error';
                    }
                    throw new Error(errorMessage);
                });
            }
            return response.json();
        });
};





Service.addRoom = function (data) {
    const url = `${Service.origin}/chat`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => {
            if (!response.ok) {
                // make sure to handle server errors
                return response.text().then(text => {
                    let errorMessage = 'Server Error';
                    try {
                        const err = JSON.parse(text);
                        errorMessage = err.message || err.error || JSON.stringify(err);
                    } catch (e) {
                        // if it cannot be parsed as JSON, use the text as the error message
                        errorMessage = text || 'Server Error';
                    }
                    throw new Error(errorMessage);
                });
            }
            return response.json();
        });
};



function* makeConversationLoader(room) {
    // Initialize lastTimestamp to the latest message timestamp or room creation time
    let lastTimestamp = room.messages.length > 0 ? room.messages[0].timestamp : room.createdAt;

    while (room.canLoadConversation) {
        // keep track of the loading status
        room.canLoadConversation = false;

        const promise = Service.getLastConversation(room._id, lastTimestamp)
            .then(conversation => {
                if (conversation) {
                    // update the last timestamp
                    lastTimestamp = conversation.timestamp;

                    // add the conversation to the room
                    room.addConversation(conversation);

                    // allow loading more conversations
                    room.canLoadConversation = true;
                    return conversation;
                } else {
                    // stop loading if no more conversations are available
                    room.canLoadConversation = false;
                    return null;
                }
            })
            .catch(err => {
                console.error('Failed to load conversation:', err);

                // stop loading if an error occurs
                room.canLoadConversation = true;
                return null;
            });

        yield promise;

        // wait for the next iteration
        if (!room.canLoadConversation) {
            return;
        }
    }
}





////////////////////////////////////////////////////////////////

// Define a function named main in the global scope
function main() {
    // Create instances of Lobby, LobbyView, ProfileView
    const lobby = new Lobby();
    const lobbyView = new LobbyView(lobby);
    const profileView = new ProfileView();


    // Create a WebSocket client and connect to the server
    const socket = new WebSocket('ws://localhost:8000'); // Adjust the URL if needed


    // Handle WebSocket connection errors (optional)
    socket.onerror = function (error) {
        console.error('WebSocket Error:', error);
    };

    Service.getProfile()
        .then(userProfile => {
            profile.username = userProfile.username;

            // Create instances of ChatView
            const lobby = new Lobby();
            const lobbyView = new LobbyView(lobby);
            const profileView = new ProfileView();
            const chatView = new ChatView(socket);

            // Handle WebSocket connection errors (optional)
            socket.addEventListener('message', (event) => {
                try {
                    // attempt to parse the incoming message
                    const msgData = JSON.parse(event.data);
                    const { roomId, username, text } = msgData;

                    // obtain the room object
                    const room = lobby.getRoom(roomId);
                    if (room) {
                        // add the message to the room
                        room.addMessage(username, text);
                    } else {
                        console.error(`Room with ID ${roomId} not found.`);
                    }
                } catch (err) {
                    console.error('Failed to process incoming message:', err);
                }
            });

            // Render the current route based on the URL hash
            function renderRoute() {
                const pageView = document.getElementById('page-view');
                const hash = window.location.hash;

                // clear the page view
                if (pageView && pageView.children.length > 0) {
                    emptyDOM(pageView);
                }

                if (hash === '' || hash === '#/index') {
                    // show the lobby view
                    pageView.appendChild(lobbyView.elem);
                } else if (hash.startsWith('#/chat')) {
                    // get the room ID from the URL hash
                    const roomId = hash.split('/')[2];
                    const room = lobby.getRoom(roomId);

                    if (room) {
                        // show the chat view
                        chatView.setRoom(room);
                        pageView.appendChild(chatView.elem);
                    } else {
                        // show a message if the room is not found
                        pageView.appendChild(createDOM('<p>Room not found</p>'));
                    }
                } else if (hash === '#/profile') {
                    // show the profile view
                    pageView.appendChild(profileView.elem);
                }
            }

            // refresh the lobby every 5 seconds
            function refreshLobby() {
                return Service.getAllRooms()
                    .then(roomArray => {
                        roomArray.forEach(roomData => {
                            const { _id, name, image, messages } = roomData;

                            if (lobby.rooms[_id]) {
                                // update the existing room
                                lobby.rooms[_id].name = name;
                                lobby.rooms[_id].image = image;
                                lobby.rooms[_id].messages = messages;
                                lobby.rooms[_id].messages = (messages || []).sort((a, b) => a.timestamp - b.timestamp);
                            } else {
                                // add a new room to the lobby
                                const sortedMessages = (messages || []).sort((a, b) => a.timestamp - b.timestamp);
                                lobby.addRoom(_id, name, image, messages);
                            }
                        });


                        console.log('Updated Lobby Rooms:', lobby.rooms);
                        lobbyView.redrawList(); // redraw the room list
                    })
                    .catch(error => {
                        console.error('Failed to refresh lobby:', error);
                    });
            }

            // Render the initial route
            refreshLobby().then(() => renderRoute());

            // Refresh the lobby every 5 seconds
            setInterval(refreshLobby, 5000);

            // Listen for hash changes and render the route
            window.addEventListener('hashchange', renderRoute);

            // Export the functions to the global scope
            cpen322.export(arguments.callee, {
                renderRoute,
                lobbyView,
                chatView,
                profileView,
                lobby,
                socket,
                refreshLobby,
                Service,
                socket,
            });
            cpen322.setDefault("webSocketServer", "ws://localhost:8000");
            cpen322.setDefault("image", "assets/everyone-icon.png");

            cpen322.setDefault("testRoomId", "room-1");
            cpen322.setDefault("cookieName", "cpen322-session");
            cpen322.setDefault("testUser1", { username: 'alice', password: 'secret', saltedHash: '1htYvJoddV8mLxq3h7C26/RH2NPMeTDxHIxWn49M/G0wxqh/7Y3cM+kB1Wdjr4I=' });
            cpen322.setDefault("testUser2", { username: 'bob', password: 'password', saltedHash: 'MIYB5u3dFYipaBtCYd9fyhhanQkuW4RkoRTUDLYtwd/IjQvYBgMHL+eoZi3Rzhw=' });
        })
        .catch(err => {
            console.error('Failed to fetch profile:', err);
            // redirect to the login page if the profile cannot be fetched
            window.location.href = '/login';
        });
}


// Call the main function when the page is loaded
window.addEventListener('load', main);