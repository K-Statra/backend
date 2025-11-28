const { randomUUID } = require('crypto');

function requestId(req, res, next) {
  req.id = req.id || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestId };

