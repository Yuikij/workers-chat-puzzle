let currentWebSocket = null;

let nameForm = document.querySelector("#name-form");
let nameInput = document.querySelector("#name-input");
let roomForm = document.querySelector("#room-form");
let roomNameInput = document.querySelector("#room-name");
let goPublicButton = document.querySelector("#go-public");
let goPrivateButton = document.querySelector("#go-private");
let chatroom = document.querySelector("#chatroom");
let chatlog = document.querySelector("#chatlog");
let chatInput = document.querySelector("#chat-input");
let roster = document.querySelector("#roster");
let connectionStatus = document.querySelector("#connection-status");
let sendButton = document.querySelector("#send-button");
let roomInfo = document.querySelector("#room-info");
let roomTitle = document.querySelector("#room-title");
let roomUrl = document.querySelector("#room-url");
let copyRoomButton = document.querySelector("#copy-room-button");
let turtleSoupButton = document.querySelector("#turtle-soup-button");
let turtleSoupStatus = document.querySelector("#turtle-soup-status");
let turnIndicator = document.querySelector("#turn-indicator");
let turnText = document.querySelector("#turn-text");
let endTurtleSoupButton = document.querySelector("#end-turtle-soup");

// AI Host elements (now integrated into turtle soup)
let aiHostStatus = document.querySelector("#ai-host-status");
let puzzleTitle = document.querySelector("#puzzle-title");
let puzzleSurface = document.querySelector("#puzzle-surface");
let questionCount = document.querySelector("#question-count");
let averageScore = document.querySelector("#average-score");
let progressPercentage = document.querySelector("#progress-percentage");
let progressFill = document.querySelector("#progress-fill");
let endAIHostButton = document.querySelector("#end-ai-host");

// Combined mode elements
let combinedTurnInfo = document.querySelector("#combined-turn-info");
let combinedTurnIndicator = document.querySelector("#combined-turn-indicator");
let combinedTurnText = document.querySelector("#combined-turn-text");

// Score display element
let scoreDisplay = document.querySelector("#score-display");

// Modal elements
let confirmationModal = document.querySelector("#confirmation-modal");
let modalInitiatorText = document.querySelector("#modal-initiator-text");
let modalParticipantsList = document.querySelector("#modal-participants-list");
let modalAcceptBtn = document.querySelector("#modal-accept-btn");
let modalDeclineBtn = document.querySelector("#modal-decline-btn");

// Puzzle selection modal elements
let puzzleSelectionModal = document.querySelector("#puzzle-selection-modal");
let difficultyFilter = document.querySelector("#difficulty-filter");
let categoryFilter = document.querySelector("#category-filter");
let puzzleList = document.querySelector("#puzzle-list");
let puzzleCancelBtn = document.querySelector("#puzzle-cancel-btn");
let puzzleRandomBtn = document.querySelector("#puzzle-random-btn");
let puzzleConfirmBtn = document.querySelector("#puzzle-confirm-btn");

// Puzzle selection state
let availablePuzzles = [];
let selectedPuzzleId = null;

// Is the chatlog scrolled to the bottom?
let isAtBottom = true;

let username;
let roomname;

// Turtle Soup state management
let turtleSoupActive = false;
let turtleSoupParticipants = [];
let currentTurnIndex = 0;
let turtleSoupInitiator = null;
let pendingConfirmations = new Set();
let confirmationTimeout = null;
let hasResponded = false; // Track if user has already responded to current request

// User scores in turtle soup
let userScores = {};

// AI Host state management
let aiHostActive = false;
let aiHostInitiator = null;
let aiHostParticipants = [];
let currentPuzzle = null;
let gameStats = {
  questionCount: 0,
  totalScore: 0,
  averageScore: 0,
  progress: 0
};

let hostname = window.location.host;
if (hostname == "") {
  // Probably testing the HTML locally.
  hostname = "edge-chat-demo.cloudflareworkers.com";
}

// Update connection status
function updateConnectionStatus(status, message) {
  connectionStatus.className = `connection-status ${status}`;
  connectionStatus.innerHTML = message;
}

// Show room info
function showRoomInfo() {
  const currentUrl = window.location.href;
  const isPrivateRoom = roomname.length === 64;
  
  roomTitle.textContent = isPrivateRoom ? "🔒 私人房间" : `💬 #${roomname}`;
  roomUrl.textContent = currentUrl;
  roomInfo.classList.add("visible");
  chatlog.classList.add("with-room-info");
}

// Hide room info
function hideRoomInfo() {
  roomInfo.classList.remove("visible");
  chatlog.classList.remove("with-room-info");
}

// Modal functions
function showConfirmationModal(initiator, participants, onConfirm) {
  modalInitiatorText.textContent = `${initiator} 发起了海龟汤邀请`;
  modalParticipantsList.textContent = participants.join(', ');
  
  // Reset event listeners to avoid multiple bindings
  modalAcceptBtn.replaceWith(modalAcceptBtn.cloneNode(true));
  modalDeclineBtn.replaceWith(modalDeclineBtn.cloneNode(true));
  
  // Get new references after cloning
  modalAcceptBtn = document.querySelector("#modal-accept-btn");
  modalDeclineBtn = document.querySelector("#modal-decline-btn");
  
  // Add event listeners
  modalAcceptBtn.addEventListener('click', () => {
    hideConfirmationModal();
    onConfirm(true);
  });
  
  modalDeclineBtn.addEventListener('click', () => {
    hideConfirmationModal();
    onConfirm(false);
  });
  
  // Show modal with animation
  confirmationModal.classList.add('visible');
  
  // Focus on accept button for better UX
  setTimeout(() => {
    modalAcceptBtn.focus();
  }, 100);
}

