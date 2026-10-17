require('dotenv').config();

// Preview mode is opt-in. The lab demonstration must use persistent databases.
const allowFallback = process.env.ALLOW_IN_MEMORY_FALLBACK === 'true';

module.exports = { allowFallback };
