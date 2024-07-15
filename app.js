require('dotenv').config()
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const port = 3000;
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const logger = require('./logger'); // import logger module

const {generateCsrfToken, verifyCsrfTokenMiddleware} = require('./csrf-token')
const {addUser, checkUser, updateUser, getUserInfo, getUserPass, updateUserPass, updateUserProfilePicture, getUserProfilePicture, getAllPosts, updatePostInfo, deletePost, getUserList, banUser, checkIfBanned} = require('./db');
const {deleteFile, validateImage} = require('./files')
const {validateForm, validatePassword, validateEmail} = require('./assets/js/profile-validation');
const{validateTitle, validateContent, validatePost} = require('./assets/js/post-validation');
const {handleError} = require('./error-handler')
// reCAPTCHA
// const recaptcha = new Recaptcha(process.env.RECAPTCHA_SITE_KEY, process.env.RECAPTCHA_SECRET_KEY);
// Serve static files (CSS, JS, images)
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
function authenticateUser(req,res,next){
	if(req.session && req.session.user){
		checkIfBanned(req.session.user.id).then(isNotBanned =>{
			if(isNotBanned){
				next()
			}else{
				//User is banned
				res.status(403).render('index')
			}
		}).catch(err => {
			handleError(err)
			res.status(500).send('Internal Server Error');
		})
	}else{
		//request timeout
		res.status(408).render('index')
	}
}
app.use(logBeforeSession)
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: process.env.SESSION_RESAVE,
	saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED,
	cookie: {maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE)}
}))
app.use(logAfterSession)

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 3,
  message: 'Too many login attempts, please try again after 15 minutes',
});

const upload = multer({
	dest: 'uploads/',
	limits: { fileSize: 2 * 1024 * 1024 }  // Limit file size to 2MB
});

app.get('/profile', authenticateUser, (req,res)=>{
	getUserInfo({id: req.session.user.id}).then(user =>{
		if(user===false){
			return res.status(400).send('Invalid user')
		}
		res.render('user', {...user})
	}).catch(err=>{
		handleError(err)
		res.status(520).send('Error in fetching user')
	})
})
app.get('/',authenticateUser, (req, res) => {
	getUserInfo({id: req.session.user.id}).then(user =>{
		if(user===false){
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
			handleError(err)
			res.status(520).send('Error in fetching posts')
		})
	}).catch(err=>{
		handleError(err)
		res.status(520).send('Error in fetching user')
	})
});

app.get('/login', (req, res) => {
	res.render('login')
});

app.get('/signup', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/admin', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.post('/signup', upload.single('profilepic'), async (req, res) => {
	const { lastname, firstname, email, number,age, password, confirmpassword } = req.body;
	const profilepic = req.file;

	if (!profilepic) {
		return res.status(400).json({profilepic: 'Profile picture is required'});
	}
	const validImage = await validateImage(profilepic.path)
	if(!validImage)	{
		return res.status(400).json({profilepic: 'Invalid image file'})
	}
	else{ //Signup success
		req.body.profilepic = profilepic
		const validationResult = validateForm(req.body, true);
		if (validationResult!==true){
			return res.status(400).json(validationResult)
		}
		const hash = bcrypt.hashSync(password,saltRounds)
		//TODO: Change pfp_path here
		addUser({firstname, lastname, email, number,age:parseInt(age,10), password: hash, pfp:profilepic.path})
			.then(result=>{
				logger.info(email + " signed up.")
				res.redirect('/login')
			}).catch(err=>{ //change pfp path here
				handleError(err)
				if(err.code===0){
					return res.status(400).json({email: 'Email or number already existing', number: 'Email or number already existing'})
				}
			});
	}
	// res.status(500).send('Server error');
});

app.post('/login', loginLimiter, upload.none(), async(req, res)=>{
	const {email, password} = req.body
	if (!validateEmail(email)) {
		return res.status(400).send()
	}
	if (!validatePassword(password)) {
		return res.status(400).send()
	}
	if (true){
		checkUser({email})
			.then(user=>{
				if(user===false){
					return res.status(400).send()
				}
				if(user.isBanned===1){
					return res.status(403).send()
				}
				bcrypt.compare(password, user.password, function(err, result) {
					if(err){
						handleError(err)
						return res.status(520).send()
					}
					if(result===true){
						//correct password
						// console.log('correct password')
						logger.info(user.id + " logged in.")
						req.session.regenerate(function (err) {
							if (err) {
								handleError(err)
						 		return res.status(520).send()
							}
							req.session.user = {id: user.id}
							req.session.save(function (err) {
								if (err){
									handleError(err)
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
				handleError(err)
				return res.status(520).send()
			})
	}
	else {
		res.status(400).json({captcha: 'CAPTCHA validation failed, please try again.'})
	}

})
app.post('/logout', upload.none(), async(req, res, next)=>{
	temp = req.session.user
	req.session.user = null
	req.session.save(function (err) {
		if (err){
			handleError(err)
			res.status(520).send()
		} 
		// regenerate the session, which is good practice to help
		// guard against forms of session fixation
		req.session.regenerate(function (err) {
			if (err){
				handleError(err)
				res.status(520).send()
			} 
			logger.info(temp.id + " logged out")
			temp = null
			res.status(200).send()
		})
	})

})


app.post('/deletePost', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async (req, res, next) =>{

	// TODO: Validate fields
	const user = req.session.user

	deletePost(req.body.postId, user.id).then(result =>{
		logger.info("Delete post " + req.body.postId + " by " + user.id)
		res.status(200).send()
	}).catch(err=>{
		handleError(err)
		if(err.code===0){
			return res.status(400).send(err.message)
			// return res.status(400).json({number: err.message})
		}
		return res.status(520).send('Unknown error')
	})
})
app.post('/updatePostInfo', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async (req, res, next) => {
    const postData ={
		id: req.body.postId,
		title: req.body.title,
		content: req.body.content,
		date: req.body.date, // Or use req.body.date if you're passing it from the form
	}
	// TODO: validate all fields
	// const validationErrors = validatePost(postData);
	// if (validationErrors === true) {
		
	// }else{
	// 	return res.status(400).json({ errors: validationErrors });
	// }

	const user = req.session.user
	
	updatePostInfo(postData, user.id).then(result=>{
		logger.info("Update post " + req.body.postId + " by " + user.id)
		res.status(200).send()
	}).catch(err=>{ 
		handleError(err)
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
	console.log(req.body.userId)
	banUser(req.body.userId, user.id).then(result => {
		logger.info("Ban user " + req.body.userId + " by " + user.id)
		res.status(200).json(result)
	}).catch(err => {
		handleError(err)
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
	getUserList(user.id).then(result => {
		logger.info("Get user list by " + user.id)
		res.status(200).json(result)
	}).catch(err => {
		handleError(err)
		if(err.code === 0){
			return res.status(400).send(err.message)
			// return res.status(400).json({number: err.message})
		}
		return res.status(520).send('Unknown error')
		// return res.status(520).json({number: 'Unknown error'})
	})
})


app.post('/updateProfile', authenticateUser, verifyCsrfTokenMiddleware, upload.none(), async(req,res,next)=>{
	const validationResult = validateForm(req.body)	
	req.body.id = req.session.user.id
	if (validationResult===true){
		req.body.age = parseInt(req.body.age, 10)
		updateUser(req.body)
			.then(result=>{
				logger.info("Update user info " + req.body.id)
				res.status(200).send()
			}).catch(err=>{ //change pfp path here
				handleError(err)
				if(err.code===0){
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
			bcrypt.compare(currentpassword, result, function(err, result) {
				if(err){
					handleError(err)
					return res.status(520).json({currentpassword: 'Unknown error'})
				}
				if(result===true){
					const pass = bcrypt.hashSync(newpassword,saltRounds)
					updateUserPass({id, pass})	
						.then(result=>{
							return res.status(200).send()
						}).catch(err=>{
							handleError(err)
							return res.status(520).json({currentpassword: 'Unknown error'})
						})
				}else{
					// console.log('wrong password')
					return res.status(400).json({currentpassword:'Invalid credentials'})
				}
			});
		}).catch(err=>{
			handleError(err)
			return res.status(520).json({currentpassword: 'Unknown error'})
		})
})

app.post('/updateProfilePicture', authenticateUser,verifyCsrfTokenMiddleware, upload.single('newprofilepic'), async(req,res,next)=>{
	const id = req.session.user.id
	const profilepic = req.file;
	if (!profilepic) {
		return res.status(400).json({newprofilepic: 'Profile picture is required'});
	}
	const validImage = await validateImage(profilepic.path)
	if(!validImage)	{
		return res.status(400).json({newprofilepic: 'Invalid image file'})
	}else{
		getUserProfilePicture(id)	
			.then(oldpfp=>{
				updateUserProfilePicture({id, path: profilepic.path})		
					.then(result=>{
						deleteFile(oldpfp)
						return res.status(200).json({newprofilepic:profilepic.path})
					}).catch(err=>{
						handleError(err)
						return res.status(520).json({newprofilepic:'Unknown error'})
					})
			}).catch(err=>{
				handleError(err)
				return res.status(520).json({newprofilepic:'Unknown error'})
			})
	}
})
app.get('/csrfToken', authenticateUser, async(req,res)=>{
	const id = req.session.user.id
	const token = generateCsrfToken(id)
	return res.status(200).json({csrfToken:token})
})
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
