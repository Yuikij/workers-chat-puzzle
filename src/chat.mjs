/**
 * Edge Chat Demo Worker with Turtle Soup Game Features
 * Built using Cloudflare Workers Durable Objects
 * 
 * Features:
 * - Real-time chat rooms
 * - Turtle Soup game mode with turn-based gameplay
 * - AI Host mode with LLM integration
 * - Rate limiting and user management
 */

import { createAIHost } from './lib/ai-host.mjs';
import { PuzzleManager } from './lib/puzzle-manager.mjs';
import { safeJsonParse, safeJsonStringify, safeString, generateId, createErrorResponse } from './lib/utils.mjs';
import HTML from "./chat.html";

// `handleErrors()` is a little utility function that can wrap an HTTP request handler in a
// try/catch and return errors to the client. You probably wouldn't want to use this in production
// code but it is convenient when debugging and iterating.
async function handleErrors(request, func) {
  try {
    return await func();
  } catch (err) {
    if (request.headers.get("Upgrade") == "websocket") {
      // Annoyingly, if we return an HTTP error in response to a WebSocket request, Chrome devtools
      // won't show us the response body! So... let's send a WebSocket response with an error
      // frame instead.
      let pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({error: err.stack}));
      pair[1].close(1011, "Uncaught exception during session setup");
      return new Response(null, { status: 101, webSocket: pair[0] });
    } else {
      return new Response(err.stack, {status: 500});
    }
  }
}

// In modules-syntax workers, we use `export default` to export our script's main event handlers.
// Here, we export one handler, `fetch`, for receiving HTTP requests. In pre-modules workers, the
// fetch handler was registered using `addEventHandler("fetch", event => { ... })`; this is just
// new syntax for essentially the same thing.
//
// `fetch` isn't the only handler. If your worker runs on a Cron schedule, it will receive calls
// to a handler named `scheduled`, which should be exported here in a similar way. We will be
// adding other handlers for other types of events over time.
export default {
  async fetch(request, env) {
    return await handleErrors(request, async () => {
      // We have received an HTTP request! Parse the URL and route the request.

      let url = new URL(request.url);
      let path = url.pathname.slice(1).split('/');

      if (!path[0]) {
        // Serve our HTML at the root path.
        return new Response(HTML, {headers: {"Content-Type": "text/html;charset=UTF-8"}});
      }

      switch (path[0]) {
        case "api":
          // This is a request for `/api/...`, call the API handler.
          return handleApiRequest(path.slice(1), request, env);

        default:
          return new Response("Not found", {status: 404});
      }
    });
  }
}


async function handleApiRequest(path, request, env) {
  // We've received at API request. Route the request based on the path.

  switch (path[0]) {
    case "room": {
      // Request for `/api/room/...`.

      if (!path[1]) {
        // The request is for just "/api/room", with no ID.
        if (request.method == "POST") {
          // POST to /api/room creates a private room.
          //
          // Incidentally, this code doesn't actually store anything. It just generates a valid
          // unique ID for this namespace. Each durable object namespace has its own ID space, but
          // IDs from one namespace are not valid for any other.
          //
          // The IDs returned by `newUniqueId()` are unguessable, so are a valid way to implement
          // "anyone with the link can access" sharing. Additionally, IDs generated this way have
          // a performance benefit over IDs generated from names: When a unique ID is generated,
          // the system knows it is unique without having to communicate with the rest of the
          // world -- i.e., there is no way that someone in the UK and someone in New Zealand
          // could coincidentally create the same ID at the same time, because unique IDs are,
          // well, unique!
          let id = env.rooms.newUniqueId();
          return new Response(id.toString(), {headers: {"Access-Control-Allow-Origin": "*"}});
        } else {
          // If we wanted to support returning a list of public rooms, this might be a place to do
          // it. The list of room names might be a good thing to store in KV, though a singleton
          // Durable Object is also a possibility as long as the Cache API is used to cache reads.
          // (A caching layer would be needed because a single Durable Object is single-threaded,
          // so the amount of traffic it can handle is limited. Also, caching would improve latency
          // for users who don't happen to be located close to the singleton.)
          //
          // For this demo, though, we're not implementing a public room list, mainly because
          // inevitably some trolls would probably register a bunch of offensive room names. Sigh.
          return new Response("Method not allowed", {status: 405});
        }
      }

      // OK, the request is for `/api/room/<name>/...`. It's time to route to the Durable Object
      // for the specific room.
      let name = path[1];

      // Each Durable Object has a 256-bit unique ID. IDs can be derived from string names, or
      // chosen randomly by the system.
      let id;
      if (name.match(/^[0-9a-f]{64}$/)) {
        // The name is 64 hex digits, so let's assume it actually just encodes an ID. We use this
        // for private rooms. `idFromString()` simply parses the text as a hex encoding of the raw
        // ID (and verifies that this is a valid ID for this namespace).
        id = env.rooms.idFromString(name);
      } else if (name.length <= 32) {
        // Treat as a string room name (limited to 32 characters). `idFromName()` consistently
        // derives an ID from a string.
        id = env.rooms.idFromName(name);
      } else {
        return new Response("Name too long", {status: 404});
      }

      // Get the Durable Object stub for this room! The stub is a client object that can be used
      // to send messages to the remote Durable Object instance. The stub is returned immediately;
      // there is no need to await it. This is important because you would not want to wait for
      // a network round trip before you could start sending requests. Since Durable Objects are
      // created on-demand when the ID is first used, there's nothing to wait for anyway; we know
      // an object will be available somewhere to receive our requests.
      let roomObject = env.rooms.get(id);

      // Compute a new URL with `/api/room/<name>` removed. We'll forward the rest of the path
      // to the Durable Object.
      let newUrl = new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join("/");

      // Send the request to the object. The `fetch()` method of a Durable Object stub has the
      // same signature as the global `fetch()` function, but the request is always sent to the
      // object, regardless of the request's URL.
      return roomObject.fetch(newUrl, request);
    }

    default:
      return new Response("Not found", {status: 404});
  }
}

