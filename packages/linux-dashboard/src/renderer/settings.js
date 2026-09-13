(function () {
  var alwaysOnTop = document.getElementById('alwaysOnTop');
  var launchAtLogin = document.getElementById('launchAtLogin');
  var opacity = document.getElementById('opacity');
  var opacityLabel = document.getElementById('opacityLabel');
  var version = document.getElementById('version');
  var shortcutList = document.getElementById('shortcuts');
  var commitTimer = null;

  function acceleratorFromEvent(event) {
    var modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Super');
    var ignored = ['Control', 'Alt', 'Shift', 'Meta'];
    if (ignored.indexOf(event.key) !== -1 || modifiers.length === 0) return null;
    var codeMatch = /^(?:Digit([0-9])|Key([A-Z])|F(1[0-9]|2[0-4]|[1-9]))$/.exec(event.code);
    var key;
    if (codeMatch) {
      key = codeMatch[1] || codeMatch[2] || 'F' + codeMatch[3];
    } else {
      var names = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
      key = names[event.key] || (event.key.length === 1 ? event.key.toUpperCase() : event.key);
    }
    return modifiers.concat(key).join('+');
  }

  var capturingRow = null;
  var pendingShortcuts = null;
  var rowError = null;

  function onShortcutsChanged(shortcuts) {
    if (capturingRow) {
      pendingShortcuts = shortcuts;
      return;
    }
    renderShortcuts(shortcuts);
  }

  function renderShortcuts(shortcuts) {
    shortcutList.replaceChildren();
    document.getElementById('resetShortcuts').disabled = !shortcuts.length;
    if (!shortcuts.length) {
      var loading = document.createElement('p');
      loading.className = 'hint';
      loading.textContent = 'Loading widgets…';
      shortcutList.appendChild(loading);
      return;
    }
    shortcuts.forEach(function (shortcut) {
      var row = document.createElement('div');
      row.className = 'shortcut-row';
      var name = document.createElement('span');
      name.className = 'shortcut-name';
      name.textContent = shortcut.title;
      var capture = document.createElement('button');
      capture.className = 'shortcut-capture';
      capture.textContent = shortcut.accelerator || 'Set shortcut';
      capture.setAttribute('aria-label', 'Shortcut for ' + shortcut.title + ': ' + (shortcut.accelerator || 'not assigned'));
      var clear = document.createElement('button');
      clear.className = 'secondary clear';
      clear.textContent = 'Clear';
      clear.disabled = !shortcut.accelerator;
      clear.setAttribute('aria-label', 'Clear shortcut for ' + shortcut.title);
      var status = document.createElement('span');
      status.className = 'shortcut-status ' + shortcut.state;
      status.textContent = shortcut.detail;
      status.setAttribute('role', 'status');
      if (rowError && rowError.widgetType === shortcut.widgetType) {
        status.className = 'shortcut-status conflict';
        status.textContent = rowError.message;
        rowError = null;
      }

      function stopCapture() {
        capture.classList.remove('capturing');
        capture.textContent = shortcut.accelerator || 'Set shortcut';
        capturingRow = null;
        window.classroomSettings.setCapturing(false);
        if (pendingShortcuts) {
          var next = pendingShortcuts;
          pendingShortcuts = null;
          renderShortcuts(next);
        }
      }
      capture.addEventListener('click', function () {
        capturingRow = shortcut.widgetType;
        capture.textContent = 'Press shortcut…';
        capture.classList.add('capturing');
        window.classroomSettings.setCapturing(true);
      });
      capture.addEventListener('blur', function () {
        if (capture.classList.contains('capturing')) stopCapture();
      });
      capture.addEventListener('keydown', function (event) {
        if (!capture.classList.contains('capturing')) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') {
          stopCapture();
          return;
        }
        var accelerator = acceleratorFromEvent(event);
        if (!accelerator) return;
        window.classroomSettings.setShortcut(shortcut.widgetType, accelerator).then(function (result) {
          if (!result.ok) rowError = { widgetType: shortcut.widgetType, message: result.error };
          stopCapture();
        });
      });
      clear.addEventListener('click', function () {
        window.classroomSettings.setShortcut(shortcut.widgetType, null);
      });
      row.append(name, capture, clear, status);
      shortcutList.appendChild(row);
    });
  }

  function updateLabel() {
    opacityLabel.textContent = Math.round(Number(opacity.value) * 100) + '%';
  }

  window.classroomSettings.get().then(function (state) {
    alwaysOnTop.checked = state.alwaysOnTop === true;
    launchAtLogin.checked = state.launchAtLogin === true;
    opacity.value = Math.min(1, Math.max(0.2, Number(state.backgroundOpacity) || 1));
    updateLabel();
    renderShortcuts(state.shortcuts || []);
    document.getElementById('waylandWarning').hidden = state.wayland !== true;
  });
  window.classroomSettings.onShortcutsChanged(onShortcutsChanged);

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
  document.getElementById('resetShortcuts').addEventListener('click', function () {
    window.classroomSettings.resetShortcuts();
  });
})();
