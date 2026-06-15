const admin = require("./firebase");

const sendNotification = async (
  token,
  title,
  body,
  senderId,
  senderName
) => {

  const response = await admin.messaging().send({
    token,

    notification: {
      title,
      body
    },

    data: {
      senderId: String(senderId),
      senderName: String(senderName)
    }
  });

  console.log("FCM Response:", response);

  return response;
};

module.exports = sendNotification;