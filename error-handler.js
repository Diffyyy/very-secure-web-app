require('dotenv').config()
const logger = require('./logger')

//function for printing error messages
function handleError(err, id = ''){
	switch(process.env.DEBUG_MODE){
		case "1":
			//if debug mode, print detailed error
			console.error(`id: ${id}, ` + err.stack)
			logger.error(`id: ${id}, ` + err.stack)
			break
		default:
			//else, print generic error
			console.error(`id: ${id}, ${err.name}: ${err.message}`);
			logger.error(`id: ${id}, ${err.name}: ${err.message}`)
	}
}
module.exports = {handleError}
