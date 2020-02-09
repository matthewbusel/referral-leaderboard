// --------------------------------------------------------------------------------------------------------------------------
// Require in packages and other files

require("dotenv").config();
const request = require("request");
const http = require("http");
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const qs = require("querystring");
const confirmationmsg = require("./confirmationmsg");
const viewBlocks = require("./viewBlocks");
const signature = require("./verifySignature");
const debug = require("debug")("slash-command-template:index");
const moment = require("moment");

const apiUrl = "https://slack.com/api";

const app = express();

// --------------------------------------------------------------------------------------------------------------------------
// AIRTABLE CONFIGURATION

const Airtable = require("airtable");

var base = new Airtable({ apiKey: process.env.API_KEY }).base(
  "app8hIGiBsuJuDN2q"
);

// --------------------------------------------------------------------------------------------------------------------------
/*
 * Parse application/x-www-form-urlencoded && application/json
 * Use body-parser's `verify` callback to export a parsed raw body
 * that you need to use to verify the signature
 */

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

app.use(bodyParser.urlencoded({ verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));

app.get("/", (req, res) => {
  let today = new Date();
  console.log(today.toLocaleString() + " Ping Received");
  res.send(
    "<h2>The Slash Command and Dialog app is running</h2> <p>Follow the" +
      " instructions in the README to configure the Slack App and your environment variables.</p>"
  );
});

// --------------------------------------------------------------------------------------------------------------------------
// OAUTH
// Uses OAuth2 standard to get a token upon

app.get("/auth", function(req, res) {
  if (!req.query.code) {
    // access denied
    console.log("Access denied");
    return;
  }
  var data = {
    form: {
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code: req.query.code
    }
  };
  request.post(apiUrl + "/oauth.v2.access", data, function(
    error,
    response,
    body
  ) {
    if (!error && response.statusCode == 200) {
      // Get an auth token (and store the team_id / token)
      // storage.setItemSync(JSON.parse(body).team_id, JSON.parse(body).access_token);

      let team_id = JSON.parse(body).team.id;
      let access_token = JSON.parse(body).access_token;

      // Search for existing team_id / access_token in db, update if team_id exists, create if team_id does not exist
      searchCreateToken(team_id, access_token);

      // create a team object to save in DB in order to use the webhook channel and url for zapier posts
      const team = {};
      team.team_id = JSON.parse(body).team.id;
      team.channel = JSON.parse(body).incoming_webhook.channel;
      team.url = JSON.parse(body).incoming_webhook.url;
      team.name = JSON.parse(body).team.name;
      team.authed_user = JSON.parse(body).authed_user.id;

      searchCreateTeam(team);

      // redirect to the download success webpage
      res.redirect(process.env.DOWNLOAD_PAGE_URL);

      // res.sendStatus(200);
      // Show a nicer web page or redirect to Slack, instead of just giving 200 in reality!
      //res.redirect(__dirname + "/public/success.html");
    }
  });
});

// Check to see if the authorizing team exists in the DB with a token, if so call updateToken, if not call createToken
const searchCreateToken = (team_id, access_token) => {
  const teamSearch = `team_id = "${team_id}"`;

  base("Tokens")
    .select({
      view: "Grid view",
      filterByFormula: teamSearch
    })
    .eachPage(
      function page(records) {
        if (records.length < 1) {
          createToken(team_id, access_token);
        } else {
          let recordId = records[0].id;
          updateToken(team_id, access_token, recordId);
        }
      },
      function done(err) {
        if (err) {
          console.error(err);
          return;
        }
      }
    );
};

// Create a record in the Token db with a team_id and access_token
const createToken = (team_id, access_token) => {
  base("Tokens").create(
    [
      {
        fields: {
          team_id: team_id,
          access_token: access_token
        }
      }
    ],
    function(err, records) {
      if (err) {
        console.error(err);
        return;
      }
      records.forEach(function(record) {
        console.log("Newly created token for: ", record.get("team_id"));
      });
    }
  );
};

// Use the recordId to update the correct record (based on team_id) with a new token
const updateToken = (team_id, access_token, recordId) => {
  base("Tokens").update(
    [
      {
        id: recordId,
        fields: {
          team_id: team_id,
          access_token: access_token
        }
      }
    ],
    function(err, records) {
      if (err) {
        console.error(err);
        return;
      }
      records.forEach(function(record) {
        console.log("Updated token for: ", record.get("team_id"));
      });
    }
  );
};

// Find the access token based on the team_id. Resolve with the token, and the original req, res from the slash command post request
const getToken = (team_id, webhookChannel, req, res) => {
  return new Promise((resolve, reject) => {
    const teamSearch = `team_id = "${team_id}"`;

    base("Tokens")
      .select({
        view: "Grid view",
        filterByFormula: teamSearch
      })
      .eachPage(
        function page(records) {
          let access_token = records[0].fields.access_token;
          resolve({
            access_token: access_token,
            webhookChannel: webhookChannel,
            req: req,
            res: res
          });
        },
        function done(err) {
          if (err) {
            reject(err);
          }
        }
      );
  });
};

// Get the webhook channel that was chosen at installation based on team_id. Resolve with the webhook channel and teamId. Used in app_home.
const getWebhookChannel = (team_id) => {
  return new Promise((resolve, reject) => {
    const teamSearch = `teamId = "${team_id}"`;

    base("Teams")
      .select({
        view: "Grid view",
        filterByFormula: teamSearch
      })
      .eachPage(
        function page(records) {
          console.log(records)
          let webhookChannel = records[0].fields.webhook_channel;
          resolve({
            webhookChannel: webhookChannel,
            team_id: team_id
          });
        },
        function done(err) {
          if (err) {
            reject(err);
          }
        }
      );
  });
};

// Check to see if the authorizing team exists in the Teams table, if so call updateTeam, if not call createTeam
const searchCreateTeam = team => {
  const teamSearch = `TeamId = "${team.team_id}"`;

  base("Teams")
    .select({
      view: "Grid view",
      filterByFormula: teamSearch
    })
    .eachPage(
      function page(records) {
        if (records.length < 1) {
          createTeam(team);
        } else {
          let recordId = records[0].id;
          updateTeam(team, recordId);
        }
      },
      function done(err) {
        if (err) {
          console.error(err);
          return;
        }
      }
    );
};

// Create the team in the Teams table and save the webhook channel and webhook url
const createTeam = team => {
  let endDate = moment()
    .add(90, "days")
    .calendar();
  base("Teams").create(
    [
      {
        fields: {
          TeamName: team.name,
          TeamId: team.team_id,
          webhook_channel: team.channel,
          webhook_url: team.url,
          authed_user: team.authed_user,
          game_end: endDate
        }
      }
    ],
    function(err, records) {
      if (err) {
        console.error(err);
        return;
      }
      records.forEach(function(record) {
        console.log("Created Team RecordId: ", record.getId());
      });
    }
  );
};

// Use the recordId to update the correct record (based on team_id) with a new token
const updateTeam = (team, recordId) => {
  base("Teams").update(
    [
      {
        id: recordId,
        fields: {
          webhook_channel: team.channel,
          webhook_url: team.url,
          authed_user: team.authed_user
        }
      }
    ],
    function(err, records) {
      if (err) {
        console.error(err);
        return;
      }
      records.forEach(function(record) {
        console.log("Updated webhooks for team: ", record.get("TeamId"));
      });
    }
  );
};

// --------------------------------------------------------------------------------------------------------------------------
// Endpoint to receive /referral slash command from Slack
// Checks verification token and opens a dialog to capture more info

app.post("/command", (req, res) => {
  console.log(req.body);

  // extract the slash command text, and trigger ID from payload
  const { text, trigger_id, user_name, team_id, user_id } = req.body;

  // Verify the signing secret
  if (signature.isVerified(req)) {
    // create the dialog payload - includes the dialog structure, Slack API token,
    // and trigger ID

    // retrieve the access token of the team who sent the /command post request to use to open a modal in their workspace
    getToken(team_id, req, res).then(record => openView(record));

    const openView = record => {
      let access_token = record.access_token;

      const view = {
        // token: process.env.SLACK_ACCESS_TOKEN,
        token: access_token,
        trigger_id,
        view: JSON.stringify({
          type: "modal",
          title: {
            type: "plain_text",
            text: "Submit a referral!"
          },
          callback_id: "submit-referral",
          submit: {
            type: "plain_text",
            text: "Submit"
          },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  ":wave: Hey <@" +
                  user_id +
                  ">, \n\nEarn *1 point* on the leaderboard for every referral you submit!"
              }
            },
            {
              type: "divider"
            },
            {
              block_id: "name_block",
              type: "input",
              label: {
                type: "plain_text",
                text: "Name"
              },
              element: {
                action_id: "name",
                type: "plain_text_input"
              },
              hint: {
                type: "plain_text",
                text: "Who should we speak with?"
              }
            },
            {
              block_id: "position_block",
              type: "input",
              label: {
                type: "plain_text",
                text: "Position"
              },
              element: {
                action_id: "position",
                type: "plain_text_input"
              },
              hint: {
                type: "plain_text",
                text: "What role would might they have?"
              }
            },
            {
              block_id: "email_block",
              type: "input",
              label: {
                type: "plain_text",
                text: "Email"
              },
              element: {
                action_id: "email",
                type: "plain_text_input"
              },
              hint: {
                type: "plain_text",
                text: "How can we contact them?"
              }
            },
            {
              block_id: "linkedin_block",
              type: "input",
              label: {
                type: "plain_text",
                text: "LinkedIn"
              },
              element: {
                action_id: "linkedin",
                type: "plain_text_input"
              },
              hint: {
                type: "plain_text",
                text: "Could you share their LinkedIn profile?"
              }
              // optional: true
            }
          ]
        })
      };

      // open the modal by calling views.open method and sending the payload
      axios
        .post(`${apiUrl}/views.open`, qs.stringify(view))
        .then(result => {
          debug("views.open: %o", result.data);
          res.send("");
        })
        .catch(err => {
          debug("views.open call failed: %o", err);
          res.sendStatus(500);
        });
    };
  } else {
    debug("Verification token mismatch");
    res.sendStatus(404);
  }
});

