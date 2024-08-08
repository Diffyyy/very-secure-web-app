require('dotenv').config()
const crypto = require('crypto');
const {handleError} = require('./error-handler')

// Secret key for HMAC
const secretKey = process.env.CSRF_SECRET 

//map of users to csrf tokens
const tokens = new Map()

// Function to generate a CSRF token with HMAC signature
function generateCsrfToken(userId) {
	// Create a random token, 32 bytes long, twice the reccommended minimum of 16 bytes
	const csrfToken = crypto.randomBytes(32).toString('hex');
	// Create HMAC signature

	const hmac = crypto.createHmac('sha256', secretKey);
	hmac.update(csrfToken);
	const signature = hmac.digest('hex');

	// Combine token and signature
	const tokenWithSignature = `${csrfToken}.${signature}`;

	//update tokens map
	tokens.set(userId, {token: tokenWithSignature})
	return tokenWithSignature;
}

function verifyCsrfToken(userId, tokenWithSignature){
	if(!tokenWithSignature){
		handleError(new Error('no token and signature'), userId)
		return false
	}
	if (!tokens.get(userId)){
		handleError(new Error('token does not exist'), userId)
		return false
	}
	
	const period = tokenWithSignature.indexOf('.')	
	//no period was found
	if(period===-1){
		handleError(new Error('no signature'), userId)
		return false;
	}
	const csrfToken = tokenWithSignature.substring(0, period)
	const signature = tokenWithSignature.substring(period+1)
	if (!csrfToken){
		handleError(new Error('no token'), userId)
		return false
	}
	if(!signature){
		handleError(new Error('no signature'), userId)
		return false
	}
	const hmac = crypto.createHmac('sha256', secretKey);
	hmac.update(csrfToken);
	const expectedSignature = hmac.digest('hex');
	//verify if signature is equal to expected signature
	if (signature!==expectedSignature) {
		handleError(new Error('token is tampered'), userId)
		return false;
	}
	//verify if csrfToken corresponds to correct user
	if (tokens.get(userId).token!==tokenWithSignature){
		handleError(new Error('user id and csrfToken mismatch'), userId)
		return false;
	}
	//consume single-use csrf token
	tokens.delete(userId)
	return true;
}
//middleware function for verifying csrf token
function verifyCsrfTokenMiddleware(req,res,next){
	//get csrf token from request headers
	const csrfToken = req.headers.csrftoken
	const valid = verifyCsrfToken(req.session.user.id, csrfToken)
	if(!valid)	{
		//if not valid send error code 419
		return res.status(419).send()
	}
	next()
}
module.exports = {generateCsrfToken, verifyCsrfTokenMiddleware}
