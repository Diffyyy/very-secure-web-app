require('dotenv').config()
const {handleError} = require('./error-handler')
const mysql = require('mysql2');
const db = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME
});

// Connect to the database
db.connect(err => {
	if (err) {
		handleError(err)	
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

// Get all posts from the db
const getAllPosts = () => {
   return new Promise((resolve, reject)=>{
		const displayPosts = 'SELECT p.id, p.title, p.content, p.date, p.user, u.firstname, u.lastname FROM post p JOIN user u ON p.user = u.id WHERE p.isVisible = true ORDER BY p.date DESC'
		db.execute(displayPosts, (err, results)=>{
			if(err){
				return reject(err)
			}
			if(results.length > 0){
				return resolve(results)
			}else{
				handleError(new dbError('No posts fetched'), -1)
				return resolve(false)
			}
		})
   })
}

const checkUser = ({email})=>{
	return new Promise((resolve,reject)=>{
		const checkEmail = 'SELECT id, password FROM user WHERE email = ?'
		db.execute(checkEmail, [email], (err, results)=>{
			if(err){
				return reject(err)
			}
			if ( results.length > 0 ){
				return resolve(results[0])
			}else{
				//return false if user does not exist
				handleError(new dbError('Error getting user from email, id does not exist'), -1)
				return resolve(false)
			}
		})
	})
}


const getUserInfo = ({id}) =>{
	return new Promise((resolve, reject)=>{
		const query = 'SELECT firstname, lastname, email, phone,age, pfp FROM user WHERE id = ?' 
		db.execute(query, [id], (err, results)=>{
			if(err){
				return reject(err)
			}
			if(results.length > 0){
				const user = results[0]
				const checkAdmin = 'SELECT id FROM admin WHERE id = ?';
				db.execute(checkAdmin, [id], (err, results) => {
					if (err) {
						return reject(err);
					}
					user.isAdmin = results.length > 0;
					return resolve(user);
				});
			}else{
				//return false if user does not exist
				handleError(new dbError('Error getting user info, id does not exist'), -1)
				return resolve(false)
			}
		})
	})
}

const getUserPass = (id) =>{
	return new Promise((resolve, reject)=>{
		const query = 'SELECT password FROM user WHERE id = ?' 
		db.execute(query, [id], (err, results)=>{
			if(err){
				return reject(err)
			}
			if(results.length > 0){
				return resolve(results[0].password)
			}else{
				return reject(new dbError('User does not exist', -1))
			}
		})
	})
}
const updateUserPass = ({id, pass})=>{
	return new Promise((resolve,reject)=>{
		const updateQuery = 'UPDATE user SET password = ? WHERE id = ?';
		db.execute(updateQuery, [pass, id], (err, results)=>{
			if(err){
				return reject(err)
			}
			return resolve()
		})
	})

}

const getUserProfilePicture = (id)=>{
	return new Promise((resolve, reject)=>{
		const query = 'SELECT pfp FROM user WHERE id = ?' 
		db.execute(query, [id], (err, results)=>{
			if(err){
				return reject(err)
			}
			if(results.length > 0){
				const user = results[0]
				return resolve(user.pfp)
			}else{
				return reject(new dbError('User does not exist', -1))
			}
		})
	})
}
const updateUserProfilePicture = ({id, path})=>{
	return new Promise((resolve,reject)=>{
		const updateQuery = 'UPDATE user SET pfp = ? WHERE id = ?';
		db.execute(updateQuery, [path, id], (err, results)=>{
			if(err){
				return reject(err)
			}
			return resolve()
		})
	})
}


// TODO: Update the title, content and date of post in the db post table. Before updating, make sure that the owner of the post is the user (user == id) or user is admin
const updatePostInfo = ({ id, title, content, date }, user) => {
    return new Promise((resolve, reject) => {
        // Begin transaction
        db.beginTransaction(err => {
            if (err) {
                return reject(err);
            }
			console.log(id)
			console.log(title)
			console.log(content)
			console.log(date)
			
			// Check if the post exists and if the user has permission to edit it
			const checkExistingQuery = 'SELECT user FROM post WHERE id = ?'
			db.execute(checkExistingQuery, [id], (err, results)=>{
				if (err) {
                    return db.rollback(() => reject(err));
                }
				if (results.length === 0) {
                    return db.rollback(() => reject(new Error('Post not existing')));
                }
				const postOwnerId = results[0].user;
				const checkAdmin = 'SELECT id FROM admin WHERE id = ?';
				
				// If user owns the post
				if(postOwnerId === user){
					const updateQuery = 'UPDATE post SET title = ?, content = ?, date = ? WHERE id = ?'
					db.execute(updateQuery, [title, content, date, id], (err) =>{
						if (err) {
							return db.rollback(() => reject(err));
						}
						// Commit transaction
						db.commit(err => {
							if (err) {
								return db.rollback(() => reject(err));
							}
							resolve();
						});
						
					})
				}
				// If not, check admin. If it is admin, update db
				else{
					db.execute(checkAdmin, [user], (err, results) => {
						if (err) {
							return reject(err);
						}
						if(results.length <= 0){
							return db.rollback(() => reject(new Error('User not authorized')));
						}
						else{
							const updateQuery = 'UPDATE post SET title = ?, content = ?, date = ? WHERE id = ?'
							db.execute(updateQuery, [title, content, date, id], (err) =>{
								if (err) {
									return db.rollback(() => reject(err));
								}
								// Commit transaction
								db.commit(err => {
									if (err) {
										return db.rollback(() => reject(err));
									}
									resolve();
								});
								
							})
						}
					});
				}

				if (postOwnerId !== user) {
					
                    
                }
				

			})
            
        });
    });
};


const updateUser = ({id, firstname, lastname, number, age }) => {
    return new Promise((resolve, reject) => {
        // Begin transaction
        db.beginTransaction(err => {
            if (err) {
                return reject(err);
            }

            // Check if the number already exists for another user
            const checkExisting = 'SELECT id FROM user WHERE phone = ?';
            db.execute(checkExisting, [number], (err, results) => {
                if (err) {
                    return db.rollback(() => {
                        reject(err);
                    });
                }
                // If the number is found for another user, reject with an error
                if (results.length > 0 && results[0].id !==id) {
                    return reject(new dbError('Number already existing', 0));
                }

                // Proceed with updating the user information
                const updateQuery = 'UPDATE user SET firstname = ?, lastname = ?, phone = ?, age = ? WHERE id = ?';
                db.execute(updateQuery, [firstname, lastname, number, age, id], (err, results) => {
                    if (err) {
                        return db.rollback(() => {
                            reject(err);
                        });
                    }

                    // Commit transaction if update is successful
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                reject(err);
                            });
                        }
                        resolve('Successfully updated user');
                    });
                });
            });
        });
    });
};
const addUser = ({ firstname, lastname, email, number,age, password, pfp}) => {
	return new Promise((resolve, reject) => {
		return db.beginTransaction(err => {

			if (err) {
				
				return reject(err);
			}

			const checkExisting = 'SELECT id FROM user WHERE email = ? OR phone = ?'
			db.execute(checkExisting, [email, number], (err, results)=>{
				if(err){
					return db.rollback(()=>{
						return reject(err)
					});
				}
				if(results.length > 0){
					return reject(new dbError('User already existing', 0))
				}
				
				const query = 'SELECT MAX(id) AS maxId FROM user';
				//For now, add random number to max id to create new id
				db.query(query, (err, results) => {
					if (err) {
						return db.rollback(()=>{
							return reject(err)
						});
					}
					const maxId = results.length > 0 ?results[0].maxId:0;
					const min = 1;
					const max = 100;
					const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;

					const newId = maxId + randomInt
					const insertQuery = 'INSERT INTO user (id, firstname, lastname, email, password,phone,age, pfp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
					db.execute(insertQuery, [newId, firstname, lastname, email, password, number, age, pfp], (err) =>{
						if(err){
							return db.rollback(()=>{
								return reject(err)
							});
						}
						return db.commit((err)=>{

							if(err){
								return db.rollback(()=>{
									return reject(err)
								})
							}
							resolve("Successfully added user");
						});
					});
				});
			})
		});
	})
}
module.exports = {addUser, checkUser,getUserPass, updateUser, getUserInfo, updateUserPass, updateUserProfilePicture, getUserProfilePicture, getAllPosts, updatePostInfo};