function hideConfirmationModal() {
  confirmationModal.classList.remove('visible');
}

// Close modal when clicking outside
confirmationModal.addEventListener('click', (e) => {
  if (e.target === confirmationModal) {
    hideConfirmationModal();
    // Treat clicking outside as decline
    if (modalDeclineBtn) {
      modalDeclineBtn.click();
    }
  }
});

// ESC key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmationModal.classList.contains('visible')) {
    hideConfirmationModal();
    // Treat ESC as decline
    if (modalDeclineBtn) {
      modalDeclineBtn.click();
    }
  }
});

// Copy room URL to clipboard
async function copyRoomUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    
    // Show success feedback
    const originalText = copyRoomButton.innerHTML;
    copyRoomButton.innerHTML = "✅ 已复制!";
    copyRoomButton.classList.add("success");
    
    setTimeout(() => {
      copyRoomButton.innerHTML = originalText;
      copyRoomButton.classList.remove("success");
    }, 2000);
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = window.location.href;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      copyRoomButton.innerHTML = "✅ 已复制!";
      copyRoomButton.classList.add("success");
      setTimeout(() => {
        copyRoomButton.innerHTML = "📋 复制链接";
        copyRoomButton.classList.remove("success");
      }, 2000);
    } catch (err) {
      copyRoomButton.innerHTML = "❌ 复制失败";
      setTimeout(() => {
        copyRoomButton.innerHTML = "📋 复制链接";
      }, 2000);
    }
    document.body.removeChild(textArea);
  }
}

function startNameChooser() {
  nameForm.addEventListener("submit", event => {
    event.preventDefault();
    username = nameInput.value.trim();
    if (username.length > 0) {
      startRoomChooser();
    }
  });

  nameInput.addEventListener("input", event => {
    if (event.currentTarget.value.length > 32) {
      event.currentTarget.value = event.currentTarget.value.slice(0, 32);
    }
  });

  // Auto-focus and better UX
  nameInput.focus();
  nameInput.addEventListener("keypress", event => {
    if (event.key === "Enter" && nameInput.value.trim().length > 0) {
      nameForm.dispatchEvent(new Event("submit"));
    }
  });
}

function startRoomChooser() {
  nameForm.style.display = "none";

  if (document.location.hash.length > 1) {
    roomname = document.location.hash.slice(1);
    startChat();
    return;
  }

  roomForm.addEventListener("submit", event => {
    event.preventDefault();
    roomname = roomNameInput.value.trim();
    if (roomname.length > 0) {
      startChat();
    }
  });

  roomNameInput.addEventListener("input", event => {
    if (event.currentTarget.value.length > 32) {
      event.currentTarget.value = event.currentTarget.value.slice(0, 32);
    }
  });

  goPublicButton.addEventListener("click", event => {
    roomname = roomNameInput.value.trim();
    if (roomname.length > 0) {
      startChat();
    }
  });

  goPrivateButton.addEventListener("click", async event => {
    // Disable buttons during request
    roomNameInput.disabled = true;
    goPublicButton.disabled = true;
    event.currentTarget.disabled = true;
    event.currentTarget.innerHTML = '<span class="loading"></span> 创建中...';

    try {
      let response = await fetch(window.location.protocol + "//" + hostname + "/api/room", {method: "POST"});
      if (!response.ok) {
        throw new Error('Failed to create room');
      }
      roomname = await response.text();
      startChat();
    } catch (error) {
      alert("创建房间失败，请重试");
      // Re-enable buttons
      roomNameInput.disabled = false;
      goPublicButton.disabled = false;
      event.currentTarget.disabled = false;
      event.currentTarget.innerHTML = "创建私人房间 🔒";
    }
  });

  roomNameInput.focus();
  
  // Enter key support
  roomNameInput.addEventListener("keypress", event => {
    if (event.key === "Enter" && roomNameInput.value.trim().length > 0) {
      goPublicButton.click();
    }
  });
}

