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

  var rows = {};
  var renderedTypes = [];
  var capturingRow = null;
  var rowError = null;

  function stopCapture(entry) {
    entry.capture.classList.remove('capturing');
    entry.capture.textContent = entry.shortcut.accelerator || 'Set shortcut';
    capturingRow = null;
    window.classroomSettings.setCapturing(false);
  }

  function buildRow(shortcut) {
    var row = document.createElement('div');
    row.className = 'shortcut-row';
    var name = document.createElement('span');
    name.className = 'shortcut-name';
    var capture = document.createElement('button');
    capture.className = 'shortcut-capture';
    var clear = document.createElement('button');
    clear.className = 'secondary clear';
    clear.textContent = 'Clear';
    var status = document.createElement('span');
    status.setAttribute('role', 'status');
    var entry = { row: row, name: name, capture: capture, clear: clear, status: status, shortcut: shortcut };

    capture.addEventListener('click', function () {
      if (rowError && rowError.widgetType === entry.shortcut.widgetType) rowError = null;
      capturingRow = entry.shortcut.widgetType;
      capture.textContent = 'Press shortcut…';
      capture.classList.add('capturing');
      window.classroomSettings.setCapturing(true);
    });
    capture.addEventListener('blur', function () {
      if (capture.classList.contains('capturing')) stopCapture(entry);
    });
    capture.addEventListener('keydown', function (event) {
      if (!capture.classList.contains('capturing')) return;
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        stopCapture(entry);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        stopCapture(entry);
        return;
      }
      var accelerator = acceleratorFromEvent(event);
      if (!accelerator) return;
      window.classroomSettings.setShortcut(entry.shortcut.widgetType, accelerator).then(function (result) {
        if (result.ok) {
          if (rowError && rowError.widgetType === entry.shortcut.widgetType) rowError = null;
        } else {
          rowError = { widgetType: entry.shortcut.widgetType, message: result.error };
        }
        stopCapture(entry);
      });
    });
    clear.addEventListener('click', function () {
      if (rowError && rowError.widgetType === entry.shortcut.widgetType) rowError = null;
      window.classroomSettings.setShortcut(entry.shortcut.widgetType, null);
    });
    row.append(name, capture, clear, status);
    shortcutList.appendChild(row);
    return entry;
  }

  function renderShortcuts(shortcuts) {
    document.getElementById('resetShortcuts').disabled = !shortcuts.length;
    if (!shortcuts.length) {
      rows = {};
      renderedTypes = [];
      shortcutList.replaceChildren();
      var loading = document.createElement('p');
      loading.className = 'hint';
      loading.textContent = 'Loading widgets…';
      shortcutList.appendChild(loading);
      return;
    }
    var nextTypes = shortcuts.map(function (shortcut) { return String(shortcut.widgetType); });
    var needsRebuild = nextTypes.length !== renderedTypes.length
      || nextTypes.some(function (type, index) { return renderedTypes[index] !== type || !rows[type]; });
    if (needsRebuild) {
      rows = {};
      renderedTypes = nextTypes;
      shortcutList.replaceChildren();
      shortcuts.forEach(function (shortcut) {
        rows[String(shortcut.widgetType)] = buildRow(shortcut);
      });
    }
    shortcuts.forEach(function (shortcut) {
      var entry = rows[String(shortcut.widgetType)];
      entry.shortcut = shortcut;
      entry.name.textContent = shortcut.title;
      entry.clear.disabled = !shortcut.accelerator;
      entry.clear.setAttribute('aria-label', 'Clear shortcut for ' + shortcut.title);
      entry.capture.setAttribute('aria-label', 'Shortcut for ' + shortcut.title + ': ' + (shortcut.accelerator || 'not assigned'));
      if (capturingRow === shortcut.widgetType) {
        entry.capture.textContent = 'Press shortcut…';
        entry.capture.classList.add('capturing');
      } else {
        entry.capture.textContent = shortcut.accelerator || 'Set shortcut';
      }
      if (rowError && rowError.widgetType === shortcut.widgetType) {
        entry.status.className = 'shortcut-status conflict';
        entry.status.textContent = rowError.message;
      } else {
        entry.status.className = 'shortcut-status ' + shortcut.state;
        entry.status.textContent = shortcut.detail;
      }
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
  window.classroomSettings.onShortcutsChanged(renderShortcuts);

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
