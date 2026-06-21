# Real-Time Communication App

A runnable internship MVP for video conferencing and collaboration.

## Features

- JWT login/register
- WebRTC video call
- Multiple video boxes
- Screen sharing
- Socket.io real-time signaling
- Chat
- File sharing
- Whiteboard drawing and clearing
- Basic security explanation: JWT + WebRTC DTLS-SRTP encrypted media

## How to Run in VS Code

### 1. Open this folder in VS Code

Open the folder:

```text
realtime-communication-app
```

### 2. Install dependencies

Open VS Code terminal and run:

```bash
npm install
```

### 3. Start server

```bash
npm start
```

### 4. Open browser

Open:

```text
http://localhost:5000
```

### 5. Test video call

Open two browser tabs or two different browsers.

Example:

- Tab 1: Register/Login as user1
- Tab 2: Register/Login as user2
- Use same Room ID: `room101`
- Click Start Meeting in both tabs

## Important Notes

This is a demo MVP.

- Users are stored in memory.
- If server restarts, registered users disappear.
- For final production, use MongoDB/Firebase for permanent users.
- WebRTC media is encrypted by default through DTLS-SRTP.
- JWT is used for authentication.
