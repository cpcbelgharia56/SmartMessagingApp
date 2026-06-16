const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
dotenv.config();
const transporter = nodemailer.createTransport({
  service: "74.125.142.108",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

module.exports = transporter;