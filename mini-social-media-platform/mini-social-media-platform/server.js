const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });
const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_for_production";

const DB_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DB_DIR, "db.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("uploads"));
function ensureDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: [],
      posts: [],
      comments: [],
      likes: [],
      followers: []
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readDB() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function generateId() {
  return crypto.randomUUID();
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    avatar: user.avatar || "",
    createdAt: user.createdAt
  };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication token missing" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function enrichPost(post, db, currentUserId = null) {
  const author = db.users.find((user) => user.id === post.userId);
  const comments = db.comments
    .filter((comment) => comment.postId === post.id)
    .map((comment) => {
      const commentAuthor = db.users.find((user) => user.id === comment.userId);

      return {
        ...comment,
        author: publicUser(commentAuthor)
      };
    });

  const likes = db.likes.filter((like) => like.postId === post.id);
  const isLiked = currentUserId
    ? likes.some((like) => like.userId === currentUserId)
    : false;

  return {
    ...post,
    author: publicUser(author),
    comments,
    likesCount: likes.length,
    commentsCount: comments.length,
    isLiked
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Mini Social Media API is running" });
});

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  const db = readDB();

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  if (password.length < 4) {
    return res.status(400).json({ message: "Password must be at least 4 characters" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = db.users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    return res.status(409).json({ message: "User already exists. Please login." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = {
    id: generateId(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    bio: "New social media user",
    avatar: "",
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  res.json({
    message: "Registered successfully",
    token: createToken(newUser),
    user: publicUser(newUser)
  });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const db = readDB();

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((item) => item.email === normalizedEmail);

  if (!user) {
    return res.status(401).json({ message: "User not found. Register first." });
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    return res.status(401).json({ message: "Invalid password" });
  }

  res.json({
    message: "Logged in successfully",
    token: createToken(user),
    user: publicUser(user)
  });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((item) => item.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const followersCount = db.followers.filter((item) => item.followingId === user.id).length;
  const followingCount = db.followers.filter((item) => item.followerId === user.id).length;
  const postsCount = db.posts.filter((post) => post.userId === user.id).length;

  res.json({
    user: {
      ...publicUser(user),
      followersCount,
      followingCount,
      postsCount
    }
  });
});

app.put("/api/profile", authMiddleware, (req, res) => {
  const { name, bio, avatar } = req.body;
  const db = readDB();

  const user = db.users.find((item) => item.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (name !== undefined) user.name = String(name).trim() || user.name;
  if (bio !== undefined) user.bio = String(bio).trim();
  if (avatar !== undefined) user.avatar = String(avatar).trim();

  writeDB(db);

  res.json({
    message: "Profile updated successfully",
    user: publicUser(user)
  });
});

app.get("/api/users", authMiddleware, (req, res) => {
  const db = readDB();
  const q = String(req.query.q || "").toLowerCase();

  const users = db.users
    .filter((user) => {
      if (!q) return true;

      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    })
    .filter((user) => user.id !== req.user.id)
    .map((user) => {
      const isFollowing = db.followers.some(
        (item) => item.followerId === req.user.id && item.followingId === user.id
      );

      return {
        ...publicUser(user),
        followersCount: db.followers.filter((item) => item.followingId === user.id).length,
        followingCount: db.followers.filter((item) => item.followerId === user.id).length,
        isFollowing
      };
    });

  res.json({ users });
});

app.get("/api/users/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((item) => item.id === req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const isFollowing = db.followers.some(
    (item) => item.followerId === req.user.id && item.followingId === user.id
  );

  res.json({
    user: {
      ...publicUser(user),
      followersCount: db.followers.filter((item) => item.followingId === user.id).length,
      followingCount: db.followers.filter((item) => item.followerId === user.id).length,
      postsCount: db.posts.filter((post) => post.userId === user.id).length,
      isFollowing
    }
  });
});

app.post("/api/users/:id/follow", authMiddleware, (req, res) => {
  const db = readDB();
  const followingId = req.params.id;
  const followerId = req.user.id;

  if (followingId === followerId) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  const userToFollow = db.users.find((user) => user.id === followingId);

  if (!userToFollow) {
    return res.status(404).json({ message: "User not found" });
  }

  const existingFollow = db.followers.find(
    (item) => item.followerId === followerId && item.followingId === followingId
  );

  if (existingFollow) {
    db.followers = db.followers.filter((item) => item.id !== existingFollow.id);
    writeDB(db);

    return res.json({
      message: "Unfollowed successfully",
      isFollowing: false
    });
  }

  db.followers.push({
    id: generateId(),
    followerId,
    followingId,
    createdAt: new Date().toISOString()
  });

  writeDB(db);

  res.json({
    message: "Followed successfully",
    isFollowing: true
  });
});

app.post("/api/posts", authMiddleware, upload.single("image"), (req, res) => {
 const { content, image } = req.body;
  const db = readDB();

  if (!content || !String(content).trim()) {
    return res.status(400).json({ message: "Post content is required" });
  }

  const post = {
  id: generateId(),
  userId: req.user.id,
  content: String(content).trim(),
  image: req.file ? `/uploads/${req.file.filename}` : "",
  createdAt: new Date().toISOString()
};
  

  db.posts.unshift(post);
  writeDB(db);

  res.json({
    message: "Post created successfully",
    post: enrichPost(post, db, req.user.id)
  });
});

app.get("/api/posts", authMiddleware, (req, res) => {
  const db = readDB();

  const posts = db.posts
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((post) => enrichPost(post, db, req.user.id));

  res.json({ posts });
});

app.get("/api/users/:id/posts", authMiddleware, (req, res) => {
  const db = readDB();

  const posts = db.posts
    .filter((post) => post.userId === req.params.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((post) => enrichPost(post, db, req.user.id));

  res.json({ posts });
});

app.post("/api/posts/:id/like", authMiddleware, (req, res) => {
  const db = readDB();
  const postId = req.params.id;
  const userId = req.user.id;

  const post = db.posts.find((item) => item.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  const existingLike = db.likes.find(
    (item) => item.postId === postId && item.userId === userId
  );

  if (existingLike) {
    db.likes = db.likes.filter((item) => item.id !== existingLike.id);
    writeDB(db);

    return res.json({
      message: "Post unliked",
      isLiked: false,
      likesCount: db.likes.filter((item) => item.postId === postId).length
    });
  }

  db.likes.push({
    id: generateId(),
    postId,
    userId,
    createdAt: new Date().toISOString()
  });

  writeDB(db);

  res.json({
    message: "Post liked",
    isLiked: true,
    likesCount: db.likes.filter((item) => item.postId === postId).length
  });
});

app.post("/api/posts/:id/comment", authMiddleware, (req, res) => {
  const { content } = req.body;
  const db = readDB();
  const postId = req.params.id;

  const post = db.posts.find((item) => item.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (!content || !String(content).trim()) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  const comment = {
    id: generateId(),
    postId,
    userId: req.user.id,
    content: String(content).trim(),
    createdAt: new Date().toISOString()
  };

  db.comments.push(comment);
  writeDB(db);

  const author = db.users.find((user) => user.id === req.user.id);

  res.json({
    message: "Comment added successfully",
    comment: {
      ...comment,
      author: publicUser(author)
    }
  });
});


app.delete("/api/posts/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const post = db.posts.find((item) => item.id === req.params.id);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.userId !== req.user.id) {
    return res.status(403).json({ message: "You can delete only your own post" });
  }

  db.posts = db.posts.filter((item) => item.id !== post.id);
  db.comments = db.comments.filter((item) => item.postId !== post.id);
  db.likes = db.likes.filter((item) => item.postId !== post.id);

  writeDB(db);

  res.json({ message: "Post deleted successfully" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureDatabase();

app.listen(PORT, () => {
  console.log(`Mini Social Media Platform running at http://localhost:${PORT}`);
});