// --------------------------------------------------------------------------------------------------------------------------
// Endpoint to receive the dialog submission.
// Checks the verification token and creates a referral
// Also the endpoint to receive button clicks such as the buttons in the app_home

app.post("/interactive", (req, res) => {
  // parse the incoming body payload from the submission of the referral modal
  const body = JSON.parse(req.body.payload);
  const team_id = body.team.id;
  const user_id = body.user.id;
  const { type, trigger_id } = body;

  switch (body.type) {
    // if the user is submitting a referral ->
    case "view_submission": {
      // check that the verification token matches expected value
      if (signature.isVerified(req)) {
        debug(`Form submission received: ${body.view}`);

        // immediately respond with a empty 200 response to let
        // Slack know the command was received
        res.send("");

        // create an employee object and set the userId property
        // to the Slack userId of the employee who submited the referral
        const employee = {};
        employee.userId = body.user.id;
        employee.name = body.user.name;
        employee.teamId = body.user.team_id;
        employee.username = body.user.username;

        // create a referral object and set the field names for each column based on the submitted modal
        const referral = {};
        let values = body.view.state.values;
        referral.name = values.name_block.name.value;
        referral.email = values.email_block.email.value;
        referral.position = values.position_block.position.value;
        referral.linkedin = values.linkedin_block.linkedin.value;
        referral.employee = body.user.name;
        referral.teamId = body.user.team_id;

        // postInitMessage(referral);
        getToken(team_id, req, res).then(record =>
          postInitMessage(record, referral)
        );

        // look for the employee in the db, if it does not exist, create the employee, then (either way) create the referral record
        searchEmployee(employee)
          .then(record => pickRecord(record.employee))
          .then(record => createReferral(record, referral));

        // send confirmation direct message to employee who submitted the referral
        getToken(team_id, req, res).then(record =>
          confirmationmsg.triggerSend(body.view, body.user, record)
        );
      } else {
        debug("Token mismatch");
        res.sendStatus(404);
      }
      break;
    } // if the user is taking a block action such as clicking a button ->
    case "block_actions": {
      // this is the submit referral button at the bottom of the app_home
      if (body.actions[0].value === "submit_referral_button") {
        // retrieve the access token of the team who sent the /command post request to use to open a modal in their workspace
        getToken(team_id).then(record => openView(record));

        const openView = record => {
          let access_token = record.access_token;

          const view = {
            // token: process.env.SLACK_ACCESS_TOKEN,
            token: access_token,
            trigger_id,
            view: JSON.stringify({
              type: "modal",
              title: {
                type: "plain_text",
                text: "Submit a referral!"
              },
              callback_id: "submit-referral",
              submit: {
                type: "plain_text",
                text: "Submit"
              },
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      ":wave: Hey <@" +
                      user_id +
                      ">, \n\nEarn *1 point* on the leaderboard for every referral you submit!"
                  }
                },
                {
                  type: "divider"
                },
                {
                  block_id: "name_block",
                  type: "input",
                  label: {
                    type: "plain_text",
                    text: "Name"
                  },
                  element: {
                    action_id: "name",
                    type: "plain_text_input"
                  },
                  hint: {
                    type: "plain_text",
                    text: "Who should we speak with?"
                  }
                },
                {
                  block_id: "position_block",
                  type: "input",
                  label: {
                    type: "plain_text",
                    text: "Position"
                  },
                  element: {
                    action_id: "position",
                    type: "plain_text_input"
                  },
                  hint: {
                    type: "plain_text",
                    text: "What role would might they have?"
                  }
                },
                {
                  block_id: "email_block",
                  type: "input",
                  label: {
                    type: "plain_text",
                    text: "Email"
                  },
                  element: {
                    action_id: "email",
                    type: "plain_text_input"
                  },
                  hint: {
                    type: "plain_text",
                    text: "How can we contact them?"
                  }
                },
                {
                  block_id: "linkedin_block",
                  type: "input",
                  label: {
                    type: "plain_text",
                    text: "LinkedIn"
                  },
                  element: {
                    action_id: "linkedin",
                    type: "plain_text_input"
                  },
                  hint: {
                    type: "plain_text",
                    text: "Could you share their LinkedIn profile?"
                  }
                  // optional: true
                }
              ]
            })
          };

          // open the modal by calling views.open method and sending the payload
          axios
            .post(`${apiUrl}/views.open`, qs.stringify(view))
            .then(result => {
              debug("views.open: %o", result.data);
              res.send("");
            })
            .catch(err => {
              debug("views.open call failed: %o", err);
              res.sendStatus(500);
            });
        };
      }
      // faq button is clicked (currently in the app_home) -> opens faq modal
      if (body.actions[0].value === "faq_button") {
        // retrieve the access token of the team who sent the /command post request to use to open a modal in their workspace
        getToken(team_id).then(record => openView(record));

        const openView = record => {
          let access_token = record.access_token;

          const view = {
            // token: process.env.SLACK_ACCESS_TOKEN,
            token: access_token,
            trigger_id,
            view: JSON.stringify(viewBlocks.faqModal)
          };

          // open the modal by calling views.open method and sending the payload
          axios
            .post(`${apiUrl}/views.open`, qs.stringify(view))
            .then(result => {
              debug("views.open: %o", result.data);
              res.send("");
            })
            .catch(err => {
              debug("views.open call failed: %o", err);
              res.sendStatus(500);
            });
        };
      }
      break;
    }
  }
});

