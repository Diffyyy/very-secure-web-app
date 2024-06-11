const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const port = 3000;
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const {addUser, checkUser} = require('./db');
// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set the views directory to the current directory
//middleware function for debugging session
function logBeforeSession(req, res, next){
	console.log('-------------------------------------')
	console.log('BEFORE SESSION MIDDLEWARE: ')
	console.log(req.session)
	console.log('-------------------------------------')
	next()
}

function logAfterSession(req, res, next){
	console.log('-------------------------------------')
	console.log('AFTER SESSION MIDDLEWARE: ')
	console.log(req.session)
	console.log('-------------------------------------')
	next()
}
app.use(logBeforeSession)
app.use(session({
	//TODO: Change secret to env file secret
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true,
	cookie: {maxAge: 60000}
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

// Routes
app.get('/', (req, res) => {
	console.log(req.session)
	if(req.session && req.session.user){
		res.render('user', {email: req.session.user.email })
	}else{
		res.sendFile(path.join(__dirname, 'views', 'index.html'));
	}
});

app.get('/login', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/signup', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/admin', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});


// TODO: Backend checking: need to check again if all fields are valid
// FIXME: if want a button that goes back to home, need to change this else ok
app.post('/signup', upload.single('profilepic'), async (req, res) => {
	const { firstname, lastname, email, number, password, confirmpassword } = req.body;
	const formData = { firstname, lastname, email, number };
	const profilepic = req.file;

	if (!profilepic) {
		return res.status(400).json({profilepic: 'Profile picture is required'});
	}

	//TODO: checkers for valid name, email and number
	if (password !== confirmpassword) {
		//TO PRINT ERROR PROPERLY, put id of invalid input element as the key of json object, and the error message as value
		return res.status(400).json({confirmpassword: 'Passwords do not match'});
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
			const hash = bcrypt.hashSync(password,saltRounds)
			
			//TODO: Change pfp_path here
			addUser({firstname, lastname, email, number, password: hash, pfp:'PFP_PATH'})
				.then(result=>{
					console.log(result)
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

app.post('/login', loginLimiter, upload.none(), async(req, res)=>{
	const {email, password} = req.body
	checkUser({email})
		.then(hash=>{
			if(hash===false){
				//No email found
				console.log('No email found')
				return res.status(400).json({password:'Invalid login credentials'})
			}
			
			bcrypt.compare(password, hash, function(err, result) {
				console.log(typeof(hash))
				if(err){
					console.log(err)
					return res.status(400).send()
				}
				if(result===true){
					//correct password
					console.log('correct password')
					req.session.regenerate(function (err) {
						if (err) next(err)
						req.session.user = {email: email}
						req.session.save(function (err) {
							if (err) return next(err)

							res.redirect('/')
						})
					})
				}else{
					console.log('wrong password')
					return res.status(400).send()
				}
			});
		}).catch(err=>{
			console.log(err)
		})
	

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