function startChat() {
  roomForm.style.display = "none";
  updateConnectionStatus("connecting", '<span class="loading"></span> 连接中...');

  // Normalize the room name a bit.
  roomname = roomname.replace(/[^a-zA-Z0-9_-]/g, "").replace(/_/g, "-").toLowerCase();

  if (roomname.length > 32 && !roomname.match(/^[0-9a-f]{64}$/)) {
    addChatMessage("ERROR", "房间名无效", true);
    return;
  }

  document.location.hash = "#" + roomname;

  // Show room info and setup copy functionality
  showRoomInfo();
  copyRoomButton.addEventListener("click", copyRoomUrl);

  chatInput.addEventListener("keydown", event => {
    if (event.keyCode == 38) {
      // up arrow
      chatlog.scrollBy(0, -50);
    } else if (event.keyCode == 40) {
      // down arrow
      chatlog.scrollBy(0, 50);
    } else if (event.keyCode == 33) {
      // page up
      chatlog.scrollBy(0, -chatlog.clientHeight + 50);
    } else if (event.keyCode == 34) {
      // page down
      chatlog.scrollBy(0, chatlog.clientHeight - 50);
    }
  });

  chatroom.addEventListener("submit", event => {
    console.log(`[TurtleSoup Client] Form submit event triggered`);
    event.preventDefault();
    sendMessage();
  });

  sendButton.addEventListener("click", event => {
    console.log(`[TurtleSoup Client] Send button clicked`);
    event.preventDefault();
    sendMessage();
  });

  // Turtle Soup button event listener
  turtleSoupButton.addEventListener("click", event => {
    event.preventDefault();
    initiateTurtleSoup();
  });

  // End Turtle Soup button event listener
  endTurtleSoupButton.addEventListener("click", event => {
    event.preventDefault();
    endTurtleSoup();
  });

  // End AI Host button event listener
  endAIHostButton.addEventListener("click", event => {
    event.preventDefault();
    endAIHost();
  });



  // 防止重复提交的标志
  let isProcessingMessage = false;
  
  function sendMessage() {
    const message = chatInput.value.trim();
    console.log(`[TurtleSoup Client] sendMessage called: "${message}", turtleSoupActive: ${turtleSoupActive}`);
    
    if (currentWebSocket && message.length > 0) {
      // Check if turtle soup is active with AI host
      if (turtleSoupActive && aiHostActive) {
        console.log(`[TurtleSoup-AI Client] Turtle soup with AI active, checking turn. Current index: ${currentTurnIndex}, current player: ${turtleSoupParticipants[currentTurnIndex]}, username: ${username}`);
        if (turtleSoupParticipants[currentTurnIndex] !== username) {
          console.log(`[TurtleSoup-AI Client] Not user's turn, blocking message`);
          addChatMessage(null, "⚠️ 现在不是你的发言轮次，请等待", true);
          return;
        }
        // Send message with both turtle soup and AI flags
        const msgData = {
          message: message,
          turtleSoupMessage: true,
          aiHostQuestion: true,
          turnComplete: true
        };
        console.log(`[TurtleSoup-AI Client] Sending AI question in turtle soup:`, msgData);
        currentWebSocket.send(JSON.stringify(msgData));
      }
      // Check if AI host is active (standalone)
      else if (aiHostActive) {
        console.log(`[AI Host Client] AI host active, sending question`);
        currentWebSocket.send(JSON.stringify({message: message}));
      }
      // Check if turtle soup is active (without AI)
      else if (turtleSoupActive) {
        console.log(`[TurtleSoup Client] Turtle soup active, checking turn. Current index: ${currentTurnIndex}, current player: ${turtleSoupParticipants[currentTurnIndex]}, username: ${username}`);
        if (turtleSoupParticipants[currentTurnIndex] !== username) {
          console.log(`[TurtleSoup Client] Not user's turn, blocking message`);
          addChatMessage(null, "⚠️ 现在不是你的发言轮次，请等待", true);
          return;
        }
        // Send message with turtle soup flag
        const msgData = {
          message: message,
          turtleSoupMessage: true,
          turnComplete: true
        };
        console.log(`[TurtleSoup Client] Sending turtle soup message:`, msgData);
        currentWebSocket.send(JSON.stringify(msgData));
      } else {
        console.log(`[Normal Client] Normal message mode`);
        currentWebSocket.send(JSON.stringify({message: message}));
      }
      chatInput.value = "";
      
      // Scroll to bottom whenever sending a message.
      chatlog.scrollBy(0, 1e8);
    } else {
      console.log(`[Client] Cannot send message: WebSocket: ${!!currentWebSocket}, message length: ${message.length}`);
    }
  }

  chatInput.addEventListener("input", event => {
    if (event.currentTarget.value.length > 256) {
      event.currentTarget.value = event.currentTarget.value.slice(0, 256);
    }
  });

  chatlog.addEventListener("scroll", event => {
    isAtBottom = chatlog.scrollTop + chatlog.clientHeight >= chatlog.scrollHeight - 5;
  });

  chatInput.focus();
  document.body.addEventListener("click", event => {
    // If the user clicked somewhere in the window without selecting any text, focus the chat input.
    if (window.getSelection().toString() == "" && !event.target.matches('button, input, a')) {
      chatInput.focus();
    }
  });

  // Detect mobile keyboard appearing and disappearing, and adjust the scroll as appropriate.
  if('visualViewport' in window) {
    window.visualViewport.addEventListener('resize', function(event) {
      if (isAtBottom) {
        chatlog.scrollBy(0, 1e8);
      }
    });
  }

  join();
}

let lastSeenTimestamp = 0;
let wroteWelcomeMessages = false;

