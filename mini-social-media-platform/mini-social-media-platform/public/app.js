let isRegisterMode = false;
let authToken = localStorage.getItem("social_token") || "";
let currentUser = JSON.parse(localStorage.getItem("social_user") || "null");

const authPage = document.getElementById("authPage");
const appPage = document.getElementById("appPage");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authForm = document.getElementById("authForm");
const nameGroup = document.getElementById("nameGroup");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMessage = document.getElementById("authMessage");

const feedNav = document.getElementById("feedNav");
const profileNav = document.getElementById("profileNav");
const peopleNav = document.getElementById("peopleNav");
const logoutBtn = document.getElementById("logoutBtn");

const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const currentUserBadge = document.getElementById("currentUserBadge");

const feedView = document.getElementById("feedView");
const profileView = document.getElementById("profileView");
const peopleView = document.getElementById("peopleView");

const postInput = document.getElementById("postInput");
const imageInput = document.getElementById("imageInput");
const createPostBtn = document.getElementById("createPostBtn");
const postsList = document.getElementById("postsList");

const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileBio = document.getElementById("profileBio");
const profilePostsCount = document.getElementById("profilePostsCount");
const profileFollowersCount = document.getElementById("profileFollowersCount");
const profileFollowingCount = document.getElementById("profileFollowingCount");
const editNameInput = document.getElementById("editNameInput");
const editBioInput = document.getElementById("editBioInput");
const editAvatarInput = document.getElementById("editAvatarInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const myPostsList = document.getElementById("myPostsList");

const userSearchInput = document.getElementById("userSearchInput");
const searchUsersBtn = document.getElementById("searchUsersBtn");
const usersList = document.getElementById("usersList");

function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
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

function showApp() {
  authPage.classList.add("hidden");
  appPage.classList.remove("hidden");
  currentUserBadge.textContent = currentUser ? currentUser.name : "User";
}

function showAuth() {
  appPage.classList.add("hidden");
  authPage.classList.remove("hidden");
}

function setActiveNav(activeButton) {
  [feedNav, profileNav, peopleNav].forEach((button) => {
    button.classList.remove("active");
  });

  activeButton.classList.add("active");
}

function showView(viewName) {
  feedView.classList.add("hidden");
  profileView.classList.add("hidden");
  peopleView.classList.add("hidden");

  if (viewName === "feed") {
    feedView.classList.remove("hidden");
    setActiveNav(feedNav);
    pageTitle.textContent = "Feed";
    pageSubtitle.textContent = "See posts from all users";
    loadFeed();
  }

  if (viewName === "profile") {
    profileView.classList.remove("hidden");
    setActiveNav(profileNav);
    pageTitle.textContent = "My Profile";
    pageSubtitle.textContent = "Manage your profile and posts";
    loadProfile();
  }

  if (viewName === "people") {
    peopleView.classList.remove("hidden");
    setActiveNav(peopleNav);
    pageTitle.textContent = "People";
    pageSubtitle.textContent = "Find users and follow them";
    loadUsers();
  }
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
      showAuthMessage("Name is required", true);
      return;
    }
  }

  const endpoint = isRegisterMode ? "/api/register" : "/api/login";

  try {
    const data = await apiRequest(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    authToken = data.token;
    currentUser = data.user;

    localStorage.setItem("social_token", authToken);
    localStorage.setItem("social_user", JSON.stringify(currentUser));

    showAuthMessage(data.message);
    showApp();
    showView("feed");
  } catch (error) {
    showAuthMessage(error.message, true);
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("social_token");
  localStorage.removeItem("social_user");
  authToken = "";
  currentUser = null;
  window.location.reload();
});

feedNav.addEventListener("click", () => showView("feed"));
profileNav.addEventListener("click", () => showView("profile"));
peopleNav.addEventListener("click", () => showView("people"));

