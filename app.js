require('dotenv').config()
const express = require('express');
const session = require('express-session');
var https = require('https');
var http = require('http');
const fs = require('fs');
const MySQLStore = require('express-mysql-session')(session)
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const port = 3000;
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const logger = require('./logger'); // import logger module

const {generateCsrfToken, verifyCsrfTokenMiddleware} = require('./csrf-token')
const {db, addUser, checkUser, updateUser, getUserInfo, getUserPass, updateUserPass, updateUserProfilePicture, getUserProfilePicture, getAllPosts, updatePostInfo, createPost, deletePost, getUserList, banUser, checkIfBanned} = require('./db');
const {deleteFile, validateImage} = require('./files')
const {validateForm, validatePassword, validateEmail} = require('./assets/js/profile-validation');
const{validateTitle, validateContent, validatePost, validateId} = require('./assets/js/post-validation');
const {handleError} = require('./error-handler')

// https
// Load SSL certificate and key

var options = {
	key: fs.readFileSync('key/client-key.pem'),   // public key
	cert: fs.readFileSync('key/client-cert.cert') // private key
  };



//max age of a session in milliseconds
const timeout = 7200000
//Initialize mysql database for storing essions
const sessionStore = new MySQLStore({
	//remove expired sessions from database every 60000 milliseconds
	checkExpirationInterval:timeout,
	disableTouch:true // absolute timeout
}, db)

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static('assets'));
// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set the views directory to the current directory
//middleware function for debugging session
function logBeforeSession(req, res, next){
	// console.log('-------------------------------------')
	// console.log('BEFORE SESSION MIDDLEWARE: ')
	// console.log(req.session)
	// console.log('-------------------------------------')
	next()
}

function logAfterSession(req, res, next){
	// console.log('-------------------------------------')
	// console.log('AFTER SESSION MIDDLEWARE: ')
	// console.log(req.session)
	// console.log('-------------------------------------')
	next()
}
//middleware for authenticating user, if user is not authenticated, direct user to index page
function authenticateUser(req,res,next){
	//check first if user has session token, and if session token corresponds to a logged in user
	if(req.session && req.session.user){
		//then check if user is banned
		checkIfBanned(req.session.user.id).then(isNotBanned =>{
			if(isNotBanned){
				next()
			}else{
				//User is banned, send error code 403 forbidden
				res.status(403).render('index')
			}
		}).catch(err => {
			handleError(err, req.session.user.id)
			res.status(520).send('Unknown error');
		})
	}else{
		//user has no session token, or session has already expired
		res.status(408).render('index')
	}
}
app.use(logBeforeSession)

//session middleware is used for all routes
app.use(session({
	secret: process.env.SESSION_SECRET, // secret for signing cookie
	resave: false, //don't resave cookie to database on every request
	saveUninitialized: false, //don't save session without  user
	cookie: {maxAge: timeout, secure:true, httpOnly: true, sameSite: 'strict'}, //use strict sameSite to prevent CSRF
	store: sessionStore,

	name:'very-secure-web-app.id'//name of cookie for session token
}))
app.use(logAfterSession)

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 3,
  message: 'Too many login attempts, please try again after 15 minutes',
});

const upload = multer({
	dest: 'uploads/',
	limits: { fileSize: 2 * 1024 * 1024 },
	// Limit file size to 2MB
});

//view profile page
app.get('/profile', authenticateUser, (req,res)=>{
	getUserInfo({id: req.session.user.id}).then(user =>{
		if(user===false){
			//user does not exist in database
			return res.status(400).send('Invalid user')
		}
		res.render('user', {...user})
	}).catch(err=>{
		handleError(err, req.session.user.id)
		res.status(520).send('Error in fetching user')
	})
})

