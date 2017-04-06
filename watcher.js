var config = require('./config.js');
var Twit = require('./twit');
var Queue = require('./queue');
var twitConfig = Object.entries(config)
  .filter(([key]) => ['consumer_key', 'consumer_secret', 'access_token', 'access_token_secret'].includes(key))
  .reduce((config, [key, val]) => Object.assign(config, { [key]: val }), {});
var T = new Twit(twitConfig);
var GoogleSheet = require('./googlesheet');
// create a new googlesheet object
var gs = new GoogleSheet(config.spreadsheet_key);

var bot_name = config.bot_name;
var redis_addr = config.redis_port || config.redis_url;
var redis = require('redis')
var client = redis_addr ? redis.createClient(redis_addr) : null;
var queue = new Queue(bot_name, client);

Array.prototype.pick = function() {
  return this[Math.floor(Math.random()*this.length)];
};

function onTweet(eventMsg) {
  var promises = [gs.getUsers(), gs.getKeywords(), gs.getReplies()];
  Promise.all(promises).then(([users, keywords, replies]) => {
    // store text of tweet
    var text = eventMsg.text.toLowerCase();
    // store screen name of tweeter
    var user = eventMsg.user.screen_name.toLowerCase();
    // check to see if the user is in our list of accepted users
    var isAuthorized = users.has(user);
    console.log('User: ', user);
    console.log('Is authorized: ', isAuthorized);
    // if tweet is a retweet
    if (eventMsg.retweeted_status) {
      // overwrite the text with junk to ignore it
      text = '***';
    }
    // if the user is authorized to use the bot
    if (isAuthorized) {
      var postText = "";
      // parse out just the bit of the tweet after the word "about"
      if (text.match(/\sabout\s(.*)$/)) {
        postText = text.match(/\sabout\s(.*)$/)[1];
      }
      // check to see if a valid keyword is in the text of the string, normalized for case
      // undefined if not found.
      var wordFound = postText.split(/\W/).find(word => {
        return word.match(/\w/) && keywords.has(word)
      });
      console.log('Word found: ', wordFound);

      // if we did find a word
      if (wordFound !== undefined) {
        // extract every user from the tweet as an array of usernames (minus our own username)
        // match all usernames but remove the bot name itself (case insensitive)
        // so that we have a list of people we're tagging in the message
        var mentions = text.match(/@\w*/g).filter(names => names != bot_name.toLowerCase())
        // get the tweet ID we're replying to so we can preserve the thread
        var tweetId = eventMsg.id_str;
        // look up the URL for the corresponding keyword
        var url = keywords.get(wordFound);
        // build our tweet:
        // the user we're replying to + list of mentions +
        // one of our replies with the link inserted instead of "LINK"
        var tweet = '@' + user + ' ' + mentions.join(' ') + ' ' + replies.pick().replace('LINK',url);
        var data = JSON.stringify({
          tweetId: tweetId,
          tweet: tweet
        });
        queue.pushToTweetQueue(data);
      }
    }
    console.log(user + ': ' + text);
  });
}

function onFollow(eventMsg) {
  gs.getRewards().then(rewards => {
    var name = eventMsg.source.name;
    var screenName = eventMsg.source.screen_name;
    console.log('Followed by: ', name, screenName);
    // check if this person is in the followed Set
    // sismember ref: https://redis.io/commands/sismember
    queue.isAlreadyFollowed(screenName).then(isMember => {
      // if this person is NOT in the followed Set, push them to the queue
      if (!isMember) {
        var reward = rewards.pick();
        var data = JSON.stringify({
          tweet: '@' + screenName + ' ' + reward.text,
          url: reward.url
        });
        queue.pushToFollowedQueue(data);
        queue.addToFollowed(screenName);
      }
      // if the person is in the follow set, well then...
      else {
        // do nothing
      }
    })
  });
}

function startWatcher() {
  // start listening for mentions of our bot name
  var stream = T.stream('statuses/filter', { track: [ bot_name ] });
  stream.on('tweet', onTweet);

  // also track follows and add to a different queue
  var userStream = T.stream('user');
  userStream.on('follow', onFollow);
}

module.exports = startWatcher;