function join() {
  // If we are running via wrangler dev, use ws:
  const wss = document.location.protocol === "http:" ? "ws://" : "wss://";
  let ws = new WebSocket(wss + hostname + "/api/room/" + roomname + "/websocket");
  let rejoined = false;
  let startTime = Date.now();

  let rejoin = async () => {
    if (!rejoined) {
      rejoined = true;
      currentWebSocket = null;
      updateConnectionStatus("disconnected", "❌ 连接断开");

      // Clear the roster.
      const rosterHeader = roster.querySelector('h3');
      roster.innerHTML = '';
      roster.appendChild(rosterHeader);

      // Don't try to reconnect too rapidly.
      let timeSinceLastJoin = Date.now() - startTime;
      if (timeSinceLastJoin < 10000) {
        // Less than 10 seconds elapsed since last join. Pause a bit.
        updateConnectionStatus("connecting", '<span class="loading"></span> 重新连接中...');
        await new Promise(resolve => setTimeout(resolve, 10000 - timeSinceLastJoin));
      }

      // OK, reconnect now!
      join();
    }
  }

  ws.addEventListener("open", event => {
    currentWebSocket = ws;
    updateConnectionStatus("connected", "✅ 已连接");
    // Send user info message.
    ws.send(JSON.stringify({name: username}));
  });

  ws.addEventListener("message", event => {
    let data = JSON.parse(event.data);

    if (data.error) {
      addChatMessage(null, "❌ 错误: " + data.error, true);
      
      // Handle state synchronization issues
      if (data.error === '当前不在AI主持模式' && aiHostActive) {
        console.log(`[AI Host Client] State sync issue detected - forcing client state reset`);
        addChatMessage(null, "⚠️ 检测到状态不同步，正在重置客户端状态...", true);
        endAIHostMode();
      }
      
      // 重置处理标志
      isProcessingMessage = false;
    } else if (data.joined) {
      // Check if user is already in the roster to avoid duplicates
      let userExists = false;
      for (let child of roster.childNodes) {
        if (child.innerText === data.joined) {
          userExists = true;
          break;
        }
      }
      
      // Only add if user doesn't already exist in roster
      if (!userExists) {
        let p = document.createElement("p");
        p.innerText = data.joined;
        roster.appendChild(p);
      }
    } else if (data.quit) {
      for (let child of roster.childNodes) {
        if (child.innerText == data.quit) {
          roster.removeChild(child);
          break;
        }
      }
    } else if (data.ready) {
      // All pre-join messages have been delivered.
      if (!wroteWelcomeMessages) {
        wroteWelcomeMessages = true;
        addChatMessage(null,
            "🎉 欢迎来到基于 Cloudflare Workers Durable Objects 构建的聊天室！源代码: https://github.com/cloudflare/workers-chat-demo", true);
        addChatMessage(null,
            "⚠️ 警告: 聊天室中的参与者是来自互联网的随机用户。用户名未经验证；任何人都可以冒充他人。聊天记录会被保存。", true);
        if (roomname.length == 64) {
          addChatMessage(null,
              "🔒 这是一个私人房间。你可以通过点击上方的复制按钮分享房间链接邀请其他人加入。", true);
        } else {
          addChatMessage(null,
              "👋 欢迎来到 #" + roomname + " 房间，开始聊天吧！你可以点击上方的复制按钮分享房间链接。", true);
        }
      }
    } else if (data.turtleSoupRequest) {
      // Handle turtle soup initiation request
      handleTurtleSoupRequest(data);
    } else if (data.turtleSoupConfirm) {
      // Handle turtle soup confirmation
      handleTurtleSoupConfirmation(data);
    } else if (data.turtleSoupStart) {
      // Handle turtle soup start
      handleTurtleSoupStart(data);
    } else if (data.turtleSoupTurnChange) {
      // Handle turn change
      handleTurnChange(data);
    } else if (data.turtleSoupEnd) {
      // Handle turtle soup end
      handleTurtleSoupEnd(data);
    } else if (data.aiHostStart) {
      // Handle AI host start
      handleAIHostStart(data);
    } else if (data.aiResponse) {
      // Handle AI response
      handleAIResponse(data);
    } else if (data.aiGameSolved) {
      // Handle AI game solved
      console.log(`[AI Host Client] Game solved message received:`, data);
      handleAIGameSolved(data);
    } else if (data.aiHostEnd) {
      // Handle AI host end
      console.log(`[AI Host Client] Host end message received:`, data);
      handleAIHostEnd(data);
    } else if (data.turtleSoupPuzzleStart) {
      // Handle puzzle start in turtle soup
      handleTurtleSoupPuzzleStart(data);
    } else {
      // A regular chat message.
      if (data.timestamp > lastSeenTimestamp) {
        addChatMessage(data.name, data.message);
        lastSeenTimestamp = data.timestamp;
        
        // Turn changes are handled by the server, no client-side processing needed
      }
    }
  });

  ws.addEventListener("close", event => {
    console.log("WebSocket closed, reconnecting:", event.code, event.reason);
    rejoin();
  });
  
  ws.addEventListener("error", event => {
    console.log("WebSocket error, reconnecting:", event);
    rejoin();
  });
}

function addChatMessage(name, text, isSystem = false) {
  let p = document.createElement("p");
  
  if (isSystem) {
    p.className = "system-message";
  }
  
  if (name) {
    let tag = document.createElement("span");
    tag.className = "username";
    tag.innerText = name + ": ";
    p.appendChild(tag);
  }
  
  p.appendChild(document.createTextNode(text));

  // Append the new chat line, making sure that if the chatlog was scrolled to the bottom
  // before, it remains scrolled to the bottom, and otherwise the scroll position doesn't change.
  chatlog.appendChild(p);
  if (isAtBottom) {
    setTimeout(() => chatlog.scrollBy(0, 1e8), 10);
  }
}

// Turtle Soup Functions
function initiateTurtleSoup() {
  console.log(`[TurtleSoup Client] ${username} initiating turtle soup`);
  
  if (turtleSoupActive) {
    addChatMessage(null, "⚠️ 海龟汤已经进行中", true);
    return;
  }
  
  if (aiHostActive) {
    addChatMessage(null, "⚠️ AI主持模式正在进行中，请先结束", true);
    return;
  }
  
  // Check if already waiting for confirmations
  if (turtleSoupButton.disabled) {
    console.log(`[TurtleSoup Client] Already waiting for confirmations, ignoring duplicate request`);
    return;
  }
  
  // Get all online users from roster
  const onlineUsers = [];
  for (let child of roster.childNodes) {
    if (child.innerText && child.innerText.trim() !== '在线用户') {
      onlineUsers.push(child.innerText.trim());
    }
  }
  
  console.log(`[TurtleSoup Client] Found online users:`, onlineUsers);
  
  if (onlineUsers.length < 2) {
    addChatMessage(null, "⚠️ 需要至少2人才能发起海龟汤", true);
    return;
  }
  
  // Disable button and send request
  turtleSoupButton.disabled = true;
  turtleSoupButton.textContent = "等待确认...";
  
  // Send turtle soup request - let server determine participants
  if (currentWebSocket) {
    currentWebSocket.send(JSON.stringify({
      turtleSoupRequest: true,
      initiator: username,
      participants: onlineUsers  // Send what we see, but server will use its own list
    }));
    console.log(`[TurtleSoup Client] Sent request with participants:`, onlineUsers);
  }
  
  // Set timeout for confirmations
  confirmationTimeout = setTimeout(() => {
    console.log(`[TurtleSoup Client] Request timeout`);
    addChatMessage(null, "⏰ 海龟汤发起超时，请重新尝试", true);
    resetTurtleSoupButton();
  }, 30000); // 30 seconds timeout
}

