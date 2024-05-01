This README provides a comprehensive guide to understanding and setting up the Project Management System.

Project Overview:
The Project Management System is a web-based application designed to simplify task management within an organization. It streamlines the process of assigning tasks to employees, tracking task progress, and facilitating clear communication throughout task lifecycles. This README offers an introduction to the project, its functionalities, and setup instructions.

Key Features:
User Authentication: Provides a secure login system for both employees and managers.
Dashboard: Personalized dashboards for employees and managers, displaying task-related information.
Task Management: Managers can efficiently assign, update, and close tasks, while employees can access and update their assigned tasks.
Email Notifications: Automatic email notifications are sent for task updates, closures, and reminders.
Reporting: Managers can access reports on task status and performance.
Responsive Design: The user-friendly interface is accessible on various devices.

How to Use:
Manager Access: Managers can log in to access their dashboards, assign tasks,update task statuses, view reports, and manage employees.
Employee Access: Employees can log in to view their tasks, update task statuses,view their reports and communicate with managers.
Email Notifications: The system automatically sends email notifications for task updates, closures, and reminders.

Prerequisites:
Navigate to the project folder using the command prompt.
Rename the app.txt file to app.js.
All the backend logic is in the app.js file and the HTML pages are in /views directory.

To set up the project, follow these steps:
Installing Dependencies:

Begin by downloading npm from the official portal.
Install Node.js for executing JavaScript files - npm install node
Initialize the project - node init -y
Install Express.js for running the backend server - npm install express
Add nodemailer for sending emails - npm install nodemailer
Utilize body-parser to extract data from HTML files - npm install body-parser
Schedule email notifications for deadlines using node-cron - npm install node-cron

Configure the Database:
Create a MongoDB database either on the cloud or host it locally.
Modify the connection URL string, database name, and collection name in the app.js file to match your setup.
The database name in app.js is "empInfo", collection name is "employeeInfo". These can be replaced by the actual db name and collection name.

Deployment:
Once the dependencies are installed and the database is configured, start the server with the command: node app.js.
Access the system on your localhost at port 3000 using the URL: http://localhost:3000/
Now, you can seamlessly use the system.