// --------------------------------------------------------------------------------------------------------------------------
// AIRTABLE FUNCTIONS
// Picks the record that has a UserId that matches the Slack UserId of the person who submitted the referral
const pickRecord = employee => {
  return new Promise((resolve, reject) => {
    const userSearch = `UserId = "${employee.userId}"`;

    base("Employees")
      .select({
        view: "Grid view",
        filterByFormula: userSearch
      })
      .eachPage(
        function page(records) {
          const record = records[0];

          resolve({
            id: record.id
          });
        },
        function done(err) {
          if (err) {
            reject(err);
          }
        }
      );
  });
};

// Create a referral record in the Referrals table
function createReferral(record, referral) {
  base("Referrals").create(
    [
      {
        fields: {
          Name: referral.name,
          Email: referral.email,
          Position: referral.position,
          LinkedIn: referral.linkedin,
          Employee: [record.id],
          TeamId: referral.teamId
        }
      }
    ],
    function(err, records) {
      if (err) {
        console.error(err);
        return;
      }
      records.forEach(function(record) {
        console.log("Created Referral RecordId: ", record.getId());
      });
    }
  );
}

// Check to see if the employee who submitted the referral exists in the DB, if not create them
const searchEmployee = employee => {
  return new Promise((resolve, reject) => {
    const userSearch = `UserId = "${employee.userId}"`;

    base("Employees")
      .select({
        view: "Grid view",
        filterByFormula: userSearch
      })
      .eachPage(
        function page(records) {
          // if there's an employee in the database that matches the employee who submitted the referral
          // then resolve the promise by just passinig the original employee object and move forward to the next function
          if (records.length > 0) {
            resolve({
              employee: employee
            });
            // if there's not an employee in the database that matches the employee who submitted the referral
            // then create a new employee in the database, wait one second, and then resolve with the original employee object
          } else {
            console.log("Employee does not yet exist -> creating one");
            createEmployee(employee);
            setTimeout(() => {
              resolve({
                employee: employee
              });
            }, 1000);
          }
        },
        function done(err) {
          if (err) {
            reject(err);
          }
        }
      );
  });
};

