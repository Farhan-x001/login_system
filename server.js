const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const User = mongoose.model('User', {
  firstName: String,
  lastName: String,
  phone: String,
  email: String,
  password: String,
  otp: String,
  isVerified: Boolean,
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Login Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
  });
  
  // Login Form Submission
  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // Check if the user exists and is verified
      const user = await User.findOne({ email, isVerified: true });
  
      if (user && user.password === password) {
        // Password is correct, you can redirect to the dashboard or send a success message
        res.redirect('/dashboard');
      } else {
        console.log('Login Failed:', { email });
        res.send('Invalid email or password');
      }
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

// Signup Page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

// Signup Form Submission
app.post('/signup', async (req, res) => {
  const { firstName, lastName, phone, email, password, confirmPassword } = req.body;

  // Validate password and confirm password
  if (password !== confirmPassword) {
    return res.send('Passwords do not match');
  }

  // Check if the email already exists in the database
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.send('User with this email already exists. Please log in.');
  }

  // Generate a random OTP
  const otp = crypto.randomBytes(3).toString('hex');

  // Save user, OTP, and set isVerified to false to the database
  await User.create({ firstName, lastName, phone, email, password, otp, isVerified: false });

  // Send OTP to the user's email
  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: 'Email Verification',
    text: `Your OTP is ${otp}.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully.');
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).send('Error sending email');
  }

  res.redirect('/verify');
});

// Email Verification Page
app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'verify.html'));
});

// Verify Email Form Submission
app.post('/verify', async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Check if the OTP matches and the email is not already verified
    const user = await User.findOne({ email, otp, isVerified: false });

    if (user) {
      // Set isVerified to true after successful verification
      user.isVerified = true;
      user.otp = ''; // Clear the OTP after verification
      await user.save();
      res.redirect('/dashboard');
    } else {
      console.log('Verification Failed:', { email, otp });
      res.send('Invalid OTP or email already verified');
    }
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Dashboard Page
app.get('/dashboard', (req, res) => {
  res.send('Welcome to the Dashboard!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
// New route to get all users
app.get('/get-all-users', async (req, res) => {
    try {
      // Retrieve all users from the database
      const users = await User.find();
  
      // Return the list of users in the response
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
// New route to get a specific user by email
app.get('/get-user/:email', async (req, res) => {
    const userEmail = req.params.email;
  
    try {
      // Retrieve the user from the database based on the email
      const user = await User.findOne({ email: userEmail });
  
      if (user) {
        // Return the user information in the response
        res.json(user);
      } else {
        // If the user is not found, return a 404 response
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  
// Forgot Password Page
app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'forgot-password.html'));
  });
  
  // Handle Forgot Password Form Submission
  app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
  
    // Generate a unique token and store it in the database
    const resetToken = crypto.randomBytes(20).toString('hex');
    await User.findOneAndUpdate({ email }, { resetToken });
  
    // Send a password reset email with a link containing the resetToken
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    // Send the email with the reset link
  
    res.send('Check your email for a password reset link.');
  });
  
  // Reset Password Page
  app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'reset-password.html'));
  });
  
  // Handle Reset Password Form Submission
  app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
  
    // Verify the token and update the user's password
    const user = await User.findOneAndUpdate({ resetToken: token }, { password: newPassword, resetToken: null });
  
    if (user) {
      res.send('Password reset successfully. You can now login with your new password.');
    } else {
      res.send('Invalid or expired token.');
    }
  });
  
 
    
