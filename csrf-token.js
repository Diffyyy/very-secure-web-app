require('dotenv').config()
const crypto = require('crypto');

// Secret key for HMAC
const secretKey = process.env.CSRF_SECRET 
const tokens = new Map()

// Function to generate a CSRF token with HMAC signature
function generateCsrfToken(userId) {
	// Create a random token
	const csrfToken = crypto.randomBytes(36).toString('hex');
	// Create HMAC signature
	const hmac = crypto.createHmac('sha256', secretKey);
	hmac.update(csrfToken);
	const signature = hmac.digest('hex');

	// Combine token and signature
	const tokenWithSignature = `${csrfToken}.${signature}`;
	tokens.set(userId, {token: tokenWithSignature, expiry: new Date()})
	return tokenWithSignature;
}

function verifyCsrfToken(userId, tokenWithSignature){
	if(!tokenWithSignature){
		console.log('no token and signature')
		return false
	}
	if (!tokens.get(userId)){
		console.log("token does not exist for userId")
		return false
	}
	
	const [csrfToken, signature] = tokenWithSignature.split('.');
	if (!csrfToken || !signature) {
		console.log("no token or signature")
		return false;
	}
	const hmac = crypto.createHmac('sha256', secretKey);
	hmac.update(csrfToken);
	const expectedSignature = hmac.digest('hex');
	if (signature!==expectedSignature) {
		console.log("token is tampered")
		return false;
	}
	if (tokens.get(userId).token!==tokenWithSignature){
		console.log("user token and csrfToken mismatch")
		return false;
	}
	tokens.set(userId, undefined)
	return true;
}
//only use this middleware after authenticateUser middleware
function verifyCsrfTokenMiddleware(req,res,next){
	const csrfToken = req.headers.csrftoken
	const valid = verifyCsrfToken(req.session.user.id, csrfToken)
	if(!valid)	{
		return res.status(419).send()
	}
	next()
}

module.exports = {generateCsrfToken, verifyCsrfTokenMiddleware}