createPostBtn.addEventListener("click", async () => {
  const content = postInput.value.trim();
  const file = imageInput.files[0];

  if (!content) {
    alert("Write something before posting");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("content", content);

    if (file) {
      formData.append("image", file);
    }

    await fetch("/api/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: formData
    });

    postInput.value = "";
    imageInput.value = "";

    loadFeed();
  } catch (error) {
    alert(error.message);
  }
});
saveProfileBtn.addEventListener("click", async () => {
  const payload = {
    name: editNameInput.value.trim(),
    bio: editBioInput.value.trim(),
    avatar: editAvatarInput.value.trim()
  };

  try {
    const data = await apiRequest("/api/profile", {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    currentUser = data.user;
    localStorage.setItem("social_user", JSON.stringify(currentUser));
    currentUserBadge.textContent = currentUser.name;

    alert("Profile updated successfully");
    loadProfile();
    loadFeed();
  } catch (error) {
    alert(error.message);
  }
});

searchUsersBtn.addEventListener("click", () => {
  loadUsers(userSearchInput.value.trim());
});

userSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadUsers(userSearchInput.value.trim());
  }
});

async function loadFeed() {
  try {
    const data = await apiRequest("/api/posts", {
      headers: getHeaders()
    });

    renderPosts(data.posts, postsList);
  } catch (error) {
    postsList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function loadProfile() {
  try {
    const data = await apiRequest("/api/me", {
      headers: getHeaders()
    });

    const user = data.user;
    currentUser = user;
    localStorage.setItem("social_user", JSON.stringify(user));

    profileName.textContent = user.name;
    profileEmail.textContent = user.email;
    profileBio.textContent = user.bio || "No bio added";
    profilePostsCount.textContent = user.postsCount;
    profileFollowersCount.textContent = user.followersCount;
    profileFollowingCount.textContent = user.followingCount;

    editNameInput.value = user.name || "";
    editBioInput.value = user.bio || "";
    editAvatarInput.value = user.avatar || "";

    renderAvatar(profileAvatar, user);

    const postsData = await apiRequest(`/api/users/${user.id}/posts`, {
      headers: getHeaders()
    });

    renderPosts(postsData.posts, myPostsList);
  } catch (error) {
    alert(error.message);
  }
}

async function loadUsers(query = "") {
  try {
    const data = await apiRequest(`/api/users?q=${encodeURIComponent(query)}`, {
      headers: getHeaders()
    });

    renderUsers(data.users);
  } catch (error) {
    usersList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = `<div class="empty-state">No users found</div>`;
    return;
  }

  usersList.innerHTML = users
    .map((user) => {
      return `
        <div class="user-card">
          <div class="user-card-header">
            ${avatarHtml(user)}
            <div>
              <h3>${escapeHtml(user.name)}</h3>
              <p class="user-email">${escapeHtml(user.email)}</p>
            </div>
          </div>

          <p>${escapeHtml(user.bio || "No bio added")}</p>

          <div class="profile-stats">
            <span><strong>${user.followersCount}</strong> Followers</span>
            <span><strong>${user.followingCount}</strong> Following</span>
          </div>

          <button 
            class="follow-btn ${user.isFollowing ? "following" : ""}" 
            onclick="toggleFollow('${user.id}')"
          >
            ${user.isFollowing
  ? '<i class="fa-solid fa-user-check"></i> Following'
  : '<i class="fa-solid fa-user-plus"></i> Follow'
}
          </button>
        </div>
      `;
    })
    .join("");
}

async function toggleFollow(userId) {
  try {
    await apiRequest(`/api/users/${userId}/follow`, {
      method: "POST",
      headers: getHeaders()
    });

    loadUsers(userSearchInput.value.trim());
    loadProfile();
  } catch (error) {
    alert(error.message);
  }
}

function renderPosts(posts, container) {
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state">No posts yet</div>`;
    return;
  }

  container.innerHTML = posts.map((post) => postHtml(post)).join("");
}

function postHtml(post) {
  const canDelete = currentUser && post.userId === currentUser.id;

  return `
    <article class="post-card">
      <div class="post-header">
        <div class="author">
          ${avatarHtml(post.author)}
          <div>
            <div class="author-name">${escapeHtml(post.author?.name || "Unknown User")}</div>
            <div class="post-date">${formatDate(post.createdAt)}</div>
          </div>
        </div>

        ${canDelete
  ? `<button class="delete-btn" onclick="deletePost('${post.id}')">
       <i class="fa-solid fa-trash"></i> Delete
     </button>`
  : ""
}
      </div>

      <div class="post-content">
  ${escapeHtml(post.content)}
</div>

${post.image ? `
  <img
    src="${post.image}"
    alt="Post Image"
    style="width:100%; max-height:400px; object-fit:cover; border-radius:10px; margin-top:10px;"
  />
` : ""}

      <div class="post-actions">
        <button 
          class="action-btn ${post.isLiked ? "liked" : ""}" 
          onclick="toggleLike('${post.id}')"
        >
         ${post.isLiked
  ? '<i class="fa-solid fa-heart"></i> Liked'
  : '<i class="fa-regular fa-heart"></i> Like'
}
(${post.likesCount})
        </button>

        <button class="action-btn" onclick="focusComment('${post.id}')">
  <i class="fa-regular fa-comment"></i>
  Comments (${post.commentsCount})
</button>
      </div>

      <div class="comments">
        ${commentsHtml(post.comments)}
        <div class="comment-form">
          <input id="comment-${post.id}" type="text" placeholder="Write a comment..." />
          <button class="primary-btn" onclick="addComment('${post.id}')">Comment</button>
        </div>
      </div>
    </article>
  `;
}

function commentsHtml(comments) {
  if (!comments.length) {
    return `<div class="comment">No comments yet</div>`;
  }

  return comments
    .map((comment) => {
      return `
        <div class="comment">
          <strong>${escapeHtml(comment.author?.name || "User")}:</strong>
          ${escapeHtml(comment.content)}
        </div>
      `;
    })
    .join("");
}

async function toggleLike(postId) {
  try {
    await apiRequest(`/api/posts/${postId}/like`, {
      method: "POST",
      headers: getHeaders()
    });

    refreshCurrentView();
  } catch (error) {
    alert(error.message);
  }
}

async function addComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  const content = input.value.trim();

  if (!content) {
    alert("Write a comment first");
    return;
  }

  try {
    await apiRequest(`/api/posts/${postId}/comment`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ content })
    });

    input.value = "";
    refreshCurrentView();
  } catch (error) {
    alert(error.message);
  }
}

