const express = require("express");
const Message = require("../models/Message");
const User = require("../models/User");
const NotificationLog = require("../models/NotificationLog");

const auth = require("../middleware/authMiddleware");
const sendNotification = require("../config/sendNotification");

const router = express.Router();

//////////////////////////////////////////////////////
// SEND MESSAGE
//////////////////////////////////////////////////////

router.post("/send", auth, async (req, res) => {

  try {

    const { receiverId, text } = req.body;

    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    if (!receiverId || !text) {

      return res.status(400).json({
        status: false,
        message: "receiverId and text are required"
      });
    }

    //////////////////////////////////////////////////////
    // RECEIVER CHECK
    //////////////////////////////////////////////////////

    const receiver =
      await User.findById(receiverId);

    if (!receiver) {

      return res.status(404).json({
        status: false,
        message: "Receiver not found"
      });
    }

    //////////////////////////////////////////////////////
    // SAVE MESSAGE
    //////////////////////////////////////////////////////

    const message =
      await Message.create({

        sender: req.userId,

        receiver: receiverId,

        text
      });

    //////////////////////////////////////////////////////
    // MEETING MODE CHECK
    //////////////////////////////////////////////////////

    let allowNotification = true;

    if (
      receiver.meetingMode &&
      receiver.meetingMode.enabled
    ) {

      allowNotification =
        receiver.meetingMode.allowedContacts.some(
          id => id.toString() === req.userId
        );
    }

    //////////////////////////////////////////////////////
    // SEND NOTIFICATION
    //////////////////////////////////////////////////////

    if (
      allowNotification &&
      receiver.fcmToken
    ) {

      try {

        const sender = await User.findById(req.userId);

        if (!sender) {
          return res.status(404).json({
            status: false,
            message: "Sender not found"
          });
        }

        console.log("Receiver Token:", receiver.fcmToken);
        console.log("Sending notification...");
        const firebaseResponse =
          await sendNotification(
            receiver.fcmToken,
            "New Message",
            text,
            sender._id.toString(),
            sender.name
          );

        //////////////////////////////////////////////////////
        // LOG DELIVERED
        //////////////////////////////////////////////////////

        await NotificationLog.create({

          senderId: req.userId,

          receiverId,

          messageId: message._id,

          title: "New Message",

          body: text,

          fcmToken: receiver.fcmToken,

          status: "DELIVERED",

          blockReason: "NONE",

          firebaseResponse,

          deliveredAt: new Date()
        });

      } catch (notificationError) {

        //////////////////////////////////////////////////////
        // LOG FAILED
        //////////////////////////////////////////////////////

        await NotificationLog.create({

          senderId: req.userId,

          receiverId,

          messageId: message._id,

          title: "New Message",

          body: text,

          fcmToken: receiver.fcmToken,

          status: "FAILED",

          blockReason: "NONE",

          firebaseResponse:
            notificationError.message
        });

        console.log(notificationError);
      }

    } else {

      //////////////////////////////////////////////////////
      // LOG BLOCKED
      //////////////////////////////////////////////////////

      await NotificationLog.create({

        senderId: req.userId,

        receiverId,

        messageId: message._id,

        title: "New Message",

        body: text,

        fcmToken: receiver.fcmToken,

        status: "BLOCKED",

        blockReason: "MEETING_MODE"
      });

      console.log(
        "🔕 Notification blocked by Meeting Mode"
      );
    }

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    console.log("Notification sent");

    res.json({

      status: true,

      message: "Message sent successfully",

      data: message
    });

  } catch (e) {

    console.log(e);

    res.status(500).json({

      status: false,

      message: e.message
    });
  }
});


//////////////////////////////////////////////////////
// ENABLE MEETING MODE
//////////////////////////////////////////////////////

router.post(
  "/enable",
  auth,
  async (req, res) => {

    try {

      const { allowedContacts } = req.body;

      await User.findByIdAndUpdate(

        req.userId,

        {
          meetingMode: {

            enabled: true,

            allowedContacts:
              allowedContacts || []
          }
        }
      );

      res.json({

        status: true,

        message:
          "Meeting mode enabled"
      });

    } catch (e) {

      res.status(500).json({

        status: false,

        message: e.message
      });
    }
});

//////////////////////////////////////////////////////
// DISABLE MEETING MODE
//////////////////////////////////////////////////////

router.post(
  "/disable",
  auth,
  async (req, res) => {

    try {

      await User.findByIdAndUpdate(

        req.userId,

        {
          meetingMode: {

            enabled: false,

            allowedContacts: []
          }
        }
      );

      res.json({

        status: true,

        message:
          "Meeting mode disabled"
      });

    } catch (e) {

      res.status(500).json({

        status: false,

        message: e.message
      });
    }
});

//////////////////////////////////////////////////////
// GET MEETING MODE STATUS
//////////////////////////////////////////////////////

router.get(
  "/status",
  auth,
  async (req, res) => {

    try {

      const user =
        await User.findById(req.userId)
          .populate(
            "meetingMode.allowedContacts",
            "name email"
          );

      if (!user) {

        return res.status(404).json({

          status: false,

          message: "User not found"
        });
      }

      res.json({

        status: true,

        meetingMode:
          user.meetingMode
      });

    } catch (e) {

      res.status(500).json({

        status: false,

        message: e.message
      });
    }
});

//////////////////////////////////////////////////////
// Get Chat History API
//////////////////////////////////////////////////////

router.get(
  "/:receiverId",
  auth,
  async (req, res) => {

    try {

      const receiverId =
        req.params.receiverId;

      const messages =
        await Message.find({

          $or: [

            {
              sender: req.userId,
              receiver: receiverId
            },

            {
              sender: receiverId,
              receiver: req.userId
            }
          ]
        })

        .sort({
          createdAt: 1
        });

      res.json({

        status: true,

        messages
      });

    } catch (e) {

      res.status(500).json({

        status: false,

        message: e.message
      });
    }
});

module.exports = router;