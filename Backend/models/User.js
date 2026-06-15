const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  fcmToken: String,
  otp: String,
  otpExpiry: Date,

  meetingMode: {
    enabled: { type: Boolean, default: false },
    allowedContacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  }
});

module.exports = mongoose.model("User", userSchema);
