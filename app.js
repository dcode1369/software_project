const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { MongoClient } = require('mongodb');
const url='mongodb://127.0.0.1:27017';
const dbName="empInfo";
const client = new MongoClient(url, { useUnifiedTopology: true });
var empId;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*-------------------------------------Task Reminder----------------------------------------*/

var job=cron.schedule('30 9 * * *', async () => {
  await sendReminderEmails();
  
  console.log('Reminder emails sent.');
});
job.start();
// sendReminderEmails();
async function sendReminderEmails() {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');
    const currentDate = new Date();

    const pdcReminderDate = new Date();
    pdcReminderDate.setDate(currentDate.getDate() + 3);

    const tasks = await collection.find({
      'task.pdc': { $lte: pdcReminderDate.toISOString().split('T')[0] },
    }).toArray();
    
    const filteredTasks = tasks.map((task) => {
      const { name,email, task: taskDetails } = task;
      const filteredTaskDetails = taskDetails.filter((task) => task.status !== 'Closed');
      return { name,email, task: filteredTaskDetails };
    });
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'demoa8801@gmail.com',
        pass: 'qhiorlbfbrhclrmn',
      },
    });
    for (const employee of filteredTasks) {
      const name=employee.name;
      const employeeEmail=employee.email;
      for (const subTask of employee.task) {
        const crNumber = subTask.crNumber;
        const pdc = subTask.pdc;

        const mailOptions = {
          from: 'demoa8801@gmail.com',
          to: employeeEmail,
          subject: `Task Reminder for ${crNumber}`,
          html: `
            <html>
              <body>
                <p>Dear ${name},</p>
                <p>This is a reminder for your task with CR Number ${crNumber}, which is due on ${pdc}.</p>
                <p>Please make sure to complete it on time.</p>
                <br>
                <p>Best regards.</p>
              </body>
            </html>
          `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending reminder email:', error);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error sending reminder emails:', err);
  } finally {
    await client.close();
  }
}

/*-------------------------------------Login Page------------------------------------------*/

app.post('/login', async (req, res) => {
    empId = req.body.empId;
    const password = req.body.password;
    try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection('employeeInfo'); 
  
      const user = await collection.findOne({ empId:empId });
  
      if (user && user.password === password) {
        if(user.role==="Project Manager")
        res.redirect('/manager');
        else
        res.redirect('/employee');
      } else {
        res.render('login', { error: "Please check your credentials" });
      }
  
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
      res.status(500).send('Internal Server Error');
    } finally {
      await client.close();
    }
  });

/*-----------------------------------------Task Assignment----------------------------------*/