function handleTurtleSoupRequest(data) {
  console.log(`[TurtleSoup Client] Received request from ${data.initiator}, participants:`, data.participants);
  
  if (data.initiator === username) {
    // This is our own request, ignore
    console.log(`[TurtleSoup Client] Ignoring own request`);
    return;
  }
  
  // Check if already responded to this initiator's request
  if (hasResponded) {
    console.log(`[TurtleSoup Client] Already responded to request, ignoring duplicate`);
    return;
  }
  
  // Show confirmation modal
  showConfirmationModal(data.initiator, data.participants, (confirmed) => {
    console.log(`[TurtleSoup Client] User ${username} confirmed: ${confirmed}`);
    
    // Mark as responded
    hasResponded = true;
    
    if (currentWebSocket) {
      currentWebSocket.send(JSON.stringify({
        turtleSoupConfirm: true,
        initiator: data.initiator,
        confirmed: confirmed,
        user: username
      }));
      console.log(`[TurtleSoup Client] Sent confirmation response`);
    }
  });
}

function handleTurtleSoupConfirmation(data) {
  console.log(`[TurtleSoup Client] Confirmation from ${data.user}: ${data.confirmed}`);
  
  if (data.confirmed) {
    addChatMessage(null, `✅ ${data.user} 确认参与海龟汤`, true);
  } else {
    addChatMessage(null, `❌ ${data.user} 拒绝参与海龟汤`, true);
    hasResponded = false; // Reset for next request
    // Cancel the turtle soup if we are the initiator
    if (data.initiator === username) {
      console.log(`[TurtleSoup Client] Canceling due to rejection`);
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
      }
      resetTurtleSoupButton();
    }
  }
}

function handleTurtleSoupStart(data) {
  console.log(`[TurtleSoup Client] Starting turtle soup with participants:`, data.participants);
  console.log(`[TurtleSoup Client] Participants details:`, JSON.stringify(data.participants));
  console.log(`[TurtleSoup Client] My username:`, username);
  console.log(`[TurtleSoup Client] Initiator:`, data.initiator);
  
  // Check for state conflicts
  if (aiHostActive) {
    console.warn(`[TurtleSoup Client] Cannot start turtle soup - AI host is active`);
    addChatMessage(null, "⚠️ AI主持模式正在进行中，无法启动海龟汤", true);
    return;
  }
  
  turtleSoupActive = true;
  turtleSoupParticipants = data.participants;
  currentTurnIndex = 0;
  turtleSoupInitiator = data.initiator;
  hasResponded = false; // Reset for next request
  
  // Clear confirmation timeout for everyone (not just initiator)
  if (confirmationTimeout) {
    console.log(`[TurtleSoup Client] Clearing confirmation timeout`);
    clearTimeout(confirmationTimeout);
    confirmationTimeout = null;
  }
  
  // If I'm the initiator, show puzzle selection modal
  if (username === data.initiator) {
    showPuzzleSelectionModal();
    return;
  }
  
  // Update UI for non-initiators (wait for puzzle selection)
  document.body.classList.add('turtle-soup-mode');
  turtleSoupStatus.style.display = 'block';
  turtleSoupButton.style.display = 'none';
  
  turnText.textContent = "等待发起人选择题目...";
  turnIndicator.textContent = "⏳";
  chatInput.disabled = true;
  chatInput.placeholder = "等待题目选择...";
  
  addChatMessage(null, `🐢 海龟汤开始！参与者: ${turtleSoupParticipants.join(', ')}`, true);
  addChatMessage(null, `⏳ 等待 ${data.initiator} 选择题目...`, true);
  
  console.log(`[TurtleSoup Client] Turtle soup UI updated successfully`);
}

function handleTurnChange(data) {
  console.log(`[TurtleSoup Client] Turn change received: index ${data.turnIndex}, next player: ${data.nextPlayer}`);
  currentTurnIndex = data.turnIndex;
  updateTurnDisplay();
}

function handleTurtleSoupEnd(data) {
  endTurtleSoupMode();
  addChatMessage(null, `🏁 海龟汤结束，感谢参与！`, true);
}

// Removed handleTurtleSoupTurnComplete - server handles all turn changes

function updateTurnDisplay() {
  if (!turtleSoupActive) return;
  
  const currentPlayer = turtleSoupParticipants[currentTurnIndex];
  console.log(`[TurtleSoup Client] Updating turn display: index ${currentTurnIndex}, player ${currentPlayer}, my username: ${username}`);
  
  const isMyTurn = currentPlayer === username;
  
  // Update combined panel (AI + Turtle Soup mode)
  if (aiHostActive && combinedTurnInfo) {
    combinedTurnInfo.style.display = 'flex';
    
    if (isMyTurn) {
      combinedTurnText.textContent = "轮到你向AI提问";
      combinedTurnInfo.classList.add('active');
      chatInput.placeholder = "向AI主持人提问...";
    } else {
      combinedTurnText.textContent = `轮到 ${currentPlayer} 向AI提问`;
      combinedTurnInfo.classList.remove('active');
      chatInput.placeholder = `等待 ${currentPlayer} 提问...`;
    }
  }
  
  // Update separate turtle soup panel (for non-AI mode)
  if (turnText) {
    if (isMyTurn) {
      if (aiHostActive) {
        turnText.textContent = "轮到你向AI提问";
        chatInput.placeholder = "向AI主持人提问...";
      } else {
        turnText.textContent = "轮到你发言";
        chatInput.placeholder = "输入你的发言...";
      }
      turnIndicator.className = "turn-indicator-pulse";
    } else {
      if (aiHostActive) {
        turnText.textContent = `轮到 ${currentPlayer} 向AI提问`;
        chatInput.placeholder = `等待 ${currentPlayer} 提问...`;
      } else {
        turnText.textContent = `轮到 ${currentPlayer} 发言`;
        chatInput.placeholder = `等待 ${currentPlayer} 发言...`;
      }
      turnIndicator.className = "";
    }
  }
  
  // Update input state
  chatInput.disabled = !isMyTurn;
  console.log(`[TurtleSoup Client] Turn update complete. My turn: ${isMyTurn}, input disabled: ${chatInput.disabled}`);
}

