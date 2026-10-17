const { isNeo4jAvailable } = require('../config/neo4j');
const { isCassandraAvailable } = require('../config/cassandra');
const { allowFallback } = require('../config/runtime');

function requireDatabases(...databases) {
  return (req, res, next) => {
    if (allowFallback) return next();
    const available = { neo4j: isNeo4jAvailable(), cassandra: isCassandraAvailable() };
    const offline = databases.filter(database => !available[database]);
    if (offline.length) {
      return res.status(503).json({
        error: `Database unavailable: ${offline.join(', ')}. Start the database services and restart the API.`,
        source: 'unavailable',
      });
    }
    res.set('X-Data-Source', databases.join('+'));
    next();
  };
}

module.exports = { requireDatabases };
