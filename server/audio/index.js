const config = require('../config');
const fallbackEngine = require('./engine');
const supercolliderClient = require('./supercolliderClient');

function useSuperCollider() {
  return config.superColliderEnabled;
}

async function playRealtime(job) {
  if (useSuperCollider()) {
    try {
      return await supercolliderClient.playRealtime(job);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[SuperCollider fallback] play failed, using Node DSP:', error.message);
    }
  }
  return fallbackEngine.playRealtime(job);
}

async function renderToFile(job) {
  if (useSuperCollider()) {
    try {
      return await supercolliderClient.renderToFile(job);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[SuperCollider fallback] render failed, using Node DSP:', error.message);
    }
  }
  return fallbackEngine.renderToFile(job);
}

module.exports = { playRealtime, renderToFile };