function endTurtleSoup() {
  if (!turtleSoupActive) return;
  
  if (username !== turtleSoupInitiator) {
    addChatMessage(null, "⚠️ 只有发起人可以结束海龟汤", true);
    return;
  }
  
  // Broadcast end message
  if (currentWebSocket) {
    currentWebSocket.send(JSON.stringify({
      turtleSoupEnd: true,
      initiator: username
    }));
  }
  
  endTurtleSoupMode();
}

function endTurtleSoupMode() {
  turtleSoupActive = false;
  turtleSoupParticipants = [];
  currentTurnIndex = 0;
  turtleSoupInitiator = null;
  pendingConfirmations.clear();
  
  // Also reset AI host state
  aiHostActive = false;
  aiHostInitiator = null;
  aiHostParticipants = [];
  currentPuzzle = null;
  
  // Update UI
  document.body.classList.remove('turtle-soup-mode');
  document.body.classList.remove('ai-host-mode');
  turtleSoupStatus.style.display = 'none';
  aiHostStatus.style.display = 'none';
  turtleSoupButton.style.display = 'block';
  
  chatInput.disabled = false;
  chatInput.placeholder = "输入消息...";
  
  resetTurtleSoupButton();
}

function resetTurtleSoupButton() {
  turtleSoupButton.disabled = false;
  turtleSoupButton.textContent = "🐢 发起海龟汤";
  hasResponded = false; // Reset for next request
  
  if (confirmationTimeout) {
    clearTimeout(confirmationTimeout);
    confirmationTimeout = null;
  }
}

// ===== AI Host Functions =====

function initiateAIHost() {
  console.log(`[AI Host Client] ${username} initiating AI host mode`);
  
  if (aiHostActive) {
    addChatMessage(null, "⚠️ AI主持模式已经在进行中", true);
    return;
  }
  
  if (turtleSoupActive) {
    addChatMessage(null, "⚠️ 海龟汤模式正在进行中，请先结束", true);
    return;
  }
  
  if (aiHostButton.disabled) {
    console.log(`[AI Host Client] Button is disabled, ignoring request`);
    return;
  }
  
  // Show puzzle selection modal
  showPuzzleSelectionModal();
}

function handleAIHostStart(data) {
  console.log(`[AI Host Client] AI host started:`, data);
  
  // Update local state
  aiHostActive = true;
  aiHostInitiator = data.initiator;
  aiHostParticipants = data.participants;
  currentPuzzle = data.puzzle;
  gameStats = {
    questionCount: 0,
    totalScore: 0,
    averageScore: 0,
    progress: 0
  };
  
  // Update UI
  document.body.classList.add('ai-host-mode');
  aiHostStatus.style.display = 'block';
  aiHostButton.style.display = 'none';
  turtleSoupButton.style.display = 'none';
  
  // Update puzzle info
  puzzleTitle.textContent = data.puzzle.title;
  puzzleSurface.textContent = data.puzzle.surface;
  
  // Update stats
  updateGameStats();
  
  // Update input placeholder
  chatInput.placeholder = "向AI主持人提问...";
  
  // Add start message to chat
  addChatMessage(null, data.startMessage, true);
  addChatMessage(null, `🤖 AI主持模式开始！参与者: ${data.participants.join(', ')}`, true);
  
  console.log(`[AI Host Client] AI host mode UI updated successfully`);
}

function handleAIResponse(data) {
  console.log(`[AI Host Client] AI response received:`, data);
  console.log(`[AI Host Client] Current aiHostActive: ${aiHostActive}`);
  
  // Add user question to chat
  addChatMessage(data.questioner, data.question);
  
  // Add AI response to chat
  addChatMessage("🤖 AI主持人", data.formattedMessage, true);
  
  // Update game stats
  if (data.gameState) {
    console.log(`[AI Host Client] Updating game stats - Progress: ${data.gameState.progress}`);
    gameStats.questionCount = data.gameState.questionCount;
    gameStats.totalScore = data.gameState.totalScore;
    gameStats.averageScore = parseFloat(data.gameState.averageScore);
    gameStats.progress = data.gameState.progress;
    
    updateGameStats();
  }
  
  // 重置处理标志，允许下一个消息
  isProcessingMessage = false;
  console.log(`[AI Host Client] Message processing completed, ready for next message`);
}