app.post('/assign', async (req, res) => {
  const mngId = req.body.mngId;
  const mngName=req.body.mngName;
  const employeeId = req.body.empId;
  const actionItem = req.body.actionItem;
  const taskType = req.body.taskType;
  const crNumber = req.body.crNumber;
  const crDetails = req.body.crDetails;
  const assignedOn = req.body.assignedOn;
  const pdc = req.body.pdc;
  const adc = "";
  const mangRemarks = req.body.mangRemarks;
  const assignedBy = mngId;
  const additionalCC=req.body.additionalCC;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const existingTask = await collection.findOne({ 'task.crNumber': crNumber });

    if (existingTask) {
      return res.redirect('/assignTask?mngName=' + mngName + '&mngId=' + mngId + '&error=' + encodeURIComponent('Task with the same CR Number already exists'));
    }
    const new_task = {
      actionItem: actionItem,
      taskType: taskType,
      crNumber: crNumber,
      crDetails: crDetails,
      assignedOn: assignedOn,
      pdc: pdc,
      adc: adc,
      mangRemarks: mangRemarks,
      empRemarks:"",
      assignedBy: assignedBy,
      status: "Assigned"
    };

    const employee = await collection.findOne({ empId: employeeId });
    if (!employee || employee.mngId !== mngId) {
      return res.redirect('/assignTask?mngName=' + mngName + '&mngId=' + mngId + '&error=' + encodeURIComponent('Employee not found or not under your management'));
    }
    let employeeEmail = 'employee@example.com';
    if(employee)
    employeeEmail=employee.email;
    const manager = await collection.findOne({ empId: mngId });
    const managerEmail = manager.email;
    const additionalCCArray = additionalCC.split(',');
    const additionalCCEmails = [];
    for (const empId of additionalCCArray) {
      const employee = await collection.findOne({ empId: empId.trim() });
      if (employee) {
        additionalCCEmails.push(employee.email);
      }
    }
    const ccEmails = [managerEmail, ...additionalCCEmails].join(','); 
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'demoa8801@gmail.com',
        pass: 'qhiorlbfbrhclrmn',
      },
    });

    const mailOptions = {
      from: 'demoa8801@gmail.com',
      to: employeeEmail,
      cc: ccEmails,
      subject: 'New Task Assigned',
      html: `
        <html>
          <body>
            <p>Dear ${employee.name},</p>
            <p>We hope this message finds you well. We are writing to inform you about a new task that has been assigned to you.</p>
            <p><strong>CR Number:</strong> ${crNumber}</p>
            <p><strong>CR Details:</strong> ${crDetails}</p>
            <p><strong>Assigned On:</strong> ${assignedOn}</p>
            <p><strong>Due Date:</strong> ${pdc}</p>
            <p><strong>Manager Remarks:</strong> ${mangRemarks}</p>
            <br>
            <p>You can view more details on your dashboard.</p>
            <p>Best regards.</p>
          </body>
        </html>
      `,
    };

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error(error);
        res.status(500).send('An error occurred while sending the email.');
      } else {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('employeeInfo');
        collection.updateOne(
          { empId: employeeId },
          { $push: { task: new_task } }
        ).then(() => {
          return res.redirect('/assignTask?mngName=' + mngName + '&mngId=' + mngId + '&success=' + encodeURIComponent('Task Successfully Assigned'));
        }).catch((updateError) => {
          console.error('Error updating employee task:', updateError);
          res.status(500).send('Internal Server Error');
        });
      }
    });
  } catch (err) {
    console.error('Error performing task assignment:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

/*-------------------------------------------Add Employee--------------------------------------*/

app.post('/addEmployee', async (req, res) => {
  const employeeId = req.body.employeeId;
  const empName = req.body.empName;
  const empRole = req.body.empRole;
  const empMail = req.body.empMail;
  const empPhone = req.body.empPhone;
  const empPass = req.body.employeeId;
  const mngName=req.body.mngName;
  const mngId=empId;
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');
    const newEmployee = {
      empId: employeeId,
      name: empName,
      role: empRole,
      email: empMail,
      phone: empPhone,
      password: empPass,
      mngId:mngId,
      task: []
    };
    const result = await collection.insertOne(newEmployee);
    res.redirect('manager');
  } catch (err) {
    console.error('Error adding employee:', err);
    res.status(500).send(`Internal Server Error: ${err.message}`);
  } finally {
    await client.close();
  }
});

/*--------------------------------------------Update Task Status-------------------------------*/

app.post('/updateTaskStatus', async (req, res) => {
  const { crNumber, status, mangRemarks, empRemarks } = req.body;
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const filter = { 'task.crNumber': crNumber };
    let update = { $set: { 'task.$.status': status, 'task.$.mangRemarks': mangRemarks, 'task.$.empRemarks': empRemarks } };
    
    if (status === 'Closed') {
      const currentDate = new Date();
      update = {
        $set: {
          'task.$.status': status,
          'task.$.mangRemarks': mangRemarks,
          'task.$.empRemarks': empRemarks,
          'task.$.adc': currentDate.toISOString().split('T')[0] 
        }
      };
    }
    const result = await collection.updateOne(filter, update);
    
    const employee = await collection.findOne(filter);
    const empName=employee.name;
    const empMail=employee.email;
    const mngId=employee.mngId;
    const manager = await collection.findOne({ empId: mngId });
    let mngMail='mng@example.com';
    if (manager) {
      mngMail = manager.email;
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'demoa8801@gmail.com',
        pass: 'qhiorlbfbrhclrmn',
      },
    });
    let mailOptions;
    if(status!=='Closed')
    {
      mailOptions = {
        from: 'demoa8801@gmail.com',
        to: empMail,
        cc: mngMail,
        subject: `Update on task ${crNumber}`,
        html: `
          <html>
            <body>
              <p>Dear ${employee.name},</p>
              <p>We have an update on your task ${crNumber}.</p>
              <p><strong>CR Number:</strong> ${crNumber}</p>
              <p><strong>Status:</strong> ${status}</p>
              <p><strong>Manager Remarks:</strong> ${mangRemarks}</p>
              <p><strong>Employee Remarks:</strong> ${empRemarks}</p>
              <br>
              <p>You can view more details on your dashboard.</p>
              <p>Best regards.</p>
            </body>
          </html>
        `,
      };
    }
    else
    {
      mailOptions = {
        from: 'demoa8801@gmail.com',
        to: empMail,
        cc: mngMail,
        subject: `Update on task ${crNumber}`,
        html: `
          <html>
            <body>
              <p>Dear ${employee.name},</p>
              <p>Your task with CR Number ${crNumber} has been closed</p>
              <p><strong>Manager Remarks:</strong> ${mangRemarks}</p>
              <p><strong>Employee Remarks:</strong> ${empRemarks}</p>
              <br>
              <p>You can view more details on your dashboard.</p>
              <p>Best regards.</p>
            </body>
          </html>
        `,
      };
    }
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        res.status(500).send('An error occurred while sending the email.');
      }
    });
    return res.status(200).json({ message: 'Task status updated successfully' });
  } catch (err) {
    console.error('Error updating task status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.close();
  }
});

