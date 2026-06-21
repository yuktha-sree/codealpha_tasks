const BASE_URL = "https://realtime-commmunication-app.onrender.com";
let isRegisterMode = false;
let authToken = localStorage.getItem("rtc_token") || "";
let currentUser = JSON.parse(localStorage.getItem("rtc_user") || "null");

let socket = null;
let currentRoomId = "";
let localStream = null;
let screenStream = null;
let micEnabled = true;
let cameraEnabled = true;

const peerConnections = {};
const remoteUsers = {};

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

const scheduledCalls = [
  {
    title: "Daily Team Standup",
    roomId: "daily-standup",
    participants: "3 waiting",
    time: "10:00 AM"
  },
  {
    title: "Project Review Meeting",
    roomId: "project-review",
    participants: "2 waiting",
    time: "12:30 PM"
  },
  {
    title: "Client Discussion",
    roomId: "client-discussion",
    participants: "4 waiting",
    time: "03:00 PM"
  },
  {
    title: "Design Collaboration",
    roomId: "design-collab",
    participants: "1 waiting",
    time: "05:00 PM"
  }
];

const authPage = document.getElementById("authPage");
const dashboardPage = document.getElementById("dashboardPage");
const meetingPage = document.getElementById("meetingPage");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authForm = document.getElementById("authForm");
const nameGroup = document.getElementById("nameGroup");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMessage = document.getElementById("authMessage");

const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const refreshCallsBtn = document.getElementById("refreshCallsBtn");
const scheduledCallsList = document.getElementById("scheduledCallsList");
const recentCallsList = document.getElementById("recentCallsList");

const roomLabel = document.getElementById("roomLabel");
const participantCount = document.getElementById("participantCount");
const videos = document.getElementById("videos");
const localVideo = document.getElementById("localVideo");

const toggleMicBtn = document.getElementById("toggleMicBtn");
const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const screenShareBtn = document.getElementById("screenShareBtn");
const whiteboardBtn = document.getElementById("whiteboardBtn");
const leaveBtn = document.getElementById("leaveBtn");

const chatTab = document.getElementById("chatTab");
const filesTab = document.getElementById("filesTab");
const chatPanel = document.getElementById("chatPanel");
const filesPanel = document.getElementById("filesPanel");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

const fileInput = document.getElementById("fileInput");
const uploadFileBtn = document.getElementById("uploadFileBtn");
const filesList = document.getElementById("filesList");

const whiteboardModal = document.getElementById("whiteboardModal");
const closeBoardBtn = document.getElementById("closeBoardBtn");
const clearBoardBtn = document.getElementById("clearBoardBtn");
const whiteboardCanvas = document.getElementById("whiteboardCanvas");
const penColor = document.getElementById("penColor");
const penSize = document.getElementById("penSize");
const boardContext = whiteboardCanvas.getContext("2d");

function showPage(page) {
  authPage.classList.add("hidden");
  dashboardPage.classList.add("hidden");
  meetingPage.classList.add("hidden");
  page.classList.remove("hidden");
}

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#dc2626" : "#16a34a";
}

function setAuthMode(registerMode) {
  isRegisterMode = registerMode;

  loginTab.classList.toggle("active", !registerMode);
  registerTab.classList.toggle("active", registerMode);
  nameGroup.classList.toggle("hidden", !registerMode);
  authSubmitBtn.textContent = registerMode ? "Register" : "Login";
  authMessage.textContent = "";
}

function loadDashboard() {
  if (!authToken || !currentUser) {
    showPage(authPage);
    return;
  }

  welcomeText.textContent = `Welcome, ${currentUser.name}`;
  renderScheduledCalls();
  renderRecentCalls();
  showPage(dashboardPage);
}

loginTab.addEventListener("click", () => setAuthMode(false));
registerTab.addEventListener("click", () => setAuthMode(true));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    email: emailInput.value.trim(),
    password: passwordInput.value
  };

  if (isRegisterMode) {
    payload.name = nameInput.value.trim();

    if (!payload.name) {
      showAuthMessage("Name is required for registration", true);
      return;
    }
  }

  const endpoint = isRegisterMode
  ? `${BASE_URL}/api/register`
  : `${BASE_URL}/api/login`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showAuthMessage(data.message || "Authentication failed", true);
      return;
    }

    authToken = data.token;
    currentUser = data.user;

    localStorage.setItem("rtc_token", authToken);
    localStorage.setItem("rtc_user", JSON.stringify(currentUser));

    showAuthMessage(data.message);
    loadDashboard();
  } catch (error) {
    showAuthMessage("Server not reachable. Make sure npm start is running.", true);
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("rtc_token");
  localStorage.removeItem("rtc_user");
  authToken = "";
  currentUser = null;
  window.location.reload();
});