// =======================================================================================
// The ChatRoom Durable Object Class

// ChatRoom implements a Durable Object that coordinates an individual chat room. Participants
// connect to the room using WebSockets, and the room broadcasts messages from each participant
// to all others.
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    // Initialize core properties
    this.sessions = new Map();
    this.lastTimestamp = 0;
    
    // Initialize game states (will be done async in first fetch call)
    this.gameStateInitialized = false;
    
    // Restore WebSocket sessions from hibernation
    this.restoreWebSocketSessions();
  }

  /**
   * Initialize all game state variables
   */
  async initializeGameStates() {
    // Try to restore game state from storage first
    await this.restoreGameState();
    
    // Initialize puzzle manager
    this.puzzleManager = new PuzzleManager();
  }

  /**
   * Restore game state from storage
   */
  async restoreGameState() {
    try {
      const gameState = await this.storage.get('gameState');
      if (gameState) {
        const state = JSON.parse(gameState);
        console.log('[ChatRoom] Restoring game state:', state);
        
        // Restore turtle soup state
        this.turtleSoupActive = state.turtleSoupActive || false;
        this.turtleSoupParticipants = state.turtleSoupParticipants || [];
        this.turtleSoupInitiator = state.turtleSoupInitiator || null;
        this.currentTurnIndex = state.currentTurnIndex || 0;
        this.currentPuzzle = state.currentPuzzle || null;
        
        // Restore AI host state
        this.aiHostActive = state.aiHostActive || false;
        this.aiHostInitiator = state.aiHostInitiator || null;
        this.aiHostParticipants = state.aiHostParticipants || [];
        
        // Restore user scores
        this.userScores = new Map(state.userScores || []);
        this.pendingConfirmations = new Map();
        
        // If AI host was active, need to recreate AI host instance
        if (this.aiHostActive && state.aiHostData) {
          this.aiHost = createAIHost(this.env);
          // Note: May need to restore AI host internal state if needed
        }
        
        console.log('[ChatRoom] Game state restored successfully');
      } else {
        // Initialize default state
        this.initializeDefaultGameState();
      }
    } catch (error) {
      console.error('[ChatRoom] Failed to restore game state:', error);
      this.initializeDefaultGameState();
    }
  }

  /**
   * Initialize default game state
   */
  initializeDefaultGameState() {
    // Turtle Soup state management
    this.turtleSoupActive = false;
    this.turtleSoupParticipants = [];
    this.turtleSoupInitiator = null;
    this.currentTurnIndex = 0;
    this.pendingConfirmations = new Map();
    this.userScores = new Map();
    this.currentPuzzle = null;
    
    // AI Host state management
    this.aiHostActive = false;
    this.aiHostInitiator = null;
    this.aiHostParticipants = [];
    this.aiHost = null;
  }

  /**
   * Save current game state to storage
   */
  async saveGameState() {
    try {
      const gameState = {
        turtleSoupActive: this.turtleSoupActive,
        turtleSoupParticipants: this.turtleSoupParticipants,
        turtleSoupInitiator: this.turtleSoupInitiator,
        currentTurnIndex: this.currentTurnIndex,
        currentPuzzle: this.currentPuzzle,
        aiHostActive: this.aiHostActive,
        aiHostInitiator: this.aiHostInitiator,
        aiHostParticipants: this.aiHostParticipants,
        userScores: Array.from(this.userScores.entries()),
        timestamp: Date.now()
      };
      
      await this.storage.put('gameState', JSON.stringify(gameState));
      console.log('[ChatRoom] Game state saved');
    } catch (error) {
      console.error('[ChatRoom] Failed to save game state:', error);
    }
  }

  /**
   * Restore WebSocket sessions from hibernation
   */
  restoreWebSocketSessions() {
    this.state.getWebSockets().forEach((webSocket) => {
      try {
        const meta = webSocket.deserializeAttachment() || {};
        
        if (meta.limiterId) {
          const limiterId = this.env.limiters.idFromString(meta.limiterId);
          const limiter = new RateLimiterClient(
            () => this.env.limiters.get(limiterId),
            err => webSocket.close(1011, err.stack)
          );
          
          this.sessions.set(webSocket, { 
            ...meta, 
            limiter, 
            blockedMessages: [] 
          });
        }
      } catch (error) {
        console.error('[ChatRoom] Failed to restore WebSocket session:', error);
        webSocket.close(1011, 'Session restoration failed');
      }
    });
  }

  // The system will call fetch() whenever an HTTP request is sent to this Object. Such requests
  // can only be sent from other Worker code, such as the code above; these requests don't come
  // directly from the internet. In the future, we will support other formats than HTTP for these
  // communications, but we started with HTTP for its familiarity.
  async fetch(request) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);

      switch (url.pathname) {
        case "/websocket": {
          // The request is to `/api/room/<name>/websocket`. A client is trying to establish a new
          // WebSocket session.
          if (request.headers.get("Upgrade") != "websocket") {
            return new Response("expected websocket", {status: 400});
          }

          // Get the client's IP address for use with the rate limiter.
          let ip = request.headers.get("CF-Connecting-IP");

          // To accept the WebSocket request, we create a WebSocketPair (which is like a socketpair,
          // i.e. two WebSockets that talk to each other), we return one end of the pair in the
          // response, and we operate on the other end. Note that this API is not part of the
          // Fetch API standard; unfortunately, the Fetch API / Service Workers specs do not define
          // any way to act as a WebSocket server today.
          let pair = new WebSocketPair();

          // We're going to take pair[1] as our end, and return pair[0] to the client.
          await this.handleSession(pair[1], ip);

          // Now we return the other end of the pair to the client.
          return new Response(null, { status: 101, webSocket: pair[0] });
        }

        default:
          return new Response("Not found", {status: 404});
      }
    });
  }

  // handleSession() implements our WebSocket-based chat protocol.
  async handleSession(webSocket, ip) {
    // Ensure game state is initialized before handling any sessions
    if (!this.gameStateInitialized) {
      await this.initializeGameStates();
      this.gameStateInitialized = true;
    }

    // Accept our end of the WebSocket. This tells the runtime that we'll be terminating the
    // WebSocket in JavaScript, not sending it elsewhere.
    this.state.acceptWebSocket(webSocket);

    // Set up our rate limiter client.
    let limiterId = this.env.limiters.idFromName(ip);
    let limiter = new RateLimiterClient(
        () => this.env.limiters.get(limiterId),
        err => webSocket.close(1011, err.stack));

    // Create our session and add it to the sessions map.
    let session = { limiterId, limiter, blockedMessages: [] };
    // attach limiterId to the webSocket so it survives hibernation
    webSocket.serializeAttachment({ ...webSocket.deserializeAttachment(), limiterId: limiterId.toString() });
    this.sessions.set(webSocket, session);

    // Queue "join" messages for all online users, to populate the client's roster.
    for (let otherSession of this.sessions.values()) {
      if (otherSession.name) {
        session.blockedMessages.push(JSON.stringify({joined: otherSession.name}));
      }
    }

    // Load the last 100 messages from the chat history stored on disk, and send them to the
    // client.
    let storage = await this.storage.list({reverse: true, limit: 100});
    let backlog = [...storage.values()];
    backlog.reverse();
    backlog.forEach(value => {
      session.blockedMessages.push(value);
    });
  }

  async webSocketMessage(webSocket, msg) {
    try {
      const session = this.sessions.get(webSocket);
      
      // Validate session state
      if (!session) {
        console.warn('[ChatRoom] Message received for unknown session');
        webSocket.close(1011, 'Session not found');
        return;
      }

      if (session.quit) {
        console.log('[ChatRoom] Session marked as quit, closing WebSocket');
        webSocket.close(1011, 'WebSocket broken');
        return;
      }

      // Check rate limiting
      if (!session.limiter.checkLimit()) {
        this.sendError(webSocket, 'Your IP is being rate-limited, please try again later.');
        return;
      }

      // Parse message safely
      const data = safeJsonParse(msg);
      if (!data) {
        this.sendError(webSocket, 'Invalid message format');
        return;
      }

      console.log(`[ChatRoom] Message from ${session.name || 'anonymous'}:`, data);

      // Handle initial user setup
      if (!session.name) {
        return await this.handleUserSetup(webSocket, session, data);
      }

      // Handle special message types
      if (await this.handleSpecialMessages(session, data)) {
        return;
      }

      // Handle regular chat messages
      await this.handleChatMessage(webSocket, session, data);

    } catch (err) {
      console.error('[ChatRoom] WebSocket message error:', err);
      this.sendError(webSocket, 'Internal server error');
    }
  }

  /**
   * Handle user setup (first message with name)
   */
  async handleUserSetup(webSocket, session, data) {
    const userName = safeString(data.name || 'anonymous', 32);
    
    if (userName.length > 32) {
      this.sendError(webSocket, 'Name too long');
      webSocket.close(1009, 'Name too long');
      return;
    }

    session.name = userName;
    webSocket.serializeAttachment({ 
      ...webSocket.deserializeAttachment(), 
      name: session.name 
    });

    // Send queued messages
    session.blockedMessages.forEach(queued => {
      webSocket.send(queued);
    });
    delete session.blockedMessages;

    // Notify others of user join
    this.broadcast({ joined: session.name });
    
    // Send current game state if requested
    if (data.requestGameState && (this.turtleSoupActive || this.aiHostActive)) {
      const currentGameState = {
        gameStateSync: true,
        turtleSoupActive: this.turtleSoupActive,
        turtleSoupParticipants: this.turtleSoupParticipants,
        turtleSoupInitiator: this.turtleSoupInitiator,
        currentTurnIndex: this.currentTurnIndex,
        aiHostActive: this.aiHostActive,
        aiHostInitiator: this.aiHostInitiator,
        aiHostParticipants: this.aiHostParticipants,
        currentPuzzle: this.currentPuzzle
      };
      
      console.log(`[ChatRoom] Sending game state sync to ${userName}:`, currentGameState);
      webSocket.send(safeJsonStringify(currentGameState));
    }
    
    webSocket.send(safeJsonStringify({ ready: true }));
  }

  /**
   * Handle special message types (turtle soup, AI host, etc.)
   */
  async handleSpecialMessages(session, data) {
    const handlers = {
      turtleSoupRequest: () => this.handleTurtleSoupRequest(session, data),
      turtleSoupConfirm: () => this.handleTurtleSoupConfirmation(session, data),
      turtleSoupTurnChange: () => this.handleTurtleSoupTurnChange(session, data),
      turtleSoupEnd: () => this.handleTurtleSoupEnd(session, data),
      turtleSoupPuzzleSelected: () => this.handleTurtleSoupPuzzleSelected(session, data),
      aiHostRequest: () => this.handleAIHostRequest(session, data),
      aiHostEnd: () => this.handleAIHostEnd(session, data)
    };

    for (const [type, handler] of Object.entries(handlers)) {
      if (data[type]) {
        await handler();
        return true;
      }
    }
    
    return false;
  }

  /**
   * Handle regular chat messages
   */
  async handleChatMessage(webSocket, session, data) {
    // Validate message
    const message = safeString(data.message, 256);
    if (message.length > 256) {
      this.sendError(webSocket, 'Message too long');
      return;
    }

    // Prepare message data
    const messageData = {
      name: session.name,
      message: message,
      timestamp: Math.max(Date.now(), this.lastTimestamp + 1),
      turtleSoupMessage: !!data.turtleSoupMessage,
      aiHostQuestion: !!data.aiHostQuestion
    };
    this.lastTimestamp = messageData.timestamp;

    // Handle turtle soup with AI host mode
    if (messageData.turtleSoupMessage && messageData.aiHostQuestion && this.turtleSoupActive && this.aiHostActive) {
      console.log(`[TurtleSoup-AI] Processing AI question from ${session.name}: "${message}"`);
      await this.handleTurtleSoupAIMessage(session, messageData);
      return;
    }

    // Handle AI host mode (standalone)
    if (this.aiHostActive && !messageData.turtleSoupMessage) {
      console.log(`[AI Host] Processing question from ${session.name}: "${message}"`);
      await this.processAIHostQuestion(session.name, message);
      return;
    }

    // Handle turtle soup mode (without AI)
    if (messageData.turtleSoupMessage && this.turtleSoupActive && !this.aiHostActive) {
      await this.handleTurtleSoupMessage(session, messageData);
    }

    // Broadcast and save message
    const messageStr = safeJsonStringify(messageData);
    this.broadcast(messageStr);
    
    const key = new Date(messageData.timestamp).toISOString();
    await this.storage.put(key, messageStr);
  }

  /**
   * Handle turtle soup game message
   */
  async handleTurtleSoupMessage(session, messageData) {
    const currentPlayer = this.turtleSoupParticipants[this.currentTurnIndex];
    
    if (currentPlayer !== session.name) {
      console.log(`[TurtleSoup] Wrong user's turn: ${session.name} vs ${currentPlayer}`);
      return;
    }

    console.log(`[TurtleSoup] Processing turn for ${session.name}`);
    
    // Generate AI response and update scores
    const aiResponse = this.generateAIResponse(messageData.message);
    this.updateUserScore(session.name, aiResponse.score);
    
    // Advance turn
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turtleSoupParticipants.length;
    
    // Schedule AI response and turn change
    this.scheduleAIResponse(aiResponse);
  }

  /**
   * Schedule AI response and turn change
   */
  scheduleAIResponse(aiResponse) {
    setTimeout(() => {
      this.broadcast({
        name: "🤖 AI主持人",
        message: aiResponse.formatted,
        timestamp: Math.max(Date.now(), this.lastTimestamp + 1),
        aiResponse: true
      });
      
      this.lastTimestamp = Math.max(Date.now(), this.lastTimestamp + 1);
      
      setTimeout(() => {
        this.broadcast({
          turtleSoupTurnChange: true,
          turnIndex: this.currentTurnIndex,
          nextPlayer: this.turtleSoupParticipants[this.currentTurnIndex],
          userScores: Object.fromEntries(this.userScores)
        });
      }, 500);
    }, 1000);
  }

  /**
   * Update user score
   */
  updateUserScore(userName, score) {
    if (!this.userScores.has(userName)) {
      this.userScores.set(userName, { totalScore: 0, questionCount: 0 });
    }
    const userScore = this.userScores.get(userName);
    userScore.totalScore += score;
    userScore.questionCount += 1;
  }

  /**
   * Send error message to WebSocket
   */
  sendError(webSocket, message) {
    try {
      webSocket.send(safeJsonStringify({ error: message }));
    } catch (err) {
      console.error('[ChatRoom] Failed to send error message:', err);
    }
  }

  // On "close" and "error" events, remove the WebSocket from the sessions list and broadcast
  // a quit message.
  async closeOrErrorHandler(webSocket) {
    let session = this.sessions.get(webSocket) || {};
    session.quit = true;
    this.sessions.delete(webSocket);
    if (session.name) {
      this.broadcast({quit: session.name});
    }
  }

  async webSocketClose(webSocket, code, reason, wasClean) {
    this.closeOrErrorHandler(webSocket)
  }

  async webSocketError(webSocket, error) {
    this.closeOrErrorHandler(webSocket)
  }

  // broadcast() broadcasts a message to all clients.
  broadcast(message) {
    // Apply JSON if we weren't given a string to start with.
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    // Iterate over all the sessions sending them messages.
    let quitters = [];
    this.sessions.forEach((session, webSocket) => {
      if (session.name) {
        try {
          webSocket.send(message);
        } catch (err) {
          // Whoops, this connection is dead. Remove it from the map and arrange to notify
          // everyone below.
          session.quit = true;
          quitters.push(session);
          this.sessions.delete(webSocket);
        }
      } else {
        // This session hasn't sent the initial user info message yet, so we're not sending them
        // messages yet (no secret lurking!). Queue the message to be sent later.
        session.blockedMessages.push(message);
      }
    });

    quitters.forEach(quitter => {
      if (quitter.name) {
        this.broadcast({quit: quitter.name});
      }
    });
  }

  // Turtle Soup related methods
  handleTurtleSoupRequest(session, data) {
    console.log(`[TurtleSoup] Request from ${data.initiator}, participants:`, data.participants);
    
    if (this.turtleSoupActive) {
      console.log(`[TurtleSoup] Request rejected - already active`);
      this.sendErrorToSession(session, "海龟汤已经进行中");
      return;
    }

    // Check if there's already a pending request from this initiator
    if (this.pendingConfirmations.has(data.initiator)) {
      console.log(`[TurtleSoup] Duplicate request from ${data.initiator}, ignoring`);
      return;
    }

    // Get current online users (authoritative server list) and deduplicate
    const onlineUsersSet = new Set();
    this.sessions.forEach((session) => {
      if (session.name) {
        onlineUsersSet.add(session.name);
      }
    });
    const onlineUsers = Array.from(onlineUsersSet);
    console.log(`[TurtleSoup] Current online users (deduplicated):`, onlineUsers);
    console.log(`[TurtleSoup] Client provided participants:`, data.participants);

    // Use server's authoritative list, not client's
    const actualParticipants = onlineUsers;

    // Initialize pending confirmations for this initiator BEFORE broadcasting
    // Store both confirmed users and the original participant list
    this.pendingConfirmations.set(data.initiator, {
      confirmedUsers: new Set(),
      originalParticipants: actualParticipants
    });
    console.log(`[TurtleSoup] Initialized confirmations for ${data.initiator} with participants:`, actualParticipants);

    // Broadcast the request to all participants except the initiator
    this.broadcast({
      turtleSoupRequest: true,
      initiator: data.initiator,
      participants: actualParticipants
    });
    
    // Set timeout for confirmation process
    setTimeout(() => {
      if (this.pendingConfirmations.has(data.initiator)) {
        console.log(`[TurtleSoup] Request timeout for ${data.initiator}`);
        this.pendingConfirmations.delete(data.initiator);
        this.broadcast({
          error: "海龟汤发起超时"
        });
      }
    }, 30000);
  }

  async handleTurtleSoupConfirmation(session, data) {
    console.log(`[TurtleSoup] Confirmation from ${data.user} for ${data.initiator}: ${data.confirmed}`);
    
    if (!this.pendingConfirmations.has(data.initiator)) {
      console.log(`[TurtleSoup] No pending confirmations for ${data.initiator}`);
      return; // Request expired or invalid
    }

    const confirmationData = this.pendingConfirmations.get(data.initiator);
    const confirmedUsers = confirmationData.confirmedUsers;
    const originalParticipants = confirmationData.originalParticipants;
    
    if (!data.confirmed) {
      // Someone rejected, cancel the whole thing
      console.log(`[TurtleSoup] ${data.user} rejected, canceling`);
      this.pendingConfirmations.delete(data.initiator);
      this.broadcast({
        turtleSoupConfirm: true,
        initiator: data.initiator,
        confirmed: false,
        user: data.user
      });
      return;
    }

    // Check if user already confirmed (prevent duplicate confirmations)
    if (confirmedUsers.has(data.user)) {
      console.log(`[TurtleSoup] ${data.user} already confirmed, ignoring`);
      return;
    }

    // Add to confirmed users
    confirmedUsers.add(data.user);
    console.log(`[TurtleSoup] ${data.user} confirmed. Total confirmations:`, confirmedUsers.size);
    
    // Broadcast the confirmation
    this.broadcast({
      turtleSoupConfirm: true,
      initiator: data.initiator,
      confirmed: true,
      user: data.user
    });

    // Check if all users have confirmed (exclude the initiator from count)
    // Use the original participant list from when the request was made
    const requiredConfirmations = originalParticipants.filter(user => user !== data.initiator);
    console.log(`[TurtleSoup] Original participants:`, originalParticipants);
    console.log(`[TurtleSoup] Required confirmations:`, requiredConfirmations);
    console.log(`[TurtleSoup] Confirmed users:`, Array.from(confirmedUsers));
    console.log(`[TurtleSoup] Confirmation check: ${confirmedUsers.size}/${requiredConfirmations.length}`);
    
    if (confirmedUsers.size === requiredConfirmations.length) {
      // All users confirmed, start the turtle soup
      console.log(`[TurtleSoup] All users confirmed, starting turtle soup`);
      await this.startTurtleSoup(data.initiator, originalParticipants);
      this.pendingConfirmations.delete(data.initiator);
    } else {
      console.log(`[TurtleSoup] Still waiting for confirmations: ${confirmedUsers.size}/${requiredConfirmations.length}`);
    }
  }

  async startTurtleSoup(initiator, participants) {
    console.log(`[TurtleSoup] Starting turtle soup with initiator: ${initiator}, participants:`, participants);
    
    this.turtleSoupActive = true;
    this.turtleSoupInitiator = initiator;
    this.turtleSoupParticipants = participants;
    this.currentTurnIndex = 0;
    
    // Initialize user scores
    this.userScores.clear();
    participants.forEach(participant => {
      this.userScores.set(participant, { totalScore: 0, questionCount: 0 });
    });

    // Save game state
    await this.saveGameState();

    // Broadcast start message
    this.broadcast({
      turtleSoupStart: true,
      initiator: initiator,
      participants: participants
    });
    
    console.log(`[TurtleSoup] Turtle soup started successfully`);
  }

  handleTurtleSoupTurnChange(session, data) {
    if (!this.turtleSoupActive || session.name !== this.turtleSoupInitiator) {
      return; // Only initiator can manage turn changes
    }

    this.currentTurnIndex = data.turnIndex;
    
    // Broadcast turn change
    this.broadcast({
      turtleSoupTurnChange: true,
      turnIndex: data.turnIndex,
      nextPlayer: data.nextPlayer
    });
  }

  async handleTurtleSoupEnd(session, data) {
    if (!this.turtleSoupActive || session.name !== this.turtleSoupInitiator) {
      return; // Only initiator can end
    }

    await this.endTurtleSoup();
  }

  async endTurtleSoup() {
    this.turtleSoupActive = false;
    this.turtleSoupParticipants = [];
    this.turtleSoupInitiator = null;
    this.currentTurnIndex = 0;
    this.userScores.clear(); // Clear scores when game ends

    // Also end AI host mode if active
    if (this.aiHostActive) {
      await this.endAIHostMode();
    }

    // Save game state
    await this.saveGameState();

    // Broadcast end message
    this.broadcast({
      turtleSoupEnd: true
    });
  }

  // Handle puzzle selection in turtle soup
  async handleTurtleSoupPuzzleSelected(session, data) {
    console.log(`[TurtleSoup-AI] Puzzle selected by ${data.initiator}: ${data.puzzleId}`);
    
    if (!this.turtleSoupActive || session.name !== this.turtleSoupInitiator) {
      this.sendErrorToSession(session, "只有海龟汤发起人可以选择题目");
      return;
    }

    // Load the selected puzzle
    const puzzle = this.loadPuzzle(data.puzzleId);
    if (!puzzle) {
      this.sendErrorToSession(session, "题目加载失败");
      return;
    }

    try {
      // Initialize AI Host if not already done
      if (!this.aiHost) {
        this.aiHost = createAIHost(this.env);
      }

      // Start AI host game with the selected puzzle
      const gameResult = await this.aiHost.startGame(data.puzzleId, {});
      
      if (!gameResult.success) {
        const errorMessage = gameResult.error?.message || gameResult.error || '启动失败';
        this.sendErrorToSession(session, `启动AI主持模式失败: ${errorMessage}`);
        return;
      }

      // Start AI host mode within turtle soup
      this.aiHostActive = true;
      this.aiHostInitiator = data.initiator;
      this.aiHostParticipants = this.turtleSoupParticipants;
      this.currentPuzzle = puzzle;

      // Save game state
      await this.saveGameState();

      // Broadcast puzzle start
      this.broadcast({
        turtleSoupPuzzleStart: true,
        initiator: data.initiator,
        participants: this.turtleSoupParticipants,
        puzzle: puzzle,
        startMessage: `🧩 ${puzzle.title} - ${puzzle.surface}`
      });

      console.log(`[TurtleSoup-AI] AI-hosted turtle soup started with puzzle: ${puzzle.title}`);
      
    } catch (error) {
      console.error(`[TurtleSoup-AI] Failed to start AI host:`, error);
      this.sendErrorToSession(session, "启动AI主持模式时发生错误");
    }
  }

  // Handle AI message in turtle soup mode
  async handleTurtleSoupAIMessage(session, messageData) {
    const currentPlayer = this.turtleSoupParticipants[this.currentTurnIndex];
    
    if (currentPlayer !== session.name) {
      console.log(`[TurtleSoup-AI] Wrong user's turn: ${session.name} vs ${currentPlayer}`);
      return;
    }

    console.log(`[TurtleSoup-AI] Processing AI question from ${session.name}: "${messageData.message}"`);
    
    // Process the AI question and get response
    await this.processAIHostQuestion(session.name, messageData.message);
    
    // Advance turn
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turtleSoupParticipants.length;
    
    // Broadcast turn change after a delay
    setTimeout(async () => {
      // Save game state when turn changes
      await this.saveGameState();
      
      this.broadcast({
        turtleSoupTurnChange: true,
        turnIndex: this.currentTurnIndex,
        nextPlayer: this.turtleSoupParticipants[this.currentTurnIndex]
      });
    }, 2000); // Give time for AI response to be processed
  }

  // Load puzzle by ID
  loadPuzzle(puzzleId) {
    return this.puzzleManager.getPuzzleById(puzzleId);
  }

  /**
   * Generate simple AI response for turtle soup questions
   * @param {string} question - User's question
   * @returns {Object} AI response with score and formatted message
   */
  generateAIResponse(question) {
    const responses = ['是', '不是', '是也不是', '没有关系'];
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // Simple scoring logic based on question characteristics
    let score = 5; // Base score
    let quality = '一般';
    
    const questionLower = question.toLowerCase();
    
    // Better questions get higher scores
    if (questionLower.includes('为什么') || questionLower.includes('怎么') || questionLower.includes('如何')) {
      score += 2;
      quality = '很好';
    } else if (questionLower.includes('是否') || questionLower.includes('是不是') || question.endsWith('吗？') || question.endsWith('吗')) {
      score += 1;
      quality = '不错';
    }
    
    // Penalize very short questions
    if (question.length < 5) {
      score -= 1;
      quality = '可以更详细';
    }
    
    // Ensure score is within range
    score = Math.max(1, Math.min(10, score));
    
    const formatted = `${response}（问题质量：${quality}，得分：${score}分）`;
    
    console.log(`[TurtleSoup AI] Question: "${question}" -> Response: "${response}", Score: ${score}`);
    
    return {
      answer: response,
      score: score,
      quality: quality,
      formatted: formatted
    };
  }

  // AI Host related methods
  
  /**
   * Handle AI Host request
   * @param {Object} session - User session
   * @param {Object} data - Request data
   */
  async handleAIHostRequest(session, data) {
    console.log(`[AI Host] Request from ${session.name}`);
    
    // Check if AI host is already active
    if (this.aiHostActive) {
      this.sendErrorToSession(session, "AI主持模式已经在进行中");
      return;
    }
    
    // Check if turtle soup is active
    if (this.turtleSoupActive) {
      this.sendErrorToSession(session, "海龟汤模式正在进行中，请先结束");
      return;
    }
    
    try {
      // Initialize AI Host if not already done
      if (!this.aiHost) {
        this.aiHost = createAIHost(this.env);
      }
      
      // Start AI host game
      const gameResult = await this.aiHost.startGame(data.puzzleId, data.filters || {});
      
      if (!gameResult.success) {
        const errorMessage = gameResult.error?.message || gameResult.error || '启动失败';
        this.sendErrorToSession(session, `启动AI主持模式失败: ${errorMessage}`);
        return;
      }
      
      // Extract game data from the new format
      const gameData = gameResult.data;
      
      // Set AI host state
      this.aiHostActive = true;
      this.aiHostInitiator = session.name;
      
      // Get all online users as participants
      this.aiHostParticipants = [];
      this.sessions.forEach((s) => {
        if (s.name) {
          this.aiHostParticipants.push(s.name);
        }
      });
      
      // Broadcast AI host start
      this.broadcast({
        aiHostStart: true,
        initiator: session.name,
        participants: this.aiHostParticipants,
        puzzle: gameData.puzzle,
        startMessage: gameData.startMessage
      });
      
      console.log(`[AI Host] Started successfully with puzzle: ${gameData.puzzle.title}`);
      
    } catch (error) {
      console.error(`[AI Host] Failed to start:`, error);
      this.sendErrorToSession(session, "启动AI主持模式时发生错误");
    }
  }
  
  /**
   * Handle AI Host end request
   * @param {Object} session - User session
   * @param {Object} data - Request data
   */
  async handleAIHostEnd(session, data) {
    console.log(`[AI Host] End request from ${session.name}`);
    
    if (!this.aiHostActive) {
      this.sendErrorToSession(session, "当前不在AI主持模式");
      return;
    }
    
    if (session.name !== this.aiHostInitiator) {
      this.sendErrorToSession(session, "只有发起人可以结束游戏");
      return;
    }
    
    await this.endAIHostMode();
  }
  
  /**
   * Process AI Host question
   * @param {string} userId - User ID
   * @param {string} question - User question
   */
  async processAIHostQuestion(userId, question) {
    try {
      console.log(`[AI Host] Processing question from ${userId}: "${question}"`);
      
      if (!this.aiHost) {
        throw new Error('AI Host not initialized');
      }
      
      // Process question through AI host
      const result = await this.aiHost.processQuestion(question, userId);
      
      if (!result.success) {
        // Handle different error formats
        const errorMessage = result.error?.message || result.error || '处理问题时发生错误';
        this.broadcast({
          error: errorMessage
        });
        return;
      }
      
      // Extract response data from the new format
      const responseData = result.data;
      const response = responseData.response;
      
      // Check if game is solved
      const isSolved = this.aiHost.checkIfSolved(response);
      
      if (isSolved) {
        // Game solved - end with solution
        const endResult = this.aiHost.endGame(true);
        
        if (endResult.success) {
          this.broadcast({
            aiGameSolved: true,
            endMessage: endResult.data.endMessage,
            statistics: endResult.data.statistics
          });
        } else {
          // Handle endGame error
          console.error('[AI Host] Failed to end game:', endResult.error);
        }
        
        // End AI host mode
        await this.endAIHostMode();
      } else {
        // Regular AI response
        this.broadcast({
          aiResponse: true,
          questioner: userId,
          question: question,
          formattedMessage: responseData.formattedMessage,
          gameState: responseData.gameState
        });
      }
      
    } catch (error) {
      console.error(`[AI Host] Failed to process question:`, error);
      this.broadcast({
        error: "处理问题时发生内部错误，请重试"
      });
    }
  }
  
  /**
   * End AI Host mode
   */
  async endAIHostMode() {
    console.log(`[AI Host] Ending AI host mode`);
    
    let statistics = null;
    if (this.aiHost) {
      const gameState = this.aiHost.getGameState();
      if (gameState) {
        statistics = {
          totalQuestions: gameState.questionCount,
          totalScore: gameState.totalScore,
          averageScore: gameState.averageScore,
          hintsUsed: gameState.hintsGiven
        };
      }
      this.aiHost.cleanup();
    }
    
    this.aiHostActive = false;
    this.aiHostInitiator = null;
    this.aiHostParticipants = [];
    
    // Save game state
    await this.saveGameState();
    
    // Broadcast end message
    this.broadcast({
      aiHostEnd: true,
      statistics: statistics
    });
  }
  
  /**
   * Send error message to specific session
   * @param {Object} session - User session
   * @param {string} message - Error message
   */
  sendErrorToSession(session, message) {
    // Find the websocket for this session
    for (let [webSocket, sess] of this.sessions.entries()) {
      if (sess === session) {
        this.sendError(webSocket, message);
        break;
      }
    }
  }


}

