// NOT USING THIS APPHOMEVIEW - currently the appHomeView block is in index.js in order to get a dynamic "leaderboard channel"
const appHomeView = {
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
                        "\n>Create a channel called `#referral-engine`\n\n> Add Leaderboard -> go to that channel and use `/invite @leaderboard` \n\n> Congrats! Leaderboard will now post new referrals in `#referral-engine` and weekly standings in the channel selected during installation"
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
              }

const faqModal = {
              type: "modal",
              title: {
                type: "plain_text",
                text: "FAQ",
                emoji: true
              },
              close: {
                type: "plain_text",
                text: "Cancel",
                emoji: true
              },
              blocks: [
                {
                  type: "divider"
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      "*Do we have to name the channel #referral-engine*\nFor now yes, all submitted referrals will only be posted in a channel named #referral-engine."
                  }
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      "*How long does the competition last?*\nThe length of the game is determined by your hiring manger when he or she signed up, but we default to 90 days.\n\nIf you'd like to change the game end date, please shoot an email to support@slackleaderboard.app."
                  }
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      "*What is the prize for winning Leaderboard?*\nThe prize for each leaderboard is determined by your company. If you're unsure what to make your prize then please reach out - we have recommendations!"
                  }
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      "*How often does Leaderboard post in Slack?*\nWe only post the results of Leaderboard once per week so your team can stay focused."
                  }
                },
                {
                  type: "divider"
                }
                // commented out until I can figure out how to open a modal within a modal + open a new tab
                // {
                //   type: "actions",
                //   elements: [
                //     {
                //       type: "button",
                //       text: {
                //         type: "plain_text",
                //         text: "Send feedback",
                //         emoji: true
                //       },
                //       value: "send_feedback_button"
                //     },
                //     {
                //       type: "button",
                //       text: {
                //         type: "plain_text",
                //         text: "Visit website",
                //         emoji: true
                //       },
                //       value: "visit_website_button"
                //     }
                //   ]
                // }
              ]
            }

const channelCreatedMessage = {
    channel: "referral-engine",
    text:
      ":wave: H! I'm Leaderboard. I'm here to help your team increase employee referrals.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Welcome to Leaderboard - the friendly competition that helps companies increase employee referrals!"
        }
      }
    ]
  };

module.exports = { appHomeView, faqModal, channelCreatedMessage };