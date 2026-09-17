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

  var shortcutList = document.getElementById('shortcuts');

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

  function stopCapture(entry, field) {
    field.capture.classList.remove('capturing');
    field.capture.textContent = entry.shortcut[field.acceleratorKey] || 'Set shortcut';
    capturingRow = null;
    window.classroomSettings.setCapturing(false);
  }

  function buildShortcutField(entry, action) {
    var field = document.createElement('div');
    field.className = 'shortcut-field';
    var capture = document.createElement('button');
    capture.className = 'shortcut-capture';
    var clear = document.createElement('button');
    clear.className = 'secondary clear';
    clear.textContent = 'Clear';
    var status = document.createElement('span');
    status.setAttribute('role', 'status');
    var shortcutField = {
      action: action,
      acceleratorKey: action === 'show' ? 'accelerator' : 'dismissAccelerator',
      stateKey: action === 'show' ? 'state' : 'dismissState',
      detailKey: action === 'show' ? 'detail' : 'dismissDetail',
      capture: capture,
      clear: clear,
      status: status
    };

    capture.addEventListener('click', function () {
      if (rowError && rowError.widgetType === entry.shortcut.widgetType && rowError.action === action) rowError = null;
      capturingRow = entry.shortcut.widgetType + ':' + action;
      capture.textContent = 'Press shortcut…';
      capture.classList.add('capturing');
      window.classroomSettings.setCapturing(true);
    });
    capture.addEventListener('blur', function () {
      if (capture.classList.contains('capturing')) stopCapture(entry, shortcutField);
    });
    capture.addEventListener('keydown', function (event) {
      if (!capture.classList.contains('capturing')) return;
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        stopCapture(entry, shortcutField);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        stopCapture(entry, shortcutField);
        return;
      }
      var accelerator = acceleratorFromEvent(event);
      if (!accelerator) return;
      window.classroomSettings.setShortcut(entry.shortcut.widgetType, action, accelerator).then(function (result) {
        if (result.ok) {
          if (rowError && rowError.widgetType === entry.shortcut.widgetType && rowError.action === action) rowError = null;
        } else {
          rowError = { widgetType: entry.shortcut.widgetType, action: action, message: result.error };
        }
        stopCapture(entry, shortcutField);
      });
    });
    clear.addEventListener('click', function () {
      if (rowError && rowError.widgetType === entry.shortcut.widgetType && rowError.action === action) rowError = null;
      window.classroomSettings.setShortcut(entry.shortcut.widgetType, action, null);
    });
    field.append(capture, clear, status);
    return shortcutField;
  }

  function buildRow(shortcut) {
    var row = document.createElement('div');
    row.className = 'shortcut-row';
    var name = document.createElement('span');
    name.className = 'shortcut-name';
    var entry = { row: row, name: name, shortcut: shortcut };
    entry.show = buildShortcutField(entry, 'show');
    entry.dismiss = buildShortcutField(entry, 'dismiss');
    row.append(name, entry.show.capture.parentNode, entry.dismiss.capture.parentNode);
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
      ['show', 'dismiss'].forEach(function (action) {
        var field = entry[action];
        var accelerator = shortcut[field.acceleratorKey];
        field.clear.disabled = !accelerator;
        field.clear.setAttribute('aria-label', 'Clear ' + action + ' shortcut for ' + shortcut.title);
        field.capture.setAttribute('aria-label', action + ' shortcut for ' + shortcut.title + ': ' + (accelerator || 'not assigned'));
        if (capturingRow === shortcut.widgetType + ':' + action) {
          field.capture.textContent = 'Press shortcut…';
          field.capture.classList.add('capturing');
        } else {
          field.capture.textContent = accelerator || 'Set shortcut';
        }
        if (rowError && rowError.widgetType === shortcut.widgetType && rowError.action === action) {
          field.status.className = 'shortcut-status conflict';
          field.status.textContent = rowError.message;
        } else {
          field.status.className = 'shortcut-status ' + shortcut[field.stateKey];
          field.status.textContent = shortcut[field.detailKey];
        }
      });
    });
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
    renderShortcuts(state.shortcuts || []);
    document.getElementById('waylandWarning').hidden = state.wayland !== true;
  });
  window.classroomSettings.onShortcutsChanged(renderShortcuts);

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
  document.getElementById('resetShortcuts').addEventListener('click', function () {
    window.classroomSettings.resetShortcuts();
  });
})();
