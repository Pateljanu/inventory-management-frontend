// Applies the saved theme before first paint so there is no light-to-dark flash. A separate file
// (not an inline script) so the server's Content-Security-Policy can allow only its own scripts.
try {
  var t = localStorage.getItem("metalix.theme") || "system"
  var dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.add(dark ? "dark" : "light")
  if (!dark && localStorage.getItem("metalix.sunlight") === "1") document.documentElement.classList.add("contrast")
  if (localStorage.getItem("metalix.motion") === "reduced") document.documentElement.dataset.motion = "reduced"
} catch (e) {}
