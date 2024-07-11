require('dotenv').config()
function handleError(err){
	switch(process.env.DEBUG_MODE){
		case "1":
			console.error(err)
			break
		case "0":
			console.error(`${err.name}: ${err.message}`);
			break
		default:
			console.error(`${err.name}: ${err.message}`);
	}
}
module.exports = {handleError}
