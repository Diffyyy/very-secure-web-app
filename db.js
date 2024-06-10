
const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',     // Replace with your database host
    user: 'root',          // Replace with your database user
    password: 'admin',  // Replace with your database password
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
class dbError extends Error{
	constructor(message, code){
		super(message)
		this.name = "dbError"
		this.code = code
	}
}
const checkUser = ({email})=>{
	return new Promise((resolve,reject)=>{
		const checkEmail = 'SELECT password FROM user WHERE email = ?'
		db.execute(checkEmail, [email], (error, results)=>{
			if(error){
				return reject(new dbError('Error occurred while checkingEmail', -1))
			}
			if ( results.length > 0 ){
				return resolve(results[0].password)	
			}else{
				return resolve(false)
			}
		})
	})
}

const addUser = ({ firstname, lastname, email, number, password, pfp}) => {
	return new Promise((resolve, reject) => {
		return db.beginTransaction(err => {

			if (err) {
				
				return reject(new dbError('Error occurred while creating the transaction', -1));
			}

			const checkExisting = 'SELECT id FROM user WHERE email = ? OR phone = ?'
			db.execute(checkExisting, [email, number], (error, results)=>{
				if(err){
					return db.rollback(()=>{
						return reject(new dbError('Error occurred while executing checkExistingQuery', -1))
					});
				}
				if(results.length > 0){
					return reject(new dbError('User already existing', 0))
				}
				
			})
			const query = 'SELECT MAX(id) AS maxId FROM user';
			//For now, add random number to max id to create new id
			db.query(query, (error, results) => {
				if (error) {
					return db.rollback(()=>{
						return reject(new dbError('Error occurred while executing selectMaxId Query', -1))
					});
				}
				const maxId = results.length > 0 ?results[0].maxId:0;
				const min = 1;
				const max = 100;
				const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;

				const newId = maxId + randomInt
				const insertQuery = 'INSERT INTO user (id, firstname, lastname, email, password,phone, pfp) VALUES (?, ?, ?, ?, ?, ?, ?)'
				db.execute(insertQuery, [newId, firstname, lastname, email, password, number, pfp], (err) =>{
						if(err){
							return db.rollback(()=>{
								return reject(new dbError('Error occurred while executing insertQuery', -1))
							});
						}
						return db.commit((err)=>{

							if(err){
								return db.rollback(()=>{
									return reject(new dbError("Commit failed", -1))
								})
							}
							resolve("Successfully added user");
						});
					});
			});
		});
	})
}
module.exports = {addUser, checkUser};