// page for showing all posts
app.get('/',authenticateUser, (req, res) => {
	getUserInfo({id: req.session.user.id}).then(user =>{
		if(user===false){
			//user does not exist in database
			return res.status(400).send('Invalid user')
		}
		// Fetch posts
		getAllPosts().then(posts=>{
			// Not sure if needed
			// if(admin){
			// 	res.render('admin', { ...user, posts, admin })
			// }
			// else{
			// 	res.render('user', { ...user, posts, admin })
			// }	
			// Retrieves the post
			posts.forEach(post =>{
				post.isOwner = (post.user == req.session.user.id)
			})
			res.render('feed',  {...user,posts})
		}).catch(err=>{
			handleError(err, req.session.user.id)
			res.status(520).send('Error in fetching posts')
		})
	}).catch(err=>{
		handleError(err, req.session.user.id)
		res.status(520).send('Error in fetching user')
	})
});

app.get('/login', (req, res) => {
	res.render('login')
});

app.get('/signup', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

// app.get('/admin', (req, res) => {
// 	res.sendFile(path.join(__dirname, 'views', 'admin.html'));
// });

app.post('/signup', async (req, res) => {
	//check first if there are errors with upload such as file is too large
	upload.single('profilepic')(req,res, async function(err){
		const { lastname, firstname, email, number,age, password, confirmpassword } = req.body;
		const profilepic = req.file;
		if(err instanceof multer.MulterError){
			return res.status(400).json({profilepic: err.message});
		}else if(err){
			handleError(err, `${email} signup`)
			return res.status(400).json({profilepic: 'Unknown error'});
		}
		if (!profilepic) {
			//if no input profile picture
			return res.status(400).json({profilepic: 'Profile picture is required'});
		}
		const validImage = await validateImage(profilepic.path)
		if(!validImage)	{
			return res.status(400).json({profilepic: 'Invalid image file'})
		}
		else{ //Signup success
			req.body.profilepic = profilepic //only so req.body.profilepic is not undefined in validateForm
			const validationResult = validateForm(req.body, true);

			//if there are errors in form, send back to client
			if (validationResult!==true){
				return res.status(400).json(validationResult)
			}
			const hash = bcrypt.hashSync(password,saltRounds)

			addUser({firstname, lastname, email, number,age:parseInt(age,10), password: hash, pfp:profilepic.path})
				.then(result=>{
					logger.info(email + " signed up.")
					res.redirect('/login')
				}).catch(err=>{ //change pfp path here
					handleError(err, `${email} signup`)
					if(err.code===0){
						return res.status(400).json({email: 'Email or number already existing', number: 'Email or number already existing'})
					}
				});
		}

	})
});

app.post('/login', loginLimiter, upload.none(), async(req, res)=>{
	const {email, password} = req.body
	if (!validateEmail(email)) {
		return res.status(400).send()
	}
	if (!validatePassword(password)) {
		return res.status(400).send()
	}

	if (true){ //used to be where captcha is checked
		checkUser({email})
			.then(user=>{
				if(user===false){
					//no user with input email
					return res.status(400).send()
				}
				if(user.isBanned===1){
					//user is banned, send error code 403 forbidden
					return res.status(403).send()
				}

				bcrypt.compare(password, user.password, function(err, result) {
					if(err){
						handleError(err, `${email} login`)
						return res.status(520).send()
					}
					if(result===true){
						//correct password
						logger.info(user.id + " logged in.")
						//generate new session token for user
						req.session.regenerate(function (err) {
							if (err) {

								handleError(err, `${email} login`)
								return res.status(520).send()
							}


							// store user information in session, typically a user id
							req.session.user = {id: user.id}
							
							// save the session before redirection to ensure page
							// load does not happen before session is saved
							req.session.save(function (err) {
								if (err){

									handleError(err, `${email} login`)
									return res.status(520).send()
								} 
								res.redirect('/')
							})
						})
					}else{
						// console.log('wrong password')
						return res.status(400).send()
					}
				});
			}).catch(err=>{
				handleError(err, `${email} login`)
				return res.status(520).send()
			})
	}
	else {
		//captcha is not implemented anymore
		// res.status(400).json({captcha: 'CAPTCHA validation failed, please try again.'})
	}

})
app.post('/logout', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async(req, res, next)=>{
	temp = req.session.user
	
	//destroy session of user and delete from  database
	req.session.destroy(function(err){
		if (err){
			handleError(err, req.session.user.id)
			res.status(520).send()
		} 
		logger.info(temp.id + " logged out")
		temp = null
		res.status(200).send()
	})
})

app.post('/createPost', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async (req, res) => {
	const user = req.session.user
	const postData = {
		user: user.id,
		title: req.body.title,
		content: req.body.content,
    }

	const validationErrors = validatePost(postData, true)
	if(validationErrors !== true){
		return res.status(400).json(validationErrors);
	}

	createPost(postData).then(result => {
		logger.info("Created post by " + user.id + ', post id: ' + result)
		res.status(200).send()
	}).catch(err=>{
		handleError(err, req.session.user.id)
		if(err.code===0){
			return res.status(400).send(err.message)
		}
		return res.status(520).send('Unknown error')
	})
});

app.post('/deletePost', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async (req, res, next) =>{

	// TODO: Validate fields
	const user = req.session.user
	if(!validateId(req.body.postId)){
		return res.status(400).send('Invalid post id')
	}

	deletePost(req.body.postId, user.id).then(result =>{
		logger.info("Delete post " + req.body.postId + " by " + user.id)
		res.status(200).send()
	}).catch(err=>{
		handleError(err, req.session.user.id)
		if(err.code===0){
			return res.status(400).send(err.message)
			// return res.status(400).json({number: err.message})
		}
		return res.status(520).send('Unknown error')
	})
})
app.post('/updatePostInfo', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async (req, res, next) => {
	const postData ={
		postId: req.body.postId,
		title: req.body.title,
	}
	if(!validateId(req.body.postId)){
		return res.status(400).send('Invalid post id')
	}
	const validationErrors = validatePost(postData, true, true)
	if(validationErrors !== true){
		return res.status(400).json(validationErrors);
	}
	const user = req.session.user
	updatePostInfo(postData, user.id).then(result=>{
		logger.info("Update post " + req.body.postId + " by " + user.id)
		res.status(200).send()
	}).catch(err=>{ 
		handleError(err, req.session.user.id)
		if(err.code===0){
			return res.status(400).send(err.message)
			// return res.status(400).json({number: err.message})
		}
		return res.status(520).send('Unknown error')
	});

});

// Ban goes bonk
app.post('/banUser', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async(req, res, next) => {
	const user = req.session.user
	// console.log(req.body.userId)
	if(!validateId(req.body.userId))	{
		return res.status(400).send('Invalid user id')
	}
	banUser(req.body.userId, user.id).then(result => {
		logger.info("Ban user " + req.body.userId + " by " + user.id)
		res.status(200).json(result)
	}).catch(err => {
		handleError(err, req.session.user.id)
		if(err.code === 0){
			return res.status(400).send(err.message)
			// return res.status(400).json({number: err.message})
		}
		return res.status(520).send('Unknown error')
		// return res.status(520).json({number: 'Unknown error'})
	})
})

// Get the list of all non admin users
app.post('/getUserList', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async(req, res, next) => {
	const user = req.session.user
	//checks if user is an admin, then returns all non-admin users if true
	getUserList(user.id).then(result => {
		logger.info("Get user list by " + user.id)
		res.status(200).json(result)
	}).catch(err => {
		handleError(err, req.session.user.id)
		if(err.code === 0){
			return res.status(400).send(err.message)
			// return res.status(400).json({number: err.message})
		}
		return res.status(520).send('Unknown error')
		// return res.status(520).json({number: 'Unknown error'})
	})
})


app.post('/updateProfile', authenticateUser, verifyCsrfTokenMiddleware,  upload.none(), async(req,res,next)=>{
	//validate updateProfile inputs
	const validationResult = validateForm(req.body)	
	req.body.id = req.session.user.id
	if (validationResult===true){
		req.body.age = parseInt(req.body.age, 10)
		updateUser(req.body)
			.then(result=>{
				logger.info("Update user info " + req.body.id)
				res.status(200).send()
			}).catch(err=>{ 
				handleError(err, req.session.user.id)
				if(err.code===0){
					//input number already belongs to another user
					return res.status(400).json({number: err.message})
				}
				return res.status(520).json({number: 'Unknown error'})
			});
	}else{
		return res.status(400).json(validationResult)
	}

})
app.post('/changePassword',authenticateUser,verifyCsrfTokenMiddleware, upload.none(), async(req,res,next)=>{
	errors={}
	const {currentpassword, newpassword, confirmpassword} = req.body
	if(!validatePassword(currentpassword)){
		errors.currentpassword = 'Invalid credentials'
		return res.status(400).json(errors)
	}
	if(!validatePassword(newpassword)){
		errors.newpassword = 'Password must be 12-63 characters long and include at least one number, one uppercase letter, one lowercase letter, and one special character (@._-!?).'
		return res.status(400).json(errors)
	}
	if(newpassword!==confirmpassword){
		errors.confirmpassword = 'Passwords do not match'
		return res.status(400).json(errors)
	}
	const id = req.session.user.id
	
	getUserPass(id)
		.then(result=>{
			//check if currentPassword is correct
			bcrypt.compare(currentpassword, result, function(err, result) {
				if(err){
					handleError(err, req.session.user.id)
					return res.status(520).json({currentpassword: 'Unknown error'})
				}
				if(result===true){
					//if currentPassword is correct, update password of user
					const pass = bcrypt.hashSync(newpassword,saltRounds)
					updateUserPass({id, pass})	
						.then(result=>{
							logger.info(id + " changed password.")
							//generate new session token 
							req.session.regenerate(function(err){
								if(err){
									handleError(err, req.session.user.id)
									return res.status(520).json({currentpassword: 'Unknown error'})
								}
								req.session.user = {id: id}
								return res.status(200).send()

							})
						}).catch(err=>{
							handleError(err, req.session.user.id)
							return res.status(520).json({currentpassword: 'Unknown error'})
						})
				}else{
					// console.log('wrong password')
					return res.status(400).json({currentpassword:'Invalid credentials'})
				}
			});
		}).catch(err=>{
			handleError(err, req.session.user.id)
			return res.status(520).json({currentpassword: 'Unknown error'})
		})
})

app.post('/updateProfilePicture', authenticateUser,verifyCsrfTokenMiddleware,  async(req,res,next)=>{
	//check first if there is error in uploading pfp
	upload.single('newprofilepic')(req,res, async function(err){
		if(err instanceof multer.MulterError){
			handleError(err, req.session.user.id)
			return res.status(400).json({newprofilepic: err.message});
		}else if(err){
			handleError(err, req.session.user.id)
			return res.status(400).json({newprofilepic: 'Unknown error'});
		}
		const id = req.session.user.id
		const profilepic = req.file;
		//if no input profile picture
		if (!profilepic) {
			return res.status(400).json({newprofilepic: 'Profile picture is required'});
		}
		const validImage = await validateImage(profilepic.path)
		if(validImage !==true){
			handleError(validImage, req.session.user.id)
			return res.status(400).json({newprofilepic: 'Invalid image file'})
		}else{
			//first get old pfp of user
			getUserProfilePicture(id)	
				.then(oldpfp=>{
					updateUserProfilePicture({id, path: profilepic.path})		
						.then(result=>{
							//if pfp was successfully updated, delete old pfp
							deleteFile(oldpfp)
							logger.info(id + " update profile picture.")
							return res.status(200).json({newprofilepic:profilepic.path})
						}).catch(err=>{
							handleError(err, req.session.user.id)
							return res.status(520).json({newprofilepic:'Unknown error'})
						})
				}).catch(err=>{
					handleError(err, req.session.user.id)
					return res.status(520).json({newprofilepic:'Unknown error'})
				})
		}
	})
})

app.get('/csrfToken', authenticateUser, async(req,res)=>{
	//responds with single-use token for action, prevents CSRF 
	const id = req.session.user.id
	const token = generateCsrfToken(id)
	return res.status(200).json({csrfToken:token})
})

// openssl genrsa -out client-key.pem 2048
// openssl req -new -key client-key.pem -out client.csr
// openssl x509 -req -in client.csr -signkey client-key.pem -out client-cert.cert

// generate 2048 bit private key (2045 bits because minimum acc to multiple sources- should be viable until 2030)
// Generate cert signing request - contains org details
// generate self signed cert- uses csr and private key
https.createServer(options, app).listen(port, () => {
	console.log(`Server is running on https://localhost:${port}`);
});
