const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const port = 3000;
const app = express();



const db = mysql.createConnection({
    host: 'localhost',     // Replace with your database host
    user: 'root',          // Replace with your database user
    password: 'Pass1234!',  // Replace with your database password
    database: 'mydb'    // Replace with your database name
});

// Connect to the database
db.connect(err => {
    if (err) {
      console.error('Error connecting to the database:', err.stack);
      return;
    }
    console.log('Connected to the database');
});

// DISCLAIMER: TRy executing a sql statement
// const sql = "INSERT INTO user (id, firstname, lastname, email, password, phone, pfp) VALUES ('1', 'A', 'A', 'try@email.com', '1234', '1234', 'lmao')";
//     db.query(sql, (err, result) => {
//         if (err) {
//             console.error('Error executing SQL query:', err.stack);
//             return;
//         }
// });

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


// TODO: Backend checking: need to check again if all fields are valid
// FIXME: if want a button that goes back to home, need to change this else ok
app.post('/signup', upload.single('profilepic'), async (req, res) => {
    const { firstname, lastname, email, number, password, confirmpassword } = req.body;
    const formData = { firstname, lastname, email, number };
    const profilepic = req.file;

    if (!profilepic) {
        return res.status(400).send('Profile picture is required');
    }

    //TODO: checkers for valid name, email and number
    if (password !== confirmpassword) {
        //FIXME: [DOES NOT WORK] return to signup page, restore filled out fields, and indicate an error message
        return res.redirect('/signup');
    }

    try{
        const fileType = await import('file-type');
        const fileBuffer = fs.readFileSync(profilepic.path);
        const fileTypeResult = await fileType.fileTypeFromBuffer(fileBuffer);

        if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
            fs.unlinkSync(profilepic.path); // Delete the invalid file
            //FIXME: [DOES NOT WORK] return to signup page, restore filled out fields, and indicate an error message
            return res.redirect('/signup')
        }
        else{ //Signup success
            //TODO: Put to db

            //Back to login
            return res.redirect('/login');
        }
    }catch(err){
        console.error('Error loading file-type module or processing image: ', err);
        // res.status(500).send('Server error');
    }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});