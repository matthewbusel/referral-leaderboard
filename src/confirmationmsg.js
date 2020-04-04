const axios = require("axios");
const debug = require("debug")("slash-command-template:ticket");
const qs = require("querystring");
const users = require("./users");

/*
 *  Send ticket creation confirmation via
 *  chat.postMessage to the user who created it
 */
const sendConfirmation = (referral, access_token) => {
  axios
    .post(
      "https://slack.com/api/chat.postMessage",
      qs.stringify({
        // token: process.env.SLACK_ACCESS_TOKEN,
        token: access_token,
        channel: referral.userId,
        as_user: true,
        text: "Referral submitted!",
        blocks: JSON.stringify([
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Your referral was submitted successfully"
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🚀 *Great job!* You just earned a point on the referralboard.`
            }
          },
          {
            type: "divider"
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `\n*Name* \n${referral.name}`
              },
              {
                type: "mrkdwn",
                text: `\n*Position* \n${referral.position}`
              }
            ]
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `\n*Email* \n<mailto:${referral.email}|${referral.email}>`
              },
              {
                type: "mrkdwn",
                text: `\n*LinkedIn* \n${referral.linkedin}`
              }
            ]
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text:
                  "Questions? Contact your hiring manager or <support@slackleaderboard.app>"
              }
            ]
          }
        ])
      })
    )
    .then(result => {
      debug("sendConfirmation: %o", result.data);
    })
    .catch(err => {
      debug("sendConfirmation error: %o", err);
      console.error(err);
    });
};

// Create a referral object (helpdesk ticket)
const triggerSend = (view, user, record) => {
  let values = view.state.values;
  let userId = user.id;
  let access_token = record.access_token;

  // recreate a referral object to send to the sendConfirmation function
  const referral = {};

  referral.userId = user.id;
  referral.name = values.name_block.name.value;
  referral.email = values.email_block.email.value;
  referral.position = values.position_block.position.value;
  referral.linkedin = values.linkedin_block.linkedin.value;

  // sends a confirmation message to the user who submitted the referral
  sendConfirmation(referral, access_token);

  return referral;
};

module.exports = { triggerSend, sendConfirmation };
