(function () {
  var alwaysOnTop = document.getElementById('alwaysOnTop');
  var launchAtLogin = document.getElementById('launchAtLogin');
  var opacity = document.getElementById('opacity');
  var opacityLabel = document.getElementById('opacityLabel');
  var version = document.getElementById('version');
  var provider = document.getElementById('shortenerProvider');
  var apiKey = document.getElementById('shortioApiKey');
  var domain = document.getElementById('shortioDomain');
  var shortioFields = document.getElementById('shortioFields');
  var commitTimer = null;

  function saveShortener() {
    shortioFields.hidden = provider.value !== 'shortio';
    window.classroomSettings.set({ linkShortener: {
      provider: provider.value,
      shortioApiKey: apiKey.value.trim(),
      shortioDomain: domain.value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    } });
  }

  function updateLabel() {
    opacityLabel.textContent = Math.round(Number(opacity.value) * 100) + '%';
  }

  window.classroomSettings.get().then(function (state) {
    alwaysOnTop.checked = state.alwaysOnTop === true;
    launchAtLogin.checked = state.launchAtLogin === true;
    opacity.value = Math.min(1, Math.max(0.2, Number(state.backgroundOpacity) || 1));
    provider.value = state.linkShortener.provider;
    apiKey.value = state.linkShortener.shortioApiKey;
    domain.value = state.linkShortener.shortioDomain;
    shortioFields.hidden = provider.value !== 'shortio';
    updateLabel();
  });

  version.textContent = 'Classroom Widgets for Linux v' + (window.__CLASSROOM_SETTINGS_VERSION__ || '0.0.0');

  provider.addEventListener('change', saveShortener);
  apiKey.addEventListener('input', saveShortener);
  domain.addEventListener('input', saveShortener);

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
