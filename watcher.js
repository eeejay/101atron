// underscore docs: http://underscorejs.org/#each
//                  http://underscorejs.org/#pick
//                  http://underscorejs.org/#reject
//                  http://underscorejs.org/#find
//                  http://underscorejs.org/#difference
var _ = require('underscore');
_.mixin( require('underscore.deferred') );
var config = require('./config.js');
var Twit = require('./twit');
var twitConfig = _.pick(config, 'consumer_key', 'consumer_secret', 'access_token', 'access_token_secret');
var T = new Twit(twitConfig);
var GoogleSheet = require('./googlesheet');
// create a new googlesheet object
var gs = new GoogleSheet(config.spreadsheet_key);

var bot_name = config.bot_name;
var redis_addr = config.redis_port || config.redis_url || 6379;
var redis = require('redis'), client = redis.createClient(redis_addr);

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
      var wordFound = postText.split(/\s/).find(word => {
        return word.match(/\w/) && keywords.has(word)
      });
      console.log('Word found: ', wordFound);

      // if we did find a word
      if (wordFound !== undefined) {
        // extract every user from the tweet as an array of usernames (minus our own username)
        // match all usernames but remove the bot name itself (case insensitive)
        // so that we have a list of people we're tagging in the message
        var mentions = _.difference(text.match(/@\w*/g), [bot_name.toLowerCase()]);
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
        console.log(data);
        client.rpush(bot_name + '-queue', data, redis.print);
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
    client.sismember(bot_name + '-followed-set', screenName, function(err, isMember) {
      // if this person is NOT in the followed Set, push them to the queue
      if (!isMember) {
        var reward = rewards.pick();
        var data = JSON.stringify({
          tweet: '@' + screenName + ' ' + reward.text,
          url: reward.url
        });
        client.rpush(bot_name + '-follow-queue', data, redis.print);
        // add this person to the followed Set
        client.sadd(bot_name + '-followed-set', screenName);
      }
      // if the person is in the follow set, well then...
      else {
        // do nothing
      }
    });
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
