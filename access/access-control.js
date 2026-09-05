const USER_KEY = "youomni_user";
const ACCESS_KEY = "youomni_access";

function isLoggedIn() {
  return localStorage.getItem(USER_KEY) === "true";
}

function requireAuth(redirectPath) {
  if (!isLoggedIn()) {
    window.location.href = "/login/login.html?redirect=" + redirectPath;
  }
}

function getAccess() {
  const data = localStorage.getItem(ACCESS_KEY);
  return data ? JSON.parse(data) : {
    lesson1: false,
    fullCourse: false
  };
}

function hasAccess(lessonId) {
  const access = getAccess();

  if (lessonId === "index") return true;
  if (access.fullCourse) return true;
  if (lessonId === "lesson1" && access.lesson1) return true;

  return false;
}

function protectPage(lessonId, path) {
  requireAuth(path);

  if (!hasAccess(lessonId)) {
    alert("This lesson is locked");
    window.location.href = "/index.html";
  }
}

/* purchase simulation */
function buyLesson1() {
  const access = getAccess();
  access.lesson1 = true;
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}

function buyFullCourse() {
  const access = getAccess();
  access.fullCourse = true;
  access.lesson1 = true;
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}