const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const port = 3000;
const app = express();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const {addUser} = require('./db');
// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'index.html'));
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


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
	dest: 'uploads/',
	limits: { fileSize: 2 * 1024 * 1024 }  // Limit file size to 2MB
});

//function for adding user
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


app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
