const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const nodemailer = require("nodemailer");
const router = express.Router();
const transporter = require("../config/mailer");


// Register
router.post("/register", async (req, res) => {
  const{ name, email, password, fcmToken } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hash,
    fcmToken
  });

  res.json({ status: true, message: "User registered" });
});


// Get all users except logged-in user
router.get("/all-users", authMiddleware, async (req, res) => {

  try {

    const users = await User.find({
      _id: { $ne: req.userId }
    }).select("-password");

    res.status(200).json({
      status: true,
      users
    });

  } catch (error) {

    res.status(500).json({
      status: false,
      message: error.message
    });
  }

});



// Login
router.post("/login", async (req, res) => {
  const { email, password, fcmToken  } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ status: false, message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ status: false, message: "Invalid password" });


  user.fcmToken = fcmToken;

  await user.save();

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  res.json({
    status: true,
    token,
    user
  });
});

// Save FCM Token
router.post("/save-fcm", async (req, res) => {
  const { userId, fcmToken } = req.body;

  await User.findByIdAndUpdate(userId, { fcmToken });

  res.json({ status: true, message: "FCM token saved" });
});

router.post("/send-otp", async (req, res) => {

  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.json({
      status: false,
      message: "User not found"
    });
  }

  const otp =
    Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    //console.log(105, 'OTP: '+otp)

  user.otp = otp;
  user.otpExpiry =
    Date.now() + 5 * 60 * 1000;

  await user.save();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset OTP",
    text: `Your OTP is ${otp}`
  });

  res.json({
    status: true,
    message: "OTP sent"
  });
});

router.post("/verify-otp", async (req, res) => {

  const { email, otp } = req.body;

  const user = await User.findOne({ email });

  if (
    !user ||
    user.otp !== otp ||
    user.otpExpiry < Date.now()
  ) {
    return res.json({
      status: false,
      message: "Invalid OTP"
    });
  }

  res.json({
    status: true,
    message: "OTP Verified"
  });
});

router.post("/reset-password", async (req, res) => {

  const { email, newPassword } = req.body;

  const hash =
    await bcrypt.hash(
      newPassword,
      10
    );

  await User.updateOne(
    { email },
    {
      password: hash,
      otp: null,
      otpExpiry: null
    }
  );

  res.json({
    status: true,
    message: "Password Updated"
  });
});

module.exports = router;
