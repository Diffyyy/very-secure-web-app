const express = require('express');
const mysql = require('mysql2');
const path = require('path');
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


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});