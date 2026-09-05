/**
 * YouOmni Access Control System
 * Handles:
 * - Auth check
 * - Trial access (index.html)
 * - Lesson1 purchase ($9)
 * - Full course purchase ($199)
 * - Upgrade logic
 */

const ACCESS_KEY = "youomni_access";
const USER_KEY = "youomni_user";

/**
 * Default structure stored in localStorage
 */
function getAccessData() {
  const data = localStorage.getItem(ACCESS_KEY);
  if (!data) {
    return {
      lesson1: false,
      fullCourse: false
    };
  }
  return JSON.parse(data);
}

/**
 * Save access data
 */
function setAccessData(data) {
  localStorage.setItem(ACCESS_KEY, JSON.stringify(data));
}

/**
 * Check if user is logged in
 */
function isLoggedIn() {
  return localStorage.getItem(USER_KEY) === "true";
}

/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "/login/login.html";
  }
}

/**
 * Check access for a lesson
 * @param {string} lessonId - "index", "lesson1", "lesson2"...
 */
function hasAccess(lessonId) {
  const access = getAccessData();

  // Trial lesson is always free
  if (lessonId === "index") return true;

  // Full course unlocks everything
  if (access.fullCourse) return true;

  // Individual lesson unlock
  if (lessonId === "lesson1" && access.lesson1) return true;

  return false;
}

/**
 * Lock lesson page if no access
 */
function protectLesson(lessonId) {
  requireAuth();

  if (!hasAccess(lessonId)) {
    // Simple behavior: send to login page (later we can upgrade to paywall UI)
    window.location.href = "/login/login.html?reason=locked";
  }
}

/**
 * Purchase lesson1 only ($9)
 */
function buyLesson1() {
  const access = getAccessData();
  access.lesson1 = true;
  setAccessData(access);
}

/**
 * Purchase full course ($199)
 */
function buyFullCourse() {
  const access = getAccessData();
  access.fullCourse = true;
  access.lesson1 = true; // full course includes lesson1
  setAccessData(access);
}

/**
 * Upgrade from lesson1 ($9) to full course ($190 difference)
 */
function upgradeToFullCourse() {
  buyFullCourse();
}

/**
 * Reset access (for testing only)
 */
function resetAccess() {
  localStorage.removeItem(ACCESS_KEY);
}

/**
 * INIT FUNCTION (call on every lesson page)
 */
function initAccessControl(lessonId) {
  protectLesson(lessonId);
}