joinBtn.addEventListener("click", async () => {
  const roomId = roomInput.value.trim();

  if (!roomId) {
    alert("Enter a room ID");
    return;
  }

  await joinRoom(roomId, "Custom Meeting");
});

if (refreshCallsBtn) {
  refreshCallsBtn.addEventListener("click", () => {
    renderScheduledCalls();
    renderRecentCalls();
  });
}

async function joinRoom(roomId, title = "Meeting") {
  currentRoomId = roomId;
  roomLabel.textContent = `Room: ${roomId}`;

  try {
    await startLocalMedia();
    saveRecentCall(roomId, title);
    connectSocket();
    showPage(meetingPage);
  } catch (error) {
    alert("Camera/microphone permission is required to start the meeting.");
  }
}

function renderScheduledCalls() {
  if (!scheduledCallsList) return;

  scheduledCallsList.innerHTML = "";

  scheduledCalls.forEach((call) => {
    const item = document.createElement("div");
    item.className = "call-item";
    item.innerHTML = `
      <div class="call-info">
        <div class="call-title">${escapeHtml(call.title)}</div>
        <div class="call-meta">
          Room ID: <span class="call-room">${escapeHtml(call.roomId)}</span> •
          ${escapeHtml(call.participants)} •
          ${escapeHtml(call.time)}
        </div>
      </div>
      <button class="join-call-btn" data-room="${escapeHtml(call.roomId)}" data-title="${escapeHtml(call.title)}">
        Join
      </button>
    `;

    scheduledCallsList.appendChild(item);
  });

  scheduledCallsList.querySelectorAll(".join-call-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const roomId = button.dataset.room;
      const title = button.dataset.title;
      roomInput.value = roomId;
      await joinRoom(roomId, title);
    });
  });
}

function getRecentCalls() {
  return JSON.parse(localStorage.getItem("recent_calls") || "[]");
}

function saveRecentCall(roomId, title) {
  const recentCalls = getRecentCalls();

  const newCall = {
    roomId,
    title,
    joinedAt: new Date().toLocaleString()
  };

  const updatedCalls = [
    newCall,
    ...recentCalls.filter((call) => call.roomId !== roomId)
  ].slice(0, 5);

  localStorage.setItem("recent_calls", JSON.stringify(updatedCalls));
}

function renderRecentCalls() {
  if (!recentCallsList) return;

  const recentCalls = getRecentCalls();

  if (recentCalls.length === 0) {
    recentCallsList.innerHTML = `<div class="empty-calls">No calls joined yet</div>`;
    return;
  }

  recentCallsList.innerHTML = "";

  recentCalls.forEach((call) => {
    const item = document.createElement("div");
    item.className = "call-item";
    item.innerHTML = `
      <div class="call-info">
        <div class="call-title">${escapeHtml(call.title)}</div>
        <div class="call-meta">
          Room ID: <span class="call-room">${escapeHtml(call.roomId)}</span> •
          Joined: ${escapeHtml(call.joinedAt)}
        </div>
      </div>
      <button class="join-call-btn" data-room="${escapeHtml(call.roomId)}" data-title="${escapeHtml(call.title)}">
        Rejoin
      </button>
    `;

    recentCallsList.appendChild(item);
  });

  recentCallsList.querySelectorAll(".join-call-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const roomId = button.dataset.room;
      const title = button.dataset.title;
      roomInput.value = roomId;
      await joinRoom(roomId, title);
    });
  });
}

async function startLocalMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;
}

