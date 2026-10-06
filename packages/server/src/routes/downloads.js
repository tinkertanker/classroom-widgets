const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const REPOSITORY = 'tinkertanker/classroom-widgets';
const CACHE_MS = 5 * 60 * 1000;
const FILE_SUFFIXES = {
  windows: 'windows-x64-setup.exe',
  macos: 'macos.dmg',
  linux: 'linux-x86_64.AppImage'
};

function createDownloadsRouter() {
  const router = express.Router();
  let lookup;
  let expiresAt = 0;

  // Share the lookup across platforms and concurrent requests. Cache failures
  // too, so a GitHub outage cannot turn download clicks into a request storm.
  function latestRelease() {
    if (!lookup || Date.now() >= expiresAt) {
      expiresAt = Infinity;
      lookup = (async () => {
        try {
          const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Classroom-Widgets' },
            signal: AbortSignal.timeout(10000)
          });
          if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
          const release = await response.json();
          if (typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) {
            throw new Error('Invalid GitHub release metadata');
          }
          return release;
        } catch (error) {
          logger.warn('Desktop download release lookup failed', { message: error.message });
          return null;
        } finally {
          expiresAt = Date.now() + CACHE_MS;
        }
      })();
    }
    return lookup;
  }

  router.get('/:platform', asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { platform } = req.params;
    if (!Object.hasOwn(FILE_SUFFIXES, platform)) {
      return res.status(404).send('Unknown desktop platform. Choose Windows, macOS or Linux.');
    }
    const release = await latestRelease();
    if (!release) {
      return res.status(502).send('Downloads are temporarily unavailable. Please try again in a few minutes.');
    }
    const filename = `ClassroomWidgets-${release.tag_name}-${FILE_SUFFIXES[platform]}`;
    if (!release.assets.some(asset => asset.name === filename && asset.state === 'uploaded')) {
      return res.status(503).send('This platform’s download is still being published. Please try again in a few minutes.');
    }
    return res.redirect(302, `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(release.tag_name)}/${encodeURIComponent(filename)}`);
  }));

  return router;
}

module.exports = { createDownloadsRouter };
