// login/login.js

// ====== SIMPLE AUTH STATE ======
const AUTH_KEY = "youomni_user";

// fake "database" for demo (later будет сервер)
const fakeUsers = [];

// ====== HELPERS ======
function saveUser(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function getUser() {
  return JSON.parse(localStorage.getItem(AUTH_KEY));
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  location.reload();
}

// ====== AUTH ACTIONS ======
function loginWithEmail(email, password) {
  const user = fakeUsers.find(
    (u) => u.email === email && u.password === password
  );

  if (!user) {
    alert("Invalid email or password");
    return false;
  }

  saveUser(user);
  return true;
}

function signupWithEmail(email, password) {
  const exists = fakeUsers.some((u) => u.email === email);

  if (exists) {
    alert("User already exists");
    return false;
  }

  const newUser = { email, password, paid: false };
  fakeUsers.push(newUser);
  saveUser(newUser);

  return true;
}

// fake Google login (заглушка)
function loginWithGoogle() {
  const googleUser = {
    email: "google_user@youomni.com",
    provider: "google",
    paid: false,
  };

  saveUser(googleUser);
  return true;
}

// ====== ACCESS CHECK ======
function checkAccess(requiredPaid = true) {
  const user = getUser();

  if (!user) return false;
  if (requiredPaid && !user.paid) return false;

  return true;
}

// ====== UI LOGIC (overlay) ======
function showLoginOverlay() {
  const overlay = document.getElementById("login-overlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoginOverlay() {
  const overlay = document.getElementById("login-overlay");
  if (overlay) overlay.style.display = "none";
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();

  // если нет логина — показываем оверлей
  if (!user) {
    showLoginOverlay();
  } else {
    hideLoginOverlay();
  }

  // buttons
  const googleBtn = document.getElementById("google-login");
  const emailBtn = document.getElementById("email-login");
  const signupBtn = document.getElementById("signup-btn");

  if (googleBtn) {
    googleBtn.onclick = () => {
      loginWithGoogle();
      hideLoginOverlay();
    };
  }

  if (emailBtn) {
    emailBtn.onclick = () => {
      const email = document.getElementById("email")?.value;
      const pass = document.getElementById("password")?.value;

      if (loginWithEmail(email, pass)) {
        hideLoginOverlay();
      }
    };
  }

  if (signupBtn) {
    signupBtn.onclick = () => {
      const email = document.getElementById("email")?.value;
      const pass = document.getElementById("password")?.value;

      signupWithEmail(email, pass);
    };
  }
});

// ====== EXPORT (for lesson pages) ======
window.YouOmniAuth = {
  checkAccess,
  logout,
  getUser,
};