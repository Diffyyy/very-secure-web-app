require('dotenv').config()
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const Recaptcha = require('express-recaptcha').RecaptchaV2;
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const port = 3000;
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const {addUser, checkUser, getUserInfo} = require('./db');

// reCAPTCHA
const recaptcha = new Recaptcha(process.env.RECAPTCHA_SITE_KEY, process.env.RECAPTCHA_SECRET_KEY);

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
app.use(logBeforeSession)
app.use(session({
	//TODO: Change secret to env file secret
	secret: process.env.SESSION_SECRET,
	resave: process.env.SESSION_RESAVE,
	saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED,
	cookie: {maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE)}
}))
app.use(logAfterSession)

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 3,	// Limits IP Address 3 Times
  message: 'Too many login attempts, please try again after 15 minutes',
});

const upload = multer({
	dest: 'uploads/',
	limits: { fileSize: 2 * 1024 * 1024 }  // Limit file size to 2MB
});

// Routes
app.get('/', (req, res) => {
	if(req.session && req.session.user){
		getUserInfo({id: req.session.user.id}).then(user =>{
			if(user===false){
				return res.status(400).send('Invalid user')
			}
			if(user.isAdmin){
				res.render('admin', user); 
			}
			else{
				res.render('user', user)
			}	
			
		})
	}else{
		res.sendFile(path.join(__dirname, 'views', 'index.html'));
	}
});

app.get('/login', (req, res) => {
	// res.render('login.html', { recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY });
	res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/signup', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/admin', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.post('/signup', upload.single('profilepic'), async (req, res) => {
	const { lastname, firstname, email, number, password, confirmpassword } = req.body;
	const formData = { firstname, lastname, email, number };
	const profilepic = req.file;

	if (!profilepic) {
		return res.status(400).json({profilepic: 'Profile picture is required'});
	}
	try{
		const fileType = await import('file-type');
		const fileBuffer = fs.readFileSync(profilepic.path);
		const fileTypeResult = await fileType.fileTypeFromBuffer(fileBuffer);

		if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
			fs.unlinkSync(profilepic.path); // Delete the invalid file
			return res.status(400).json({profilepic: 'Invalid image file'})
		}
		else{ //Signup success

			if (!/^[A-Za-z]{1,20}$/.test(lastname)) {
				return res.status(400).json({lastname: 'Last name must be up to 20 English letters.'})
			}
			if (!/^[A-Za-z]{1,20}$/.test(firstname)) {
				return res.status(400).json({firstname: 'First name must be up to 20 English letters.'})
			}

			if (!/^[a-zA-Z\d]+([._-][a-zA-Z\d]+)*@[-a-zA-z\d]+(\.[-a-zA-Z\d]+)*\.[a-zA-z]{2,}$/.test(email)) {
				return res.status(400).json({email: 'Email format is invalid.'})
			}

			if (!/^(\+63|0)\d{10}$/.test(number)) {
				return res.status(400).json({number: 'Mobile number format is invalid.'})
			}

			if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_=+{};:,<.>\\?-]).{12,63}$/.test(password)) {
				return res.status(400).json({password: 'Password must be 12-63 characters long and include at least one number, one uppercase letter, one lowercase letter, and one special character (@._-!?).'})
			}
			if(password !== confirmpassword){
				return res.status(400).json({confirmpassword: 'Passwords do not match'})
			}
			const hash = bcrypt.hashSync(password,saltRounds)
			
			//TODO: Change pfp_path here
			addUser({firstname, lastname, email, number, password: hash, pfp:profilepic.path})
				.then(result=>{
					res.redirect('/login')
				}).catch(err=>{ //change pfp path here
					if(err.code===0){
						return res.status(400).json({email: 'Email or number already existing', number: 'Email or number already existing'})
					}
				});
		}
	}catch(err){
		//console.error('Error loading file-type module or processing image: ', err);
		return res.status(400).json({profilepic: 'Error processing image'})
		// res.status(500).send('Server error');
	}
});

app.post('/login', loginLimiter, recaptcha.middleware.verify, upload.none(), async(req, res)=>{
	const {email, password} = req.body
	if (!/^[a-zA-Z\d]+([._-][a-zA-Z\d]+)*@[-a-zA-z\d]+(\.[-a-zA-Z\d]+)*\.[a-zA-z]{2,}$/.test(email)) {
		return res.status(400).send()
	}

	if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_=+{};:,<.>\\?-]).{12,63}$/.test(password)) {
		return res.status(400).send()
	}
	if (!req.recaptcha.error){
		checkUser({email})
		.then(user=>{
			if(user===false){
				//No email found
				console.log('No email found')
				return res.status(400).send()
			}
			
			bcrypt.compare(password, user.password, function(err, result) {
				if(err){
					console.log(err)
					return res.status(400).send()
				}
				if(result===true){
					//correct password
					// console.log('correct password')
					req.session.regenerate(function (err) {
						if (err) next(err)
						req.session.user = {id: user.id}
						req.session.save(function (err) {
							if (err) return next(err)
							res.redirect('/')

						})
					})
				}else{
					// console.log('wrong password')
					return res.status(400).send()
				}
			});
		}).catch(err=>{
			console.log(err)
		})
	}
	else {
		res.status(400).json({captcha: 'CAPTCHA validation failed, please try again.'})
	}
})
app.post('/logout', upload.none(), async(req, res, next)=>{
	req.session.user = null
	req.session.save(function (err) {
		if (err) next(err)
		// regenerate the session, which is good practice to help
		// guard against forms of session fixation
		req.session.regenerate(function (err) {
			if (err) next(err)
			res.status(200).send()
		})
	})

})
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
