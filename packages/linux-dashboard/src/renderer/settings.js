(function () {
  var alwaysOnTop = document.getElementById('alwaysOnTop');
  var launchAtLogin = document.getElementById('launchAtLogin');
  var opacity = document.getElementById('opacity');
  var opacityLabel = document.getElementById('opacityLabel');
  var version = document.getElementById('version');
  var commitTimer = null;

  function updateLabel() {
    opacityLabel.textContent = Math.round(Number(opacity.value) * 100) + '%';
  }

  window.classroomSettings.get().then(function (state) {
    alwaysOnTop.checked = state.alwaysOnTop === true;
    launchAtLogin.checked = state.launchAtLogin === true;
    opacity.value = Math.min(1, Math.max(0.2, Number(state.backgroundOpacity) || 1));
    updateLabel();
  });

  version.textContent = 'Classroom Widgets for Linux v' + (window.__CLASSROOM_SETTINGS_VERSION__ || '0.0.0');

  alwaysOnTop.addEventListener('change', function () {
    window.classroomSettings.set({ alwaysOnTop: alwaysOnTop.checked });
  });
  launchAtLogin.addEventListener('change', function () {
    window.classroomSettings.set({ launchAtLogin: launchAtLogin.checked });
  });
  opacity.addEventListener('input', function () {
    updateLabel();
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(function () {
      window.classroomSettings.set({ backgroundOpacity: Number(opacity.value) });
    }, 250);
  });
  document.getElementById('reset').addEventListener('click', function () {
    window.classroomSettings.resetPositions();
  });
})();
