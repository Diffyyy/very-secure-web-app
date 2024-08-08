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
			return resolve(results)
			// if(results.length > 0){
				
			// }else{
			// 	handleError(new dbError('No posts fetched'), -1)
			// 	return resolve(false)
			// }
		})
   })
}

// Checks the user if currently banned
const checkIfBanned = (id) =>{
	return new Promise((resolve, reject) => {
		const checkIfBanned = 'SELECT id FROM user WHERE isBanned = false AND id = ?'
		db.execute(checkIfBanned, [id], (err, results) => {
			if(err){
				handleError(err)
				return reject(err)
			}
			if ( results.length > 0 ){
				return resolve(true)
			}else{
				//return false if user does not exist
				handleError(new dbError('User is banned', -1))
				return resolve(false)
			}
		})
	})
}
//check if user with given email exists
const checkUser = ({email})=>{
	return new Promise((resolve,reject)=>{
		const checkEmail = 'SELECT id, password,isBanned FROM user WHERE email = ?'
		db.execute(checkEmail, [email], (err, results)=>{
			if(err){
				return reject(err)
			}
			if ( results.length > 0 ){
				return resolve(results[0])
			}else{
				//return false if user does not exist
				handleError(new dbError('Error getting user from email, id does not exist', -1), email)
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
				//if user exists, check if user is an admin
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

// Sets the visibility of post to false
const deletePost = (id, user) =>{
	return new Promise((resolve, reject)=>{
		// Begin transaction
		db.beginTransaction(err => {
			if(err){
				return reject(err);
			}
			// Check first if the post exists
			const checkExistingQuery = 'SELECT user FROM post WHERE id = ?'
			db.execute(checkExistingQuery, [id], (err, results)=>{
				if(err){
					return db.rollback(() => reject(err));
				}
				if (results.length === 0) {
					return db.rollback(() => reject(new Error('Post not existing')));
				}
				const postOwnerId = results[0].user;
				const checkAdmin = 'SELECT id FROM admin WHERE id = ?';

				// If user owns the post
				if(postOwnerId === user){
					const updateQuery = 'UPDATE post SET isVisible = 0 WHERE id = ?'
					db.execute(updateQuery, [id], (err) =>{
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
				// Check if user is an admin
				else{
					db.execute(checkAdmin, [user], (err, results) => {
						if (err) {
							return reject(err);
						}
						if(results.length <= 0){
							return db.rollback(() => reject(new Error('User not authorized')));
						}
						else{
							const updateQuery = 'UPDATE post SET isVisible = 0 WHERE id = ?'
							db.execute(updateQuery, [id], (err) =>{
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
			})
		})
	})
}

// Returns the list of all the registered non admin users
const getUserList = (user) =>{
	return new Promise((resolve, reject) => {
		// Begin transaction
		db.beginTransaction(err => {
			if(err){
				return reject(err);
			}
			const checkAdmin = 'SELECT id FROM admin WHERE id = ?';
			// Check first if user is admin
			db.execute(checkAdmin, [user], (err, results) => {
				if (err) {
					return reject(err);
				}
				if(results.length <= 0){
					return db.rollback(() => reject(new Error('User not authorized')));
				}
				else{
					const getQuery = 'SELECT u.id, u.email, u.isBanned FROM user u LEFT JOIN admin a ON u.id = a.id WHERE a.id IS NULL;'
					db.execute(getQuery, (err, result) =>{
						if (err) {
							return db.rollback(() => reject(err));
						}
						// Commit transaction
						db.commit(err => {
							if (err) {
								return db.rollback(() => reject(err));
							}
							resolve(result)
						});

					})
				}
			});

		})
	})
}


// Ban hammer
// id is target user to ban, user is id of the current user
const banUser = (id, user) =>{
	return new Promise((resolve, reject) => {
		// Begin transaction
		db.beginTransaction(err => {
			if(err){
				return reject(err);
			}
			// Check first id is in db - user exists in the database
			const checkExistingQuery= 'SELECT * FROM user where id = ? '
			db.execute(checkExistingQuery, [id], (err, results)=>{
				if (err) {
                    return db.rollback(() => reject(err));
                }
				if (results.length === 0) {
                    return db.rollback(() => reject(new Error('User does not exist!')));
                }
				// Check if current user is an admin
				const checkAdmin = 'SELECT id FROM admin where id = ?'
				db.execute(checkAdmin, [user], (err) => {
					if(err){
						return db.rollback(() => reject(err));
					}
					if(results.length <= 0){
						return db.rollback(() => reject(new Error('User not authorized')));
					}
					// Check if the user to be banned is not an admin
					const checkBannedUserAdmin = 'SELECT id FROM admin WHERE id = ?'
					db.execute(checkBannedUserAdmin, [id], (err, bannedUserAdminResults) => {
                        if (err) {
                            return db.rollback(() => reject(err));
                        }
                        if (bannedUserAdminResults.length > 0) {
                            return db.rollback(() => reject(new Error('Cannot ban an admin user')));
                        }
                        // Change ban to unban or unban to ban
                        const updateUserQuery = 'UPDATE user SET isBanned = CASE WHEN isBanned = 0 THEN 1 WHEN isBanned = 1 THEN 0 END WHERE id = ?';
                        db.execute(updateUserQuery, [id], (err) => {
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
                        });
                    });
				})
			})
		})
	})
}

// For editing posts- updates post
const updatePostInfo = ({ postId, title, content }, user) => {
    return new Promise((resolve, reject) => {
        // Begin transaction
        db.beginTransaction(err => {
            if (err) {
                return reject(err);
            }
			
			// Check if the post exists and if the user has permission to edit it
			const checkExistingQuery = 'SELECT user FROM post WHERE id = ?'
			db.execute(checkExistingQuery, [postId], (err, results)=>{
				if (err) {
                    return db.rollback(() => reject(err));
                }
				if (results.length === 0) {
                    return db.rollback(() => reject(new Error('Post not existing')));
                }
				const postOwnerId = results[0].user;
				const checkAdmin = 'SELECT id FROM admin WHERE id = ?';
				
				// Check iff user owns the post
				if(postOwnerId === user){
					const updateQuery = 'UPDATE post SET title = ?, content = ?, date = CURRENT_TIMESTAMP WHERE id = ?'
					db.execute(updateQuery, [title, content, postId], (err) =>{
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
							return db.rollback(() => reject(new Error('User not authorized to edit post')));
						}
						else{
							const updateQuery = 'UPDATE post SET title = ?, content = ?, date = CURRENT_TIMESTAMP WHERE id = ?'
							db.execute(updateQuery, [title, content, postId], (err) =>{
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
			//check first if email or phone is already existing
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
				//add random number to max user id, as id of new user
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

const createPost = ({user,title, content}) => {
	return new Promise((resolve, reject) => {
		return db.beginTransaction(err => {

			if (err) {return reject(err);}

			const query = 'INSERT INTO post (user, title, content, isVisible) VALUES (?,  ?, ?, true)'
			db.execute(query, [user, title, content], (err, results) =>{
				if(err){
					return db.rollback(()=>{
						return reject(err)
					})
				}
				return db.commit((err)=>{
					if(err){
						return db.rollback(()=>{
							reject(err)
						})
					}
					resolve(results.insertId);
				});
			});
		});
	})
}

module.exports = {db, addUser, createPost, checkUser, getUserPass, updateUser, getUserInfo, updateUserPass, updateUserProfilePicture, getUserProfilePicture, getAllPosts, updatePostInfo, deletePost, getUserList, banUser, checkIfBanned};