async function deletePost(postId) {
  const confirmDelete = confirm("Delete this post?");

  if (!confirmDelete) return;

  try {
    await apiRequest(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: getHeaders()
    });

    refreshCurrentView();
  } catch (error) {
    alert(error.message);
  }
}

function focusComment(postId) {
  const input = document.getElementById(`comment-${postId}`);
  if (input) input.focus();
}

function refreshCurrentView() {
  if (!feedView.classList.contains("hidden")) {
    loadFeed();
    return;
  }

  if (!profileView.classList.contains("hidden")) {
    loadProfile();
  }
}

function avatarHtml(user) {
  const firstLetter = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  if (user?.avatar) {
    return `
      <div class="avatar">
        <img src="${escapeAttribute(user.avatar)}" alt="${escapeAttribute(user.name || "User")}" />
      </div>
    `;
  }

  return `<div class="avatar">${escapeHtml(firstLetter)}</div>`;
}

function renderAvatar(element, user) {
  const firstLetter = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  if (user?.avatar) {
    element.innerHTML = `<img src="${escapeAttribute(user.avatar)}" alt="${escapeAttribute(user.name)}" />`;
    return;
  }

  element.textContent = firstLetter;
}

function formatDate(dateString) {
  const date = new Date(dateString);

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

window.toggleFollow = toggleFollow;
window.toggleLike = toggleLike;
window.addComment = addComment;
window.deletePost = deletePost;
window.focusComment = focusComment;

async function bootApp() {
  if (!authToken || !currentUser) {
    showAuth();
    return;
  }

  try {
    const data = await apiRequest("/api/me", {
      headers: getHeaders()
    });

    currentUser = data.user;
    localStorage.setItem("social_user", JSON.stringify(currentUser));
    showApp();
    showView("feed");
  } catch {
    localStorage.removeItem("social_token");
    localStorage.removeItem("social_user");
    showAuth();
  }
}

bootApp();
