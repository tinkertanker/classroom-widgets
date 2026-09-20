const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const DEFAULT_BASE_URL = 'https://api.short.io/links/public';
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;
const rateLimitByIp = new Map();

function getConfig() {
  const apiKey = (process.env.SHORTIO_API_KEY || '').trim();
  const domain = (process.env.SHORTIO_DOMAIN || '').trim();
  const baseUrl = (process.env.SHORTIO_BASE_URL || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;

  return {
    apiKey,
    domain,
    baseUrl,
    configured: Boolean(apiKey && domain)
  };
}

function validationError(message) {
  return { success: false, error: message };
}

function validatePayload(body) {
  const { url, alias, title } = body || {};

  if (typeof url !== 'string' || url.length > 2048) {
    return 'URL must be a string no longer than 2048 characters.';
  }

  const targetUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return 'Please enter a valid URL.';
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return 'Only http and https URLs are supported.';
  }

  if (alias !== undefined
    && (typeof alias !== 'string' || !/^[A-Za-z0-9_-]{3,40}$/.test(alias))) {
    return 'Alias must be 3-40 letters, numbers, hyphens or underscores.';
  }

  if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
    return 'Title must be a string no longer than 200 characters.';
  }

  return null;
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = rateLimitByIp.get(ip);

  if (!current || now - current.windowStart >= RATE_WINDOW_MS) {
    rateLimitByIp.set(ip, { count: 1, windowStart: now });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT;
}

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    success: true,
    configured: getConfig().configured
  });
});

router.post('/', asyncHandler(async (req, res) => {
  const { apiKey, domain, baseUrl, configured } = getConfig();

  if (!configured) {
    return res.status(503).json({
      success: false,
      code: 'NOT_CONFIGURED',
      error: 'Link shortening is not configured on this server.'
    });
  }

  const validationMessage = validatePayload(req.body);
  if (validationMessage) {
    return res.status(400).json(validationError(validationMessage));
  }

  if (isRateLimited(req.ip)) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again shortly.'
    });
  }

  const { url, alias, title } = req.body;
  const originalURL = /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  const upstreamBody = {
    originalURL,
    domain
  };
  if (alias !== undefined) upstreamBody.path = alias;
  if (title !== undefined) upstreamBody.title = title;

  let upstreamResponse;
  let responseBody = {};
  try {
    upstreamResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(upstreamBody),
      signal: AbortSignal.timeout(10000)
    });

    try {
      responseBody = await upstreamResponse.json();
    } catch {
      responseBody = {};
    }
  } catch (error) {
    logger.warn('Short.io upstream request failed', { status: 'network_error' });
    return res.status(502).json({
      success: false,
      error: 'Could not shorten that link. Please try again.'
    });
  }

  const conflictMessage = [responseBody?.error, responseBody?.message]
    .filter((value) => typeof value === 'string')
    .some((value) => /already exists|taken|conflict/i.test(value));
  if (upstreamResponse.status === 409 || conflictMessage) {
    return res.status(409).json({
      success: false,
      error: 'That custom ending is already taken. Try another.'
    });
  }

  const shortUrl = responseBody?.secureShortURL || responseBody?.shortURL;
  if (upstreamResponse.ok && shortUrl) {
    return res.json({
      success: true,
      shortUrl
    });
  }

  logger.warn('Short.io upstream request failed', { status: upstreamResponse.status });
  return res.status(502).json({
    success: false,
    error: 'Could not shorten that link. Please try again.'
  });
}));

router._resetRateLimit = () => {
  rateLimitByIp.clear();
};

module.exports = router;
