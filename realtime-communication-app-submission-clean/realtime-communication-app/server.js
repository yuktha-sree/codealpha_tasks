const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_for_production";

// Demo storage only.
// For a real project, replace these Maps with MongoDB/Firebase/PostgreSQL.
const users = new Map(); 
const roomUsers = new Map();

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadsDir));

function createToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function verifyTokenFromHeader(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (users.has(normalizedEmail)) {
      return res.status(409).json({ message: "User already exists. Please login." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    };

    users.set(normalizedEmail, user);

    return res.json({
      message: "Registered successfully",
      token: createToken(user),
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = users.get(normalizedEmail);

    if (!user) {
      return res.status(401).json({ message: "User not found. Please register first." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    return res.json({
      message: "Logged in successfully",
      token: createToken(user),
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
});

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

app.post("/api/upload", verifyTokenFromHeader, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const fileUrl = `/uploads/${req.file.filename}`;

  return res.json({
    message: "File uploaded successfully",
    file: {
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      uploadedBy: req.user.name
    }
  });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    return next();
  } catch {
    return next(new Error("Invalid authentication token"));
  }
});

function getUsersInRoom(roomId) {
  return roomUsers.get(roomId) || [];
}

function addUserToRoom(roomId, user) {
  const currentUsers = getUsersInRoom(roomId);
  roomUsers.set(roomId, [...currentUsers, user]);
}

function removeUserFromRooms(socketId) {
  for (const [roomId, usersList] of roomUsers.entries()) {
    const updatedUsers = usersList.filter((user) => user.socketId !== socketId);

    if (updatedUsers.length === 0) {
      roomUsers.delete(roomId);
    } else {
      roomUsers.set(roomId, updatedUsers);
    }

    if (updatedUsers.length !== usersList.length) {
      io.to(roomId).emit("user-left", { socketId });
      io.to(roomId).emit("room-users", updatedUsers);
    }
  }
}

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId }) => {
    if (!roomId) return;

    const existingUsers = getUsersInRoom(roomId);

    socket.join(roomId);
    socket.roomId = roomId;

    const joiningUser = {
      socketId: socket.id,
      userId: socket.user.id,
      name: socket.user.name,
      email: socket.user.email
    };

    addUserToRoom(roomId, joiningUser);

    socket.emit("existing-users", existingUsers);
    socket.to(roomId).emit("user-joined", joiningUser);
    io.to(roomId).emit("room-users", getUsersInRoom(roomId));
  });

  socket.on("offer", ({ to, offer }) => {
    socket.to(to).emit("offer", {
      from: socket.id,
      name: socket.user.name,
      offer
    });
  });

  socket.on("answer", ({ to, answer }) => {
    socket.to(to).emit("answer", {
      from: socket.id,
      answer
    });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("ice-candidate", {
      from: socket.id,
      candidate
    });
  });

  socket.on("whiteboard-draw", (drawData) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("whiteboard-draw", drawData);
  });

  socket.on("whiteboard-clear", () => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("whiteboard-clear");
  });

  socket.on("file-shared", (fileData) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("file-shared", {
      ...fileData,
      sharedBy: socket.user.name
    });
  });

  socket.on("chat-message", (message) => {
    if (!socket.roomId) return;
    io.to(socket.roomId).emit("chat-message", {
      message,
      sender: socket.user.name,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on("disconnect", () => {
    removeUserFromRooms(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