/*---------------------------------------------Employee Report---------------------------------*/

app.post('/empReport', async (req, res) => {
  const empId = req.body.empId;
  const empName = req.body.empName;
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);
  const status=req.body.status;
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');
    let tasksData;
    if(status!=='All')
    {
      tasksData = await collection.find({
        empId: empId,
        'task.status':status,
        'task.assignedOn': {
          $gte: startDate.toISOString().split('T')[0],
          $lte: endDate.toISOString().split('T')[0],
        },
      }).project({ task: 1, _id: 0 }).toArray();
    }
    else
    {
      tasksData = await collection.find({
        empId: empId,
        'task.assignedOn': {
          $gte: startDate.toISOString().split('T')[0],
          $lte: endDate.toISOString().split('T')[0],
        },
      }).project({ task: 1, _id: 0 }).toArray();
    }

    const tasks = tasksData
      .flatMap((doc) => doc.task)
      .filter((task) => {
        const taskDate = new Date(task.assignedOn);
        return taskDate >= startDate && taskDate <= endDate && (status === 'All' || task.status === status);
      });
    res.render('empReport', { empName: empName, empId: empId, tasks: tasks });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

/*---------------------------------------------Manager Report---------------------------------*/

app.post('/mngReport', async (req, res) => {
  const empId = req.body.empId;
  const mngId = req.body.mngId;
  const mngName = req.body.mngName;
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);
  const status = req.body.status;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');
    let tasksData;

    if (empId !== '') {
      if (status !== 'All') {
        tasksData = await collection.find({
          empId: empId,
          'task.assignedOn': {
            $gte: startDate.toISOString().split('T')[0],
            $lte: endDate.toISOString().split('T')[0],
          },
        }).project({ empId: 1, name: 1, task: 1, _id: 0 }).toArray();
      } else {
        tasksData = await collection.find({
          empId: empId,
          'task.assignedOn': {
            $gte: startDate.toISOString().split('T')[0],
            $lte: endDate.toISOString().split('T')[0],
          },
        }).project({ empId: 1, name: 1, task: 1, _id: 0 }).toArray();
      }
    } else {
      if (status !== 'All') {
        tasksData = await collection.find({
          mngId: mngId,
          'task.assignedOn': {
            $gte: startDate.toISOString().split('T')[0],
            $lte: endDate.toISOString().split('T')[0],
          },
        }).project({ empId: 1, name: 1, task: 1, _id: 0 }).toArray();
      } else {
        tasksData = await collection.find({
          mngId: mngId,
          'task.assignedOn': {
            $gte: startDate.toISOString().split('T')[0],
            $lte: endDate.toISOString().split('T')[0],
          },
        }).project({ empId: 1, name: 1, task: 1, _id: 0 }).toArray();
      }
    }
    
    const tasks = tasksData
    .flatMap((doc) => doc.task.map((task) => ({
      ...task,
      empId: doc.empId,
      empName: doc.name,
    })))
    .filter((task) => {
      const taskDate = new Date(task.assignedOn);
      return taskDate >= startDate && taskDate <= endDate && (status === 'All' || task.status === status);
    });

      
    res.render('mngReport', { mngName: mngName, mngId: mngId, tasks: tasks });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

/*-----------------------------------------Password Change----------------------------------*/

app.post('/resetPass', async (req, res) => {
  const empId = req.body.empId;
  const empName = req.body.empName;
  const password = req.body.newPassword;
  const cnfrm = req.body.confirmPassword;
  
  if (password !== cnfrm) {
    return res.redirect('/resetPass?empName=' + empName + '&empId=' + empId + '&error=' + encodeURIComponent('Password and Confirm Password do not match'));
  }
  
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    await collection.updateOne(
      { empId: empId },
      { $set: { password: password } }
    );
    
    return res.redirect('/resetPass?empName=' + empName + '&empId=' + empId + '&message=' + encodeURIComponent('Password Changed Successfully'));
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.post('/mngReset', async (req, res) => {
  const mngId = req.body.mngId;
  const mngName = req.body.mngName;
  const password = req.body.newPassword;
  const cnfrm = req.body.confirmPassword;
  
  if (password !== cnfrm) {
    return res.redirect('/mngReset?mngName=' + mngName + '&mngId=' + mngId + '&error=' + encodeURIComponent('Password and Confirm Password do not match'));
  }
  
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    await collection.updateOne(
      { empId: mngId },
      { $set: { password: password } }
    );
    
    return res.redirect('/mngReset?mngName=' + mngName + '&mngId=' + mngId + '&message=' + encodeURIComponent('Password Changed Successfully'));
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

/*-----------------------------------------Get Requests-------------------------------------*/

app.get('/',(req,res)=>{
    res.render('login');
});

app.get('/login.html', (req, res) => {
  res.render('login');
});

app.get('/assignTask', (req, res) => {
  const mngName = req.query.mngName;
  const mngId=req.query.mngId;
  const empId=req.query.empId;
  const empName=req.query.empName;
  const error=req.query.error;
  const success=req.query.success;
  res.render('assignTask', { mngName,mngId,empId,empName,error,success });
});

app.get('/addEmployee', (req, res) => {
  const mngName = req.query.mngName;
  const mngId=req.query.mngId;
  res.render('addEmployee', { mngName,mngId });
});

app.get('/manager', async (req, res) => {
  const mngId = empId; 

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const manager = await collection.findOne({ empId: empId });
    const managerName = manager.name;

    const taskCountsPipeline = [
      {
        $match: {
          mngId: mngId,
          'task.status': { $in: ['Closed', 'Assigned', 'In Progress', 'Completed'] }
        }
      },
      {
        $unwind: '$task'
      },
      {
        $group: {
          _id: '$task.status',
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id',
          count: { $sum: '$count' }
        }
      }
    ];    

    const taskCounts = await collection.aggregate(taskCountsPipeline).toArray();

    let closedTaskCount = 0;
    let notClosedTaskCount = 0;

    taskCounts.forEach(task => {
      if (task._id === 'Closed') {
        closedTaskCount += task.count;
      } else {
        notClosedTaskCount += task.count;
      }
    });

    res.render('manager', {
      mngName: managerName,
      mngId: empId,
      closedTaskCount: closedTaskCount,
      notClosedTaskCount: notClosedTaskCount,
      manager: manager
    }, (err, html) => {
      if (err) {
        console.error('Error rendering template:', err);
        res.status(500).send(err);
      } else {
        res.send(html);
      }
    });
  } catch (err) {
    res.status(500).send(err);
  } finally {
    await client.close();
  }
});

app.get('/empList', async (req, res) => {
  const mngId = req.query.mngId;
  const mngName = req.query.mngName;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');
    
    const employees = await collection.find({ mngId: mngId }).toArray();

    res.render('empList', { mngId, mngName, employees });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.get('/mngOpenTask', async (req, res) => {
  const mngId = req.query.mngId;
  const mngName = req.query.mngName;
  
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const employeeWithTasks = await collection.aggregate([
      {
        $match: {
          mngId: mngId
        }
      },
      {
        $unwind: "$task" 
      },
      {
        $match: {
          "task.status": { $ne: "Closed" }
        }
      },
      {
        $group: {
          _id: "$_id",
          empId: { $first: "$empId" },
          name: { $first: "$name" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          tasks: { $push: "$task" }
        }
      }
    ]).toArray();

    res.render('mngOpenTask', {
      mngName: mngName,
      mngId: mngId,
      employeesWithOpenTasks: employeeWithTasks
    }, (err, html) => {
      if (err) {
        console.error('Error rendering template:', err);
        res.status(500).send(err);
      } else {
        res.send(html);
      }
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.get('/mngClosedTask', async (req, res) => {
  const mngId = req.query.mngId;
  const mngName = req.query.mngName;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const employeeWithTasks = await collection.aggregate([
      {
        $match: {
          mngId: mngId
        }
      },
      {
        $unwind: "$task"
      },
      {
        $match: {
          "task.status": "Closed"
        }
      },
      {
        $group: {
          _id: "$_id",
          empId: { $first: "$empId" },
          name: { $first: "$name" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          tasks: { $push: "$task" }
        }
      }
    ]).toArray();
    res.render('mngClosedTask', { mngName: mngName, mngId: mngId, employeesWithClosedTasks: employeeWithTasks }, (err, html) => {
      if (err) {
        console.error('Error rendering template:', err);
        res.status(500).send(err);
      } else {
        res.send(html);
      }
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.get('/viewMore', async (req, res) => {
  const mngId = req.query.mngId;
  const mngName = req.query.mngName;
  const crNumber = req.query.crNumber;
  const empRemarks=req.query.empRemarks;
  const mangRemarks=req.query.mangRemarks;
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const employeeWithTask = await collection.aggregate([
      {
        $match: {
          mngId: mngId
        }
      },
      {
        $unwind: "$task"
      },
      {
        $match: {
          "task.crNumber": crNumber
        }
      },
      {
        $group: {
          _id: "$_id",
          empId: { $first: "$empId" },
          name: { $first: "$name" },
          role: { $first: "$role" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          password: { $first: "$password" },
          mngId: { $first: "$mngId" },
          task: { $push: "$task" }
        }
      }
    ]).toArray();


    if (employeeWithTask.length > 0) {
      res.render('viewMore', {
        mngName: mngName,
        mngId: mngId,
        crNumber: crNumber,
        empRemarks:empRemarks,
        mangRemarks:mangRemarks,
        employeeData: employeeWithTask[0] 
      });
    } else {
      res.send('No data found for the provided CR Number.');
    }
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.get('/mngReport',async(req,res)=>{
  const mngName=req.query.mngName;
  const mngId=req.query.mngId;
  const tasks=[];
  res.render('mngReport',{mngName,mngId,tasks});
});

app.get('/empData',async(req,res)=>{
  const mngName=req.query.mngName;
  const mngId=req.query.mngId;
  const employee=[];
  res.render('empData',{mngName,mngId,employee});
});

app.get('/employeeDetails', async (req, res) => {
  const empId = req.query.empId;
  const mngName = req.query.mngName;
  const mngId = req.query.mngId;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');
    const employee = await collection.findOne({ empId });

    if (employee) {
      res.render('empData', { mngId, empId, mngName, employee });
    } else {
      res.status(404).send('Employee not found.');
    }
  } catch (error) {
    console.error('Error fetching employee details:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/employee', async (req, res) => {
  const employeeId=empId;
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');
    const employee = await collection.findOne({ empId: employeeId });

    const empName = employee.name;
    const closedTaskCount = employee.task.filter(task => task.status === 'Closed').length;
    const notClosedTaskCount = employee.task.filter(task => task.status !== 'Closed').length;

    res.render('employee', {
      empName: empName,
      empId: empId,
      closedTaskCount: closedTaskCount,
      notClosedTaskCount: notClosedTaskCount,
      employee:employee
    }, (err, html) => {
      if (err) {
        console.error('Error rendering template:', err);
        res.status(500).send(err);
      } else {
        res.send(html);
      }
    });

  } catch (err) {
    res.status(500).send(err);
  } finally {
    await client.close();
  }
});

app.get('/empOpenTask', async (req, res) => {
  const empId = req.query.empId;
  const empName = req.query.empName;
  
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const tasks = await collection.aggregate([
      {
        $match: {
          empId: empId
        }
      },
      {
        $unwind: "$task"
      },
      {
        $match: {
          "task.status": { $ne: "Closed" }
        }
      },
      {
        $replaceRoot: { newRoot: "$task" }
      }
    ]).toArray();

    res.render('empOpenTask', { empName: empName, empId: empId, tasks: tasks }, (err, html) => {
      if (err) {
        console.error('Error rendering template:', err);
        res.status(500).send(err);
      } else {
        res.send(html);
      }
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.get('/empViewMore', async (req, res) => {
  const empId = req.query.empId;
  const empName = req.query.empName;
  const crNumber = req.query.crNumber;
  const empRemarks=req.query.empRemarks;
  const mangRemarks=req.query.mangRemarks;

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const employeeWithTask = await collection.aggregate([
      {
        $match: {
          empId: empId
        }
      },
      {
        $unwind: "$task"
      },
      {
        $match: {
          "task.crNumber": crNumber
        }
      },
      {
        $group: {
          _id: "$_id",
          empId: { $first: "$empId" },
          name: { $first: "$name" },
          role: { $first: "$role" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          password: { $first: "$password" },
          mngId: { $first: "$mngId" },
          task: { $push: "$task" }
        }
      }
    ]).toArray();


    if (employeeWithTask.length > 0) {
      res.render('empViewMore', {
        empName: empName,
        empId: empId,
        crNumber: crNumber,
        empRemarks:empRemarks,
        mangRemarks:mangRemarks,
        employeeData: employeeWithTask[0] 
      });
    } else {
      res.send('No data found for the provided CR Number.');
    }
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.get('/empClosedTask',async(req,res)=>{
  const empId = req.query.empId;
  const empName = req.query.empName;
  
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('employeeInfo');

    const tasks = await collection.aggregate([
      {
        $match: {
          empId: empId
        }
      },
      {
        $unwind: "$task"
      },
      {
        $match: {
          "task.status": "Closed"
        }
      },
      {
        $replaceRoot: { newRoot: "$task" }
      }
    ]).toArray();

    res.render('empClosedTask', { empName: empName, empId: empId, tasks: tasks }, (err, html) => {
      if (err) {
        console.error('Error rendering template:', err);
        res.status(500).send(err);
      } else {
        res.send(html);
      }
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.get('/empReport',async(req,res)=>{
  const empName=req.query.empName;
  const empId=req.query.empId;
  const tasks=[];
  res.render('empReport',{empName,empId,tasks});
});

app.get('/resetPass',(req,res)=>{
  const empId=req.query.empId;
  const empName=req.query.empName;
  const message=req.query.message;
  const error=req.query.error;
  res.render('resetPass',{empId,empName,message,error});
});

app.get('/mngReset',(req,res)=>{
  const mngId=req.query.mngId;
  const mngName=req.query.mngName;
  const message=req.query.message;
  const error=req.query.error;
  res.render('mngReset',{mngId,mngName,message,error});
});

/*------------------------------------------Server Start-------------------------------------*/

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});