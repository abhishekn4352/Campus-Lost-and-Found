// Apply the saved (or system) theme before first paint so there is no flash
// of the wrong theme. Kept as a separate file (not inline) so the site's
// Content-Security-Policy can forbid inline scripts altogether.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
})();