function handleAIGameSolved(data) {
  console.log(`[AI Host Client] Game solved!`, data);
  
  // Add solution message
  addChatMessage(null, data.endMessage, true);
  
  // Show statistics
  if (data.statistics) {
    const stats = data.statistics;
    addChatMessage(null, 
      `📊 游戏统计:\n` +
      `• 总问题数: ${stats.totalQuestions}\n` +
      `• 总分: ${stats.totalScore}\n` +
      `• 平均分: ${stats.averageScore}\n` +
      `• 使用提示: ${stats.hintsUsed}次\n` +
      `• 最终进度: ${stats.finalProgress}%`, true);
  }
  
  // End AI host mode
  endAIHostMode();
}

function handleAIHostEnd(data) {
  console.log(`[AI Host Client] AI host ended`);
  
  addChatMessage(null, "🤖 AI主持模式已结束", true);
  
  // Show statistics if available
  if (data.statistics) {
    const stats = data.statistics;
    addChatMessage(null, 
      `📊 游戏统计:\n` +
      `• 总问题数: ${stats.totalQuestions}\n` +
      `• 总分: ${stats.totalScore}\n` +
      `• 平均分: ${stats.averageScore}\n` +
      `• 使用提示: ${stats.hintsUsed}次`, true);
  }
  
  endAIHostMode();
}

function endAIHost() {
  if (!aiHostActive) return;
  
  if (username !== aiHostInitiator) {
    addChatMessage(null, "⚠️ 只有发起人可以结束游戏", true);
    return;
  }
  
  // Send end request to server
  if (currentWebSocket) {
    currentWebSocket.send(JSON.stringify({
      aiHostEnd: true
    }));
  }
  
  endAIHostMode();
}

function endAIHostMode() {
  aiHostActive = false;
  aiHostInitiator = null;
  aiHostParticipants = [];
  currentPuzzle = null;
  gameStats = {
    questionCount: 0,
    totalScore: 0,
    averageScore: 0,
    progress: 0
  };
  
  // Reset processing flag
  if (typeof isProcessingMessage !== 'undefined') {
    isProcessingMessage = false;
  }
  
  // Update UI
  document.body.classList.remove('ai-host-mode');
  aiHostStatus.style.display = 'none';
  aiHostButton.style.display = 'block';
  
  // Restore turtle soup button if not in turtle soup mode
  if (!turtleSoupActive) {
    turtleSoupButton.style.display = 'block';
  }
  
  chatInput.placeholder = "输入消息...";
  
  resetAIHostButton();
}

function resetAIHostButton() {
  aiHostButton.disabled = false;
  aiHostButton.textContent = "🤖 AI主持模式";
}

function updateGameStats() {
  questionCount.textContent = gameStats.questionCount;
  averageScore.textContent = gameStats.averageScore.toFixed(1);
  progressPercentage.textContent = `${gameStats.progress}%`;
  progressFill.style.width = `${gameStats.progress}%`;
}

// ===== Puzzle Selection Functions =====

function showPuzzleSelectionModal() {
  // Load available puzzles (in a real implementation, this would fetch from server)
  loadAvailablePuzzles();
  
  // Reset selection state
  selectedPuzzleId = null;
  puzzleConfirmBtn.disabled = true;
  
  // Show modal
  puzzleSelectionModal.classList.add('visible');
  
  // Setup event listeners
  setupPuzzleModalListeners();
}

function hidePuzzleSelectionModal() {
  puzzleSelectionModal.classList.remove('visible');
  
  // Clean up event listeners
  cleanupPuzzleModalListeners();
}

function loadAvailablePuzzles() {
  // Mock puzzle data based on the actual puzzles.json structure
  availablePuzzles = [
    {
      id: "classic_003",
      title: "镜子碎了",
      difficulty: "简单",
      category: "经典",
      surface: "一个女人在家里看到镜子碎了，然后就自杀了。为什么？"
    },
    {
      id: "classic_004", 
      title: "电话亭",
      difficulty: "中等",
      category: "经典",
      surface: "一个男人在深夜使用电话亭打电话，突然看到一个人向他走来，他立刻挂掉电话逃跑了。为什么？"
    },
    {
      id: "classic_005",
      title: "雨夜归家", 
      difficulty: "困难",
      category: "经典",
      surface: "一个男人雨夜回家，用钥匙开门进入，发现客厅的灯是亮着的，但是他立刻转身离开了。为什么？"
    },
    {
      id: "modern_001",
      title: "电梯惊魂",
      difficulty: "中等", 
      category: "现代",
      surface: "一个女人坐电梯到20楼，但在18楼突然按了紧急停止按钮冲出电梯。为什么？"
    },
    {
      id: "modern_002",
      title: "网购惊魂",
      difficulty: "困难",
      category: "现代", 
      surface: "一个男人收到一个包裹，打开后立刻报警。包裹里装的是一本普通的书。为什么？"
    },
    {
      id: "suspense_001",
      title: "午夜来电",
      difficulty: "中等",
      category: "悬疑",
      surface: "一个女人深夜接到丈夫的电话，丈夫说他在加班，但她立刻知道丈夫在撒谎。为什么？"
    }
  ];
  
  renderPuzzleList();
}

function renderPuzzleList() {
  const difficultyValue = difficultyFilter.value;
  const categoryValue = categoryFilter.value;
  
  // Filter puzzles
  let filteredPuzzles = availablePuzzles;
  
  if (difficultyValue) {
    filteredPuzzles = filteredPuzzles.filter(p => p.difficulty === difficultyValue);
  }
  
  if (categoryValue) {
    filteredPuzzles = filteredPuzzles.filter(p => p.category === categoryValue);
  }
  
  // Render puzzle items
  puzzleList.innerHTML = '';
  
  filteredPuzzles.forEach(puzzle => {
    const puzzleItem = document.createElement('div');
    puzzleItem.className = 'puzzle-item';
    puzzleItem.dataset.puzzleId = puzzle.id;
    
    puzzleItem.innerHTML = `
      <div class="puzzle-title">${puzzle.title}</div>
      <div class="puzzle-meta">
        <span class="puzzle-difficulty ${puzzle.difficulty}">${puzzle.difficulty}</span>
        <span class="puzzle-category">${puzzle.category}</span>
      </div>
      <div class="puzzle-surface">${puzzle.surface}</div>
    `;
    
    puzzleItem.addEventListener('click', () => selectPuzzle(puzzle.id));
    puzzleList.appendChild(puzzleItem);
  });
  
  if (filteredPuzzles.length === 0) {
    puzzleList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">没有找到匹配的题目</div>';
  }
}