// Create an employee record in the Employees table
const createEmployee = employee => {
  base("Employees").create(
    [
      {
        fields: {
          UserId: employee.userId,
          Name: employee.name,
          Username: employee.username,
          TeamId: employee.teamId
        }
      }
    ],
    function(err, records) {
      if (err) {
        console.error(err);
        return;
      }
      records.forEach(function(record) {
        console.log("Created Employee RecordId: ", record.getId());
      });
    }
  );
};

// --------------------------------------------------------------------------------------------------------------------------

// Listens for Zapier's Scheduler (which runs every Wednesday at 10 am ET)
// which triggers a POST to this webhook
// in the *Data* section, I created a `token` with a value equal to teamId
// so I can verify it's me making the request and pass that teamId
// to listEmployees in order to only pick records of employees from that team
// once the correct employee records are picked, it adds them to an array to be stringified
// and posts to the Referral Leaderboard channel in Slack
app.post("/zapier/ping", (req, res) => {
  const { token } = req.body;
  // check that the token matches expected value
  if (token === process.env.ZAPIER_TOKEN) {
    console.log("Zapier Webhook - Post Request");
    res.sendStatus(200);

    // list all teams in the Teams table with their teamId and their webhookUrl
    listTeams().then(teamList => {
      // define the array of teams from the object of teams that resolved from the promise in listTeams()
      let teamArray = teamList.teamList;

      // for each team in the team array, pass the team's object (with teamId and webhookURL) to listEmployees()
      // in order to list all their employees with referrals -> resolve with both that list and the webhookUrl in order to post the message
      teamArray.forEach(team => {
        listEmployees(team)
          .then(employeeList => {
            post(employeeList);
          })
          .catch(err => console.log(err));
      });
    });
  } else {
    res.sendStatus(500);
  }
});

