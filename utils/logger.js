const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'server-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
    }),
  ],
});

const requestIdMiddleware = (req, res, next) => {
  const id = req.headers['x-request-id'] || uuidv4();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};

morgan.token('request-id', (req) => req.requestId);
const httpLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms req_id=:request-id',
  {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }
);

module.exports = { logger, requestIdMiddleware, httpLogger };
