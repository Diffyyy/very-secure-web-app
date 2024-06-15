# very-secure-web-app
yes it's very secure

#How to deploy the application
1. Modify the .env file
	Change DB_USER and DB_PASSWORD to your MySQL user and password
2. Run MySQL Server
3. Execute the SQL inside schema.txt to initialize database
4. Run "npm install package.json" inside root folder of the web app
5. Run "node app.js" to start web app


To add an admin account, insert new entry in admin table with id of existing user who will become admin   