function connectSocket() {
socket = io("https://realtime-commmunication-app.onrender.com", {
  auth: {
    token: authToken
  }
});
  socket.on("connect", () => {
    socket.emit("join-room", { roomId: currentRoomId });
    addChatMessage("System", "You joined the room", new Date().toLocaleTimeString());
  });

  socket.on("connect_error", (error) => {
    alert(`Socket error: ${error.message}`);
  });

  socket.on("existing-users", async (users) => {
    for (const user of users) {
      remoteUsers[user.socketId] = user;
      await createOfferForUser(user.socketId, user.name);
    }
  });

  socket.on("user-joined", (user) => {
    remoteUsers[user.socketId] = user;
    addChatMessage("System", `${user.name} joined the meeting`, new Date().toLocaleTimeString());
  });

  socket.on("room-users", (users) => {
    participantCount.textContent = `Participants: ${users.length}`;
  });

  socket.on("offer", async ({ from, offer, name }) => {
    remoteUsers[from] = { socketId: from, name };
    const peerConnection = createPeerConnection(from, name);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", {
      to: from,
      answer
    });
  });

  socket.on("answer", async ({ from, answer }) => {
    const peerConnection = peerConnections[from];

    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socket.on("ice-candidate", async ({ from, candidate }) => {
    const peerConnection = peerConnections[from];

    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  socket.on("user-left", ({ socketId }) => {
    removePeer(socketId);
    addChatMessage("System", "A user left the meeting", new Date().toLocaleTimeString());
  });

  socket.on("whiteboard-draw", (drawData) => {
    drawOnBoard(drawData, false);
  });

  socket.on("whiteboard-clear", () => {
    clearBoard(false);
  });

  socket.on("file-shared", (fileData) => {
    addFileItem(fileData);
  });

  socket.on("chat-message", ({ sender, message, time }) => {
    addChatMessage(sender, message, time);
  });
}

async function createOfferForUser(socketId, name) {
  const peerConnection = createPeerConnection(socketId, name);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", {
    to: socketId,
    offer
  });
}

function createPeerConnection(socketId, name) {
  if (peerConnections[socketId]) {
    return peerConnections[socketId];
  }

  const peerConnection = new RTCPeerConnection(rtcConfig);
  peerConnections[socketId] = peerConnection;

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        to: socketId,
        candidate: event.candidate
      });
    }
  };

  peerConnection.ontrack = (event) => {
    addRemoteVideo(socketId, name, event.streams[0]);
  };

  peerConnection.onconnectionstatechange = () => {
    if (
      peerConnection.connectionState === "failed" ||
      peerConnection.connectionState === "disconnected" ||
      peerConnection.connectionState === "closed"
    ) {
      removePeer(socketId);
    }
  };

  return peerConnection;
}

function addRemoteVideo(socketId, name, stream) {
  let card = document.getElementById(`video-card-${socketId}`);

  if (!card) {
    card = document.createElement("div");
    card.id = `video-card-${socketId}`;
    card.className = "video-card";

    const video = document.createElement("video");
    video.id = `video-${socketId}`;
    video.autoplay = true;
    video.playsInline = true;

    const label = document.createElement("div");
    label.className = "video-name";
    label.textContent = name || "Remote User";

    card.appendChild(video);
    card.appendChild(label);
    videos.appendChild(card);
  }

  const remoteVideo = document.getElementById(`video-${socketId}`);
  remoteVideo.srcObject = stream;
}

function removePeer(socketId) {
  if (peerConnections[socketId]) {
    peerConnections[socketId].close();
    delete peerConnections[socketId];
  }

  delete remoteUsers[socketId];

  const card = document.getElementById(`video-card-${socketId}`);
  if (card) {
    card.remove();
  }
}

toggleMicBtn.addEventListener("click", () => {
  if (!localStream) return;

  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = micEnabled;
  });

  toggleMicBtn.textContent = micEnabled ? "Mute" : "Unmute";
});

toggleCameraBtn.addEventListener("click", () => {
  if (!localStream) return;

  cameraEnabled = !cameraEnabled;
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = cameraEnabled;
  });

  toggleCameraBtn.textContent = cameraEnabled ? "Camera Off" : "Camera On";
});

screenShareBtn.addEventListener("click", async () => {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    replaceVideoTrack(screenTrack);
    localVideo.srcObject = screenStream;
    screenShareBtn.textContent = "Sharing Screen";

    screenTrack.onended = () => {
      const cameraTrack = localStream.getVideoTracks()[0];
      replaceVideoTrack(cameraTrack);
      localVideo.srcObject = localStream;
      screenShareBtn.textContent = "Share Screen";
    };
  } catch (error) {
    alert("Screen sharing cancelled or not supported.");
  }
});

function replaceVideoTrack(newTrack) {
  Object.values(peerConnections).forEach((peerConnection) => {
    const sender = peerConnection
      .getSenders()
      .find((item) => item.track && item.track.kind === "video");

    if (sender) {
      sender.replaceTrack(newTrack);
    }
  });
}

leaveBtn.addEventListener("click", () => {
  endMeeting();
});

function endMeeting() {
  Object.keys(peerConnections).forEach(removePeer);

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop());
    screenStream = null;
  }

  videos.querySelectorAll(".video-card:not(.local-card)").forEach((card) => card.remove());
  renderRecentCalls();
  showPage(dashboardPage);
}