function selectPuzzle(puzzleId) {
  // Remove previous selection
  document.querySelectorAll('.puzzle-item.selected').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Add selection to clicked item
  const puzzleItem = document.querySelector(`[data-puzzle-id="${puzzleId}"]`);
  if (puzzleItem) {
    puzzleItem.classList.add('selected');
    selectedPuzzleId = puzzleId;
    puzzleConfirmBtn.disabled = false;
  }
}

function setupPuzzleModalListeners() {
  // Filter change listeners
  difficultyFilter.addEventListener('change', renderPuzzleList);
  categoryFilter.addEventListener('change', renderPuzzleList);
  
  // Button listeners
  puzzleCancelBtn.addEventListener('click', hidePuzzleSelectionModal);
  puzzleRandomBtn.addEventListener('click', selectRandomPuzzle);
  puzzleConfirmBtn.addEventListener('click', confirmPuzzleSelection);
  
  // Close on outside click
  puzzleSelectionModal.addEventListener('click', (e) => {
    if (e.target === puzzleSelectionModal) {
      hidePuzzleSelectionModal();
    }
  });
  
  // ESC key to close
  document.addEventListener('keydown', handlePuzzleModalKeydown);
}

function cleanupPuzzleModalListeners() {
  difficultyFilter.removeEventListener('change', renderPuzzleList);
  categoryFilter.removeEventListener('change', renderPuzzleList);
  puzzleCancelBtn.removeEventListener('click', hidePuzzleSelectionModal);
  puzzleRandomBtn.removeEventListener('click', selectRandomPuzzle);
  puzzleConfirmBtn.removeEventListener('click', confirmPuzzleSelection);
  document.removeEventListener('keydown', handlePuzzleModalKeydown);
}

function handlePuzzleModalKeydown(e) {
  if (e.key === 'Escape' && puzzleSelectionModal.classList.contains('visible')) {
    hidePuzzleSelectionModal();
  }
}

function selectRandomPuzzle() {
  const visiblePuzzles = puzzleList.querySelectorAll('.puzzle-item');
  if (visiblePuzzles.length > 0) {
    const randomIndex = Math.floor(Math.random() * visiblePuzzles.length);
    const randomPuzzleItem = visiblePuzzles[randomIndex];
    const puzzleId = randomPuzzleItem.dataset.puzzleId;
    selectPuzzle(puzzleId);
  }
}

function confirmPuzzleSelection() {
  if (!selectedPuzzleId) return;
  
  console.log(`[TurtleSoup Client] Selected puzzle: ${selectedPuzzleId}`);
  
  // Hide modal
  hidePuzzleSelectionModal();
  
  // Send puzzle selection to server to start AI-hosted turtle soup
  if (currentWebSocket) {
    currentWebSocket.send(JSON.stringify({
      turtleSoupPuzzleSelected: true,
      puzzleId: selectedPuzzleId,
      initiator: username
    }));
    
    console.log(`[TurtleSoup Client] Sent puzzle selection: ${selectedPuzzleId}`);
  } else {
    console.error(`[TurtleSoup Client] No WebSocket connection`);
    endTurtleSoupMode();
  }
}

// New function to handle puzzle start
function handleTurtleSoupPuzzleStart(data) {
  console.log(`[TurtleSoup Client] Puzzle selected and game starting:`, data);
  
  // Activate AI host mode within turtle soup
  aiHostActive = true;
  aiHostInitiator = data.initiator;
  aiHostParticipants = data.participants;
  currentPuzzle = data.puzzle;
  gameStats = {
    questionCount: 0,
    totalScore: 0,
    averageScore: 0,
    progress: 0
  };
  
  // Update UI to show both turtle soup and AI host elements
  document.body.classList.add('ai-host-mode');
  document.body.classList.add('turtle-soup-mode');
  turtleSoupStatus.style.display = 'block';
  aiHostStatus.style.display = 'block';
  turtleSoupButton.style.display = 'none';
  
  // Update puzzle info
  puzzleTitle.textContent = data.puzzle.title;
  puzzleSurface.textContent = data.puzzle.surface;
  
  // Update stats
  updateGameStats();
  
  // Update turn display for turtle soup with AI hosting
  updateTurnDisplay();
  
  // Update input placeholder
  chatInput.placeholder = "向AI主持人提问...";
  chatInput.disabled = false;
  
  // Add messages
  addChatMessage(null, `🧩 题目选择完成！`, true);
  addChatMessage(null, `📖 题目: ${data.puzzle.title}`, true);
  addChatMessage(null, `🔍 表面故事: ${data.puzzle.surface}`, true);
  addChatMessage(null, `🤖 AI主持人已准备好回答你们的问题！`, true);
  addChatMessage(null, `🔄 规则: 轮流发言向AI提问，AI会根据题目回答是/否/无关等`, true);
  
  console.log(`[TurtleSoup Client] AI-hosted turtle soup started successfully`);
}

// Initialize the app
updateConnectionStatus("connecting", '<span class="loading"></span> 初始化中...');
startNameChooser();