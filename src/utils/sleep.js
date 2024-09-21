/**
 * Method to halt execution
 * @param {number} ms Time in ms to wait
 * @returns {Promise<void>} A promise to wait on
 */
// eslint-disable-next-line no-promise-executor-return
async function sleep(ms) { console.log(`Sleeping for ${ms / 1000} seconds`); return new Promise((res) => setTimeout(res, ms)); }

export default sleep;