chatTab.addEventListener("click", () => {
  chatTab.classList.add("active");
  filesTab.classList.remove("active");
  chatPanel.classList.remove("hidden");
  filesPanel.classList.add("hidden");
});

filesTab.addEventListener("click", () => {
  filesTab.classList.add("active");
  chatTab.classList.remove("active");
  filesPanel.classList.remove("hidden");
  chatPanel.classList.add("hidden");
});

sendChatBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChatMessage();
  }
});

function sendChatMessage() {
  const message = chatInput.value.trim();

  if (!message || !socket) return;

  socket.emit("chat-message", message);
  chatInput.value = "";
}

function addChatMessage(sender, message, time) {
  const item = document.createElement("div");
  item.className = "chat-message";
  item.innerHTML = `<strong>${escapeHtml(sender)}</strong>: ${escapeHtml(message)} <span>${escapeHtml(time || "")}</span>`;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

uploadFileBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    alert("Choose a file first");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "File upload failed");
      return;
    }

    const fileData = {
      name: data.file.originalName,
      url: data.file.url,
      sharedBy: currentUser.name
    };

    addFileItem(fileData);
    socket.emit("file-shared", fileData);
    fileInput.value = "";
  } catch (error) {
    alert("File upload failed");
  }
});

function addFileItem(fileData) {
  const item = document.createElement("div");
  item.className = "file-item";
  item.innerHTML = `
    <a href="${fileData.url}" target="_blank">${escapeHtml(fileData.name)}</a>
    <div>Shared by: ${escapeHtml(fileData.sharedBy || "User")}</div>
  `;
  filesList.prepend(item);
}

whiteboardBtn.addEventListener("click", () => {
  whiteboardModal.classList.remove("hidden");
  resizeCanvas();
});

closeBoardBtn.addEventListener("click", () => {
  whiteboardModal.classList.add("hidden");
});

clearBoardBtn.addEventListener("click", () => {
  clearBoard(true);
});

function resizeCanvas() {
  const rect = whiteboardCanvas.getBoundingClientRect();
  const imageData = boardContext.getImageData(0, 0, whiteboardCanvas.width || 1, whiteboardCanvas.height || 1);

  whiteboardCanvas.width = rect.width;
  whiteboardCanvas.height = rect.height;

  if (imageData.width > 1 && imageData.height > 1) {
    boardContext.putImageData(imageData, 0, 0);
  }
}

window.addEventListener("resize", () => {
  if (!whiteboardModal.classList.contains("hidden")) {
    resizeCanvas();
  }
});

let drawing = false;
let lastPoint = null;

whiteboardCanvas.addEventListener("mousedown", startDrawing);
whiteboardCanvas.addEventListener("mousemove", continueDrawing);
whiteboardCanvas.addEventListener("mouseup", stopDrawing);
whiteboardCanvas.addEventListener("mouseleave", stopDrawing);

whiteboardCanvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  startDrawing(event.touches[0]);
});

whiteboardCanvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  continueDrawing(event.touches[0]);
});

whiteboardCanvas.addEventListener("touchend", stopDrawing);

function getCanvasPoint(event) {
  const rect = whiteboardCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function startDrawing(event) {
  drawing = true;
  lastPoint = getCanvasPoint(event);
}

function continueDrawing(event) {
  if (!drawing || !lastPoint) return;

  const currentPoint = getCanvasPoint(event);

  const drawData = {
    fromX: lastPoint.x / whiteboardCanvas.width,
    fromY: lastPoint.y / whiteboardCanvas.height,
    toX: currentPoint.x / whiteboardCanvas.width,
    toY: currentPoint.y / whiteboardCanvas.height,
    color: penColor.value,
    size: Number(penSize.value)
  };

  drawOnBoard(drawData, true);
  lastPoint = currentPoint;
}

function stopDrawing() {
  drawing = false;
  lastPoint = null;
}

function drawOnBoard(drawData, shouldEmit) {
  boardContext.strokeStyle = drawData.color;
  boardContext.lineWidth = drawData.size;
  boardContext.lineCap = "round";

  boardContext.beginPath();
  boardContext.moveTo(
    drawData.fromX * whiteboardCanvas.width,
    drawData.fromY * whiteboardCanvas.height
  );
  boardContext.lineTo(
    drawData.toX * whiteboardCanvas.width,
    drawData.toY * whiteboardCanvas.height
  );
  boardContext.stroke();

  if (shouldEmit && socket) {
    socket.emit("whiteboard-draw", drawData);
  }
}

function clearBoard(shouldEmit) {
  boardContext.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);

  if (shouldEmit && socket) {
    socket.emit("whiteboard-clear");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadDashboard();
