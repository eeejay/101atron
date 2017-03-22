var _ = require('underscore');
_.mixin( require('underscore.deferred') );
var config = require('./config.js');
var startWatcher = require('./watcher');
var Twit = require('./twit');
var twitConfig = _.pick(config, 'consumer_key', 'consumer_secret', 'access_token', 'access_token_secret');
var T = new Twit(twitConfig);
var request = require('request');

// configuration
var bot_name = config.bot_name;
var redis_addr = config.redis_port || config.redis_url || 6379;

function popFollowQueue() {
  // init the redis client
  var redis = require('redis'), client = redis.createClient(redis_addr);
  // return the most recent follower
  // lpop ref: https://redis.io/commands/lpop
  client.lpop(bot_name + '-follow-queue', function(err, reply) {
    console.log('Next follower is: ', reply);
    // if there is a reply
    if (reply !== null) {
      // parse it and log it
      var data = JSON.parse(reply);
      console.log('THE TWEET:', data);
      // if there's no image URL
      if (!data.url) {
        // tweet the text
        T.post('statuses/update', {status: data.tweet}, function(err, reply) {
          // if there's an error, log it and quit
          if (err) {
            console.log('error:', err);
            client.end();
          }
          // otherwise, log the tweet and quit
          else {
            console.log('reply:', reply);
            client.end();
          }
        });
      }
      // if there is an image URL
      else {
        // get the base64 encoding of the URL
        var b64url = new Buffer(data.url).toString('base64');
        // see if the URL exists in our DB
        client.hexists(bot_name + '-images',b64url, function(err, doesExist) {
          console.log('doesExist:', doesExist);
          // if the URL does exist, get it
          if (doesExist) {
            client.hget(bot_name + '-images',b64url, function(err, theData) {
              // if we have a problem grabbing the image locally, log the error and quit
              if (err) {
                console.log('error:', err);
                client.end();
              // otherwise, we did get our local image
              } else {
                // upload the media
                T.post('media/upload', { media: theData }, function (err, dataResp) {
                  // store the media in a variable
                  var mediaIdStr = dataResp.media_id_string;
                  // post a tweet that includes the text and the media
                  T.post('statuses/update', { status: data.tweet, media_ids: [mediaIdStr] }, function(err, reply) {
                    // if there's an error, log it and quit
                    if (err) {
                      console.log('error:', err);
                      client.end();
                    }
                    // otherwise, log the tweet and quit
                    else {
                      console.log('reply:', reply);
                      client.end();
                    }
                  });
                });
              }
            });
          }
          else {
            // if it doesn't exist, then download the image, convert the image data to base64,
            // then put that in the bot_name + '-images' hash, and then upload it as media
            var chunks = [];
            // download the image
            request
              .get(data.url)
              // if there's an error, log it and quit
              .on('error', function(response) {
                console.log('error:', response);
                client.end();
              })
              // otherwise, push the image chunk into the chunks array
              .on('data', function(chunk) {
                chunks.push(chunk);
              })
              // print 'GOT IT' to the console on quitting
              .on('end', function() {
                console.log('GOT IT');
                // convert image to base64
                var b64content = Buffer.concat(chunks).toString('base64');
                // put the content in the DB
                client.hset(bot_name + '-images',b64url,b64content, function(err) {
                  // if there's an error, log it and quit
                  if (err) {
                    console.log('error:', err);
                    client.end();
                  // otherwise, continue to the media upload
                  } else {
                    // upload the media
                    T.post('media/upload', { media: b64content }, function (err, dataResp) {
                      // store the media in a variable
                      var mediaIdStr = dataResp.media_id_string;
                      // post a tweet that includes the text and the media
                      T.post('statuses/update', { status: data.tweet, media_ids: [mediaIdStr] }, function(err, reply) {
                        // if there's an error, log it and quit
                        if (err) {
                          console.log('error:', err);
                          client.end();
                        }
                        // otherwise, log the tweet and quit
                        else {
                          console.log('reply:', reply);
                          client.end();
                        }
                      });
                    });
                  }
                });
              });
          }
        });
      }
    }
    else {
      // empty queue, close client
      client.end();
    }
  });
}

function popQueue() {
  var redis = require('redis'), client = redis.createClient(redis_addr);
  // pop the queue
  client.lpop(bot_name + '-queue', function(err, reply) {
    console.log('Next is: ', reply);
    // if null, ignore
    if (reply !== null) {
      var data = JSON.parse(reply);
      T.post('statuses/update', { status: data.tweet, in_reply_to_status_id: data.tweetId }, function(err, reply) {
        if (err) {
          console.log('error:', err);
          client.end();
        }
        else {
          console.log('reply:', reply);
          client.end();
        }
      });
    }
    else {
      // empty queue, close client
      client.end();
      // if there are no messages (we are not serving activists),
      // THEN we pop the follow queue for some fun instead
      popFollowQueue();
    }
  });
}

if (require.main === module) {
  let argv = require('minimist')(process.argv.slice(2));
  console.log(argv);

  if (argv['watch']) {
    // start watcher. will probably pop queue from another process..
    startWatcher();
  } else if (argv['pop-queue']) {
    // pop queue once.
    popQueue();
  } else {
    var interval = Number(argv['interval'] || 61);
    if (isNaN(interval)) {
      console.error("interval must be a number");
      process.exit(1);
    }

    if (interval < 60) {
      console.warning("interval is smaller than 60 seconds");
    }

    // do it all. watch for tweets, and pop the queue.
    startWatcher();
    // pop queue at a set interval.
    setInterval(popQueue, interval*1000);
  }
}
