//This is contains the functions that are needed to create logs
const fs = require('fs');
const path = require('path');

// Define the log file path
const logFilePath = path.join(__dirname, 'logs/logs.log');

// Ensure the log file exists
if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, '', { flag: 'wx' }, (err) => {
        if (err) {
            console.error('Failed to create log file:', err);
        }
    });
}


// Function to format the current timestamp
function getTimestamp() {
    return new Date().toISOString();
}

// Function to log messages to the log file
function logMessage(level, message) {
    const logEntry = `${getTimestamp()} [${level.toUpperCase()}] ${message}\n`;
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Failed to write log entry:', err);
        }
    });
}

// Export log functions
module.exports = {
    info: (message) => logMessage('info', message),
    error: (message) => logMessage('error', message),
};
