import https from 'https';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

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
 * @returns {object} blob of data
 */
async function getFromLocalhost(url) {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  const response = await fetch(url, {
    method: 'GET',
    agent: httpsAgent,
  });

  return response;
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
};