// AIRTABLE
// lists all teams in the Teams table
// and pushes each teamId to an array called TeamList
const listTeams = () => {
  return new Promise((resolve, reject) => {
    // create an empty array to push employee leaderboard objects to
    const teamList = [];

    base("Teams")
      .select({
        // Selecting all records in Grid view:
        view: "Grid view"
      })
      .eachPage(
        function page(records, fetchNextPage) {
          // This function (`page`) will get called for each page of records.

          records.forEach(function(record) {
            let teamIdRetrieved = record.get("TeamId");
            let webhookUrl = record.get("webhook_url");

            // employeeList not has an object for each employee that has submitted a referral
            teamList.push({ [teamIdRetrieved]: webhookUrl });
          });

          resolve({
            teamList: teamList
          });

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            return;
          }
        }
      );
  });
};

// AIRTABLE
// filters Airtable for employees with matching teamId, sorts by referralCount
// and pushes each employee + their referralCount to an array called employeeList
const listEmployees = teamObject => {
  // the argument is an object where the key is the teamId and the value is the webhook Url
  // object.keys returns an array of keys, so need to grab the 0th key in order to get the only key in the object
  let teamId = Object.keys(teamObject)[0];
  let webhookUrl = Object.values(teamObject)[0];

  return new Promise((resolve, reject) => {
    // create an empty array to push employee leaderboard objects to
    const employeeList = [];
    // filter for employees in the same Slack team as the employee who submitted the referral

    const employeeSearch = `TeamId = "${teamId}"`;

    base("Employees")
      .select({
        // Selecting the first 3 records in Grid view:
        view: "Grid view",
        filterByFormula: employeeSearch,
        sort: [{ field: "ReferralCount", direction: "desc" }]
      })
      .eachPage(
        function page(records, fetchNextPage) {
          // This function (`page`) will get called for each page of records.

          records.forEach(function(record) {
            let employeeRetrieved = record.get("Name");
            let employeeReferralCount = record.get("ReferralCount");
            // employeeList not has an object for each employee that has submitted a referral
            employeeList.push({ [employeeRetrieved]: employeeReferralCount });
          });

          resolve({
            employeeList: employeeList,
            webhookUrl: webhookUrl
          });

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            return;
          }
        }
      );
  });
};

