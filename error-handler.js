require('dotenv').config()
//function for printing error messages
function handleError(err){
	switch(process.env.DEBUG_MODE){
		case "1":
			//if debug mode, print detailed error
			console.error(err)
			break
		default:
			//else, print generic error
			console.error(`${err.name}: ${err.message}`);
	}
}
module.exports = {handleError}
