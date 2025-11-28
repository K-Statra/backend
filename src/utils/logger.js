const { createLogger, format, transports } = require('winston');

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const logger = createLogger({
  level,
  format: isProd
    ? format.combine(format.timestamp(), format.json())
    : format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

module.exports = { logger };