// =======================================================================================
// The RateLimiter Durable Object class.

// RateLimiter implements a Durable Object that tracks the frequency of messages from a particular
// source and decides when messages should be dropped because the source is sending too many
// messages.
//
// We utilize this in ChatRoom, above, to apply a per-IP-address rate limit. These limits are
// global, i.e. they apply across all chat rooms, so if a user spams one chat room, they will find
// themselves rate limited in all other chat rooms simultaneously.
export class RateLimiter {
  constructor(state, env) {
    // Timestamp at which this IP will next be allowed to send a message. Start in the distant
    // past, i.e. the IP can send a message now.
    this.nextAllowedTime = 0;
  }

  // Our protocol is: POST when the IP performs an action, or GET to simply read the current limit.
  // Either way, the result is the number of seconds to wait before allowing the IP to perform its
  // next action.
  async fetch(request) {
    return await handleErrors(request, async () => {
      let now = Date.now() / 1000;

      this.nextAllowedTime = Math.max(now, this.nextAllowedTime);

      if (request.method == "POST") {
        // POST request means the user performed an action.
        // We allow one action per 1 second (reduced from 5 seconds for better UX).
        this.nextAllowedTime += 1;
      }

      // Return the number of seconds that the client needs to wait.
      //
      // We provide a "grace" period of 30 seconds (increased from 20), meaning that the client 
      // can make 30+ requests in a quick burst before they start being limited.
      // This allows for better user experience during normal chat usage.
      let cooldown = Math.max(0, this.nextAllowedTime - now - 30);
      return new Response(cooldown);
    })
  }
}

// RateLimiterClient implements rate limiting logic on the caller's side.
class RateLimiterClient {
  // The constructor takes two functions:
  // * getLimiterStub() returns a new Durable Object stub for the RateLimiter object that manages
  //   the limit. This may be called multiple times as needed to reconnect, if the connection is
  //   lost.
  // * reportError(err) is called when something goes wrong and the rate limiter is broken. It
  //   should probably disconnect the client, so that they can reconnect and start over.
  constructor(getLimiterStub, reportError) {
    this.getLimiterStub = getLimiterStub;
    this.reportError = reportError;

    // Call the callback to get the initial stub.
    this.limiter = getLimiterStub();

    // When `inCooldown` is true, the rate limit is currently applied and checkLimit() will return
    // false.
    this.inCooldown = false;
  }

  // Call checkLimit() when a message is received to decide if it should be blocked due to the
  // rate limit. Returns `true` if the message should be accepted, `false` to reject.
  checkLimit() {
    if (this.inCooldown) {
      return false;
    }
    this.inCooldown = true;
    this.callLimiter();
    return true;
  }

  // callLimiter() is an internal method which talks to the rate limiter.
  async callLimiter() {
    try {
      let response;
      try {
        // Currently, fetch() needs a valid URL even though it's not actually going to the
        // internet. We may loosen this in the future to accept an arbitrary string. But for now,
        // we have to provide a dummy URL that will be ignored at the other end anyway.
        response = await this.limiter.fetch("https://dummy-url", {method: "POST"});
      } catch (err) {
        // `fetch()` threw an exception. This is probably because the limiter has been
        // disconnected. Stubs implement E-order semantics, meaning that calls to the same stub
        // are delivered to the remote object in order, until the stub becomes disconnected, after
        // which point all further calls fail. This guarantee makes a lot of complex interaction
        // patterns easier, but it means we must be prepared for the occasional disconnect, as
        // networks are inherently unreliable.
        //
        // Anyway, get a new limiter and try again. If it fails again, something else is probably
        // wrong.
        this.limiter = this.getLimiterStub();
        response = await this.limiter.fetch("https://dummy-url", {method: "POST"});
      }

      // The response indicates how long we want to pause before accepting more requests.
      let cooldown = +(await response.text());
      await new Promise(resolve => setTimeout(resolve, cooldown * 1000));

      // Done waiting.
      this.inCooldown = false;
    } catch (err) {
      this.reportError(err);
    }
  }
}
