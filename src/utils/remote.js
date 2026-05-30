import https from 'https';
import os from 'os';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

// A single keep-alive agent reused across every request. The previous code
// created a fresh https.Agent per call, forcing a new TLS handshake against the
// self-signed cert each time. Reusing one agent keeps connections warm.
const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
  maxSockets: 64,
});

const PLEX_PORT = 32400;

/**
 * Fetches XML data from a localhost URL
 * @param {string} url Where to find the data
 * @returns {Array<object>} Response
 */
async function fetchLocalXmlData(url) {
  const response = await getFromLocalhost(url);
  const data = await response.text();

  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(data);

  return parsed;
}

/**
 * Method to fetch data from localhost, needed to get around invalid SSL certs
 * @param {string} url URL to fetch data from
 * @param {number} timeoutMs Optional abort timeout in milliseconds
 * @returns {object} blob of data
 */
async function getFromLocalhost(url, timeoutMs = 0) {
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    return await fetch(url, {
      method: 'GET',
      agent: httpsAgent,
      signal: controller.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Probe a candidate Plex base URL via /identity.
 * @param {string} baseUrl e.g. https://192.168.1.12:32400
 * @param {string} token Plex API token
 * @param {string|null} expectedMachineId If set, the server must match this id
 * @param {number} timeoutMs Abort timeout. Must comfortably exceed a cold TLS
 *   handshake against Plex's self-signed cert (~2s in practice), or healthy
 *   servers get spuriously rejected.
 * @returns {Promise<string|null>} The machineIdentifier if alive, else null
 */
async function probePlexIdentity(baseUrl, token, expectedMachineId = null, timeoutMs = 6000) {
  try {
    const response = await getFromLocalhost(`${baseUrl}/identity?X-Plex-Token=${token}`, timeoutMs);
    if (!response.ok) return null;

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(await response.text());
    const machineId = parsed?.MediaContainer?.['@_machineIdentifier'];

    if (!machineId) return null;
    if (expectedMachineId && machineId !== expectedMachineId) return null;

    return machineId;
  } catch {
    return null;
  }
}

/**
 * Derive the local /24 IPv4 prefixes (e.g. "192.168.1.") from this machine's
 * network interfaces, so we know which subnet(s) to scan for the Plex server.
 * @returns {Array<string>} Unique subnet prefixes ending in "."
 */
function getLocalSubnetPrefixes() {
  const prefixes = new Set();
  const interfaces = os.networkInterfaces();

  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        prefixes.add(addr.address.split('.').slice(0, 3).join('.') + '.');
      }
    }
  }

  return [...prefixes];
}

/**
 * Scan the local subnet(s) for a Plex server listening on :32400. Probes every
 * host concurrently and returns the first base URL whose /identity responds
 * (matching expectedMachineId if provided).
 * @param {string} token Plex API token
 * @param {string|null} expectedMachineId Optional machine id to match
 * @returns {Promise<string|null>} Discovered base URL, or null
 */
async function scanForPlexHost(token, expectedMachineId = null) {
  const prefixes = getLocalSubnetPrefixes();

  for (const prefix of prefixes) {
    const candidates = [];
    for (let host = 1; host <= 254; host += 1) {
      candidates.push(`https://${prefix}${host}:${PLEX_PORT}`);
    }

    const results = await Promise.all(
      candidates.map(async (baseUrl) => {
        const machineId = await probePlexIdentity(baseUrl, token, expectedMachineId);
        return machineId ? baseUrl : null;
      }),
    );

    const found = results.find(Boolean);
    if (found) return found;
  }

  return null;
}

/**
 * Fetch data from a remote location using http GET
 * @param {string} url The URL to fetch data from
 * @param {string} authToken The auth bearer token
 * @returns {object} blob of data from remote location
 */
async function getFromRemoteHost(url, authToken) {
  return fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });
}

export {
  fetchLocalXmlData,
  getFromLocalhost,
  getFromRemoteHost,
  probePlexIdentity,
  scanForPlexHost,
};
