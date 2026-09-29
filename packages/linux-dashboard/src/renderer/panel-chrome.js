(function () {
  var chromeEl = document.getElementById('chrome');
  var titleEl = document.getElementById('title');
  var addBtn = document.getElementById('add');
  var volumeBtn = document.getElementById('volume');

  document.getElementById('close').addEventListener('click', function () {
    window.classroomPanelChrome.send('close');
  });
  addBtn.addEventListener('click', function () {
    window.classroomPanelChrome.send('add');
  });
  document.getElementById('arrange').addEventListener('click', function () {
    window.classroomPanelChrome.send('arrange');
  });
  volumeBtn.addEventListener('click', function () {
    window.classroomPanelChrome.send('volume');
  });

  window.classroomPanelChrome.onUpdate(function (update) {
    if (!update || typeof update !== 'object') return;
    if (typeof update.title === 'string') titleEl.textContent = update.title;
    if (typeof update.theme === 'string') chromeEl.classList.toggle('dark', update.theme === 'dark');
    if (typeof update.opacity === 'number') {
      chromeEl.style.background = update.theme === 'dark'
        ? 'rgba(30, 31, 36, ' + update.opacity + ')'
        : 'rgba(245, 245, 247, ' + update.opacity + ')';
    }
    chromeEl.classList.toggle('visible', update.chromeVisible === true);
    addBtn.disabled = update.addEnabled === false;
    if (typeof update.outputVolume === 'number') {
      var percentage = Math.round(update.outputVolume * 100);
      volumeBtn.textContent = percentage === 0 ? '🔇' : '🔊';
      volumeBtn.title = 'Output volume: ' + percentage + '%';
      volumeBtn.setAttribute('aria-label', volumeBtn.title);
    }
  });
})();