// SLACK
// posts the question to Slack
const post = employeeList => {
  let employeeArray = employeeList.employeeList;
  let webhookUrl = employeeList.webhookUrl;

  // define an empty array to push a block section to for each employee on the leaderboard
  let blockArray = [];

  // for every employee that submitted a referral, add a block to the block array with their name and referralcount
  employeeArray.forEach(function(obj, index) {
    // separating the top employee in case in the future we want to call out the leader in some way
    if (index == 0) {
      for (var key in obj) {
        // dynamic number of spaces after each name dependent upon the length of the name in order to align horizontally
        // let numSpaces = 46 - key.length * 2;
        // let spaces = " ".repeat(numSpaces);
        let spaces = " ".repeat(3);

        blockArray.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🥇       ${key}${spaces}-  *${obj[key]}*`
          }
        });
      }
    } else if (index == 1) {
      for (var key in obj) {
        let spaces = " ".repeat(3);

        blockArray.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🥈       ${key}${spaces}-  *${obj[key]}*`
          }
        });
      }
    } else if (index == 2) {
      for (var key in obj) {
        let spaces = " ".repeat(3);

        blockArray.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🥉       ${key}${spaces}-  *${obj[key]}*`
          }
        });
      }
    } else {
      for (var key in obj) {
        let spaces = " ".repeat(3);

        blockArray.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `\`${index + 1}\`         ${key}${spaces}-  *${obj[key]}*`
          }
        });
      }
    }
  });

  let date = moment().format("MMMM Do YYYY");

  // add a heading to the leaderboard post with the date
  blockArray.unshift(
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🏆 Leaderboard Results*"
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*${date} - the results are in!*`
        }
      ]
    },
    {
      type: "divider"
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Rank*      *Name*               *Referrals*`
        }
      ]
    }
  );

  blockArray.push(
    {
      type: "divider"
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Questions? Contact <support@slackleaderboard.app>"
        }
      ]
    }
  );

  const json = {
    username: "referralleaderboard",
    parse: "none",
    blocks: JSON.stringify(blockArray)
  };
  return new Promise((resolve, reject) => {
    request.post(
      {
        // url: process.env.SLACK_HOOK_URL,
        url: webhookUrl,
        json: json
      },
      (err, res) => {
        if (err) reject(err);
        if (res.statusCode !== 200)
          reject(`Got HTTP status ${res.statusCode} from Slack`);
        resolve("Posted to Slack.");
      }
    );
  });
};

// --------------------------------------------------------------------------------------------------------------------------
// Post message via chat.postMessage
const postInitMessage = (record, referral) => {
  let access_token = record.access_token;

  let messageData = {
    channel: "#referral-engine",
    text:
      ":wave: Hello! I'm here to help your team make approved announcements into a channel.",
    blocks: [
      {
        type: "divider"
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `This referral was submitted on ${moment().format(
              "MMM Do YYYY"
            )}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `💥 *You have a new referral submission!* \n\n*Referrer:*  <${process.env.LANDING_PAGE_URL}|${referral.employee}>`
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
            text: `\n>*Name* \n>${referral.name}`
          },
          {
            type: "mrkdwn",
            text: `\n>*Position* \n>${referral.position}`
          }
        ]
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `\n>*Email* \n><mailto:${referral.email}|${referral.email}>`
          },
          {
            type: "mrkdwn",
            text: `\n>*LinkedIn* \n>${referral.linkedin}`
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Questions? Contact <support@slackleaderboard.app>"
          }
        ]
      },
      {
        type: "divider"
      }
    ]
  };
  send(messageData, access_token, false);
};

const send = async (data, access_token, as_user) => {
  if (as_user) data.as_user = as_user; // send DM as a bot, not Slackbot
  const result = await axios.post(`${apiUrl}/chat.postMessage`, data, {
    headers: {
      Authorization: "Bearer " + access_token
    }
  });
  try {
    if (result.data.error)
      console.log(`PostMessage Error: ${result.data.error}`);
  } catch (err) {
    console.log(err);
  }
};

// --------------------------------------------------------------------------------------------------------------------------
/*
 * Endpoint to receive events from Slack's Events API.
 */

app.post("/events", (req, res) => {
  switch (req.body.type) {
    case "url_verification": {
      // verify Events API endpoint by returning challenge if present
      res.send({ challenge: req.body.challenge });
      break;
    }
    case "event_callback": {
      // Verify the signing secret
      if (!signature.isVerified(req)) {
        res.sendStatus(404);
        return;
      } else {
        const token = req.body.token;
        const team_id = req.body.team_id;
        const { type, user, channel } = req.body.event;

        // if a user selects the app home, open the app home view

        if (type === "app_home_opened") {
          getWebhookChannel(team_id).then(record => getToken(record.team_id, record.webhookChannel).then(record => openView(record)));
          // below replaced by above in order to include the webhook channel in the app_home
          // getToken(team_id).then(record => openView(record));

          const openView = record => {
            let access_token = record.access_token;
            let webhookChannel = record.webhookChannel;

            const view = {
              // token: process.env.SLACK_ACCESS_TOKEN,
              token: access_token,
              user_id: user,
              view: JSON.stringify({
                type: "home",
                blocks: [
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: " *Leaderboard*"
                    }
                  },
                  {
                    type: "divider"
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text:
                        "Leaderboard is a friendly competition where you can win prizes and help your team hire 😎"
                    }
                  },
                  {
                    type: "context",
                    elements: [
                      {
                        type: "image",
                        image_url:
                          "https://api.slack.com/img/blocks/bkb_template_images/placeholder.png",
                        alt_text: "placeholder"
                      }
                    ]
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: "*🚀 Setting Up Leaderboard*"
                    }
                  },
                  {
                    type: "context",
                    elements: [
                      {
                        type: "mrkdwn",
                        text: "How to get started"
                      }
                    ]
                  },
                  {
                    type: "divider"
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text:
                        `\n>Create a channel called \`#referral-engine\`\n\n> Add Leaderboard -> go to that channel and use \`/invite @leaderboard\` \n\n> Congrats! Leaderboard will now post new referrals in \`#referral-engine\` and weekly standings in \`${webhookChannel}\``
                    }
                  },
                  {
                    type: "context",
                    elements: [
                      {
                        type: "image",
                        image_url:
                          "https://api.slack.com/img/blocks/bkb_template_images/placeholder.png",
                        alt_text: "placeholder"
                      }
                    ]
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: "*🏆 Playing Leaderboard*"
                    }
                  },
                  {
                    type: "context",
                    elements: [
                      {
                        type: "mrkdwn",
                        text:
                          "How to earn points, win prizes, and help your team"
                      }
                    ]
                  },
                  {
                    type: "divider"
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text:
                        "\n>Use `/referral` to submit a referral to your hiring manager\n\n>Earn 1 point for every referral you submit\n\n>If you have the most points at the end of the period you win a prize!"
                    }
                  },
                  {
                    type: "context",
                    elements: [
                      {
                        type: "image",
                        image_url:
                          "https://api.slack.com/img/blocks/bkb_template_images/placeholder.png",
                        alt_text: "placeholder"
                      }
                    ]
                  },
                  {
                    type: "actions",
                    elements: [
                      {
                        type: "button",
                        text: {
                          type: "plain_text",
                          text: "💥 Submit Referral",
                          emoji: true
                        },
                        style: "primary",
                        value: "submit_referral_button"
                      },
                      {
                        type: "button",
                        text: {
                          type: "plain_text",
                          text: "❓ FAQ",
                          emoji: true
                        },
                        value: "faq_button"
                      }
                    ]
                  },
                  {
                    type: "context",
                    elements: [
                      {
                        type: "mrkdwn",
                        text:
                          "For support or questions, contact <support@slackleaderboard.app>"
                      }
                    ]
                  }
                ]
              })
            };

            // open the modal by calling views.open method and sending the payload
            axios
              .post(`${apiUrl}/views.publish`, qs.stringify(view))
              .then(result => {
                debug("views.publish: %o", result.data);
                res.send("");
              })
              .catch(err => {
                debug("views.publish call failed: %o", err);
                res.sendStatus(500);
              });
          };
        }
      }
      break;
    }
    default: {
      res.sendStatus(404);
    }
  }
});

// --------------------------------------------------------------------------------------------------------------------------
// Start server
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(
    "Express server listening on port %d in %s mode",
    server.address().port,
    app.settings.env
  );
});

// Ping server to keep it alive
setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 280000);

module.exports = { getToken };
