var config = require('./config.js');
var startWatcher = require('./watcher');
var Twit = require('./twit');
var twitConfig = Object.entries(config)
  .filter(([key]) => ['consumer_key', 'consumer_secret', 'access_token', 'access_token_secret'].includes(key))
  .reduce((config, [key, val]) => Object.assign(config, { [key]: val }), {});
var Queue = require('./queue');
var Images = require('./images');
var T = new Twit(twitConfig);
var request = require('request');
var Web = require("./web");
var redis = require('redis')

// configuration
var bot_name = config.bot_name;
var redis_addr = config.redis_port || config.redis_url;

function popFollowQueue() {
  // init the redis client
  var client = redis_addr ? redis.createClient(redis_addr) : null;
  var queue = new Queue(bot_name, client);
  // return the most recent follower
  queue.popFromFollowedQueue().then(data => {
    if (!data) {
      if (client) {
        client.quit();
      }

      return;
    }

    console.log('THE TWEET:', data);
    if (!data.url) {
      // tweet the text
      T.post('statuses/update', {status: data.tweet}, function(err, reply) {
        // if there's an error, log it and quit
        if (err) {
          console.log('error:', err);
        }
        // otherwise, log the tweet and quit
        else {
          console.log('reply:', reply);
        }

        if (client) {
          client.quit();
        }
      });
    } else {
      var images = new Images(bot_name, client);
      images.get(data.url).then(theData => {
        // upload the media
        T.post('media/upload', { media: theData }, function (err, dataResp) {
          // store the media in a variable
          var mediaIdStr = dataResp.media_id_string;
          // post a tweet that includes the text and the media
          T.post('statuses/update', { status: data.tweet, media_ids: [mediaIdStr] }, function(err, reply) {
            // if there's an error, log it and quit
            if (err) {
              console.log('error:', err);
            } else {
              console.log('reply:', reply);
            }

            if (client) {
              client.quit();
            }
          });
        });
      });
    }
  });
}

function popQueue() {
  var client = redis_addr ? redis.createClient(redis_addr) : null;
  var queue = new Queue(bot_name, client);

  // pop the queue
  queue.popFromTweetQueue().catch(console.error.bind(console)).then(data => {
    if (!data) {
      if (client) {
        client.quit();
      }

      // if there are no messages (we are not serving activists),
      // THEN we pop the follow queue for some fun instead
      popFollowQueue();
      return;
    }

    T.post('statuses/update', { status: data.tweet, in_reply_to_status_id: data.tweetId }, function(err, reply) {
      if (err) {
        console.log('error:', err);
        if (client) {
          client.quit();
        }
      }
      else {
        console.log('reply:', reply);
        if (client) {
          client.quit();
        }
      }
    });
  });
}

if (require.main === module) {
  let argv = require('minimist')(process.argv.slice(2));

  if (argv['watch']) {
    // start watcher. will probably pop queue from another process..
    startWatcher();
  } else if (argv['pop-queue']) {
    // pop queue once.
    popQueue();
  } else {
    var interval = Number(argv['interval'] || (process.env.DEBUG ? 1 : 61));
    if (isNaN(interval)) {
      console.error("interval must be a number");
      process.exit(1);
    }

    if (interval < 60) {
      console.warn("interval is smaller than 60 seconds");
    }

    // do it all. watch for tweets, and pop the queue.
    startWatcher();
    // pop queue at a set interval.
    setInterval(popQueue, interval*1000);
    Web.start(startWatcher);
  }
}
