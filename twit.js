const EventEmitter = require('events');
const readline = require('readline');

class MockTwitStream extends EventEmitter {
  constructor() {
    super();
    this.rl = readline.createInterface({
      input: process.stdin
    });

    this.rl.on("line", input => {
      let msg = this.getMessageFromLine(input);
      if (msg) {
        this.emit(...msg);
      }
    });
  }

  getMessageFromLine(input) {
    // Not implemented in base class
    return null;
  }
}

class MockStatusTwitStream extends MockTwitStream {
  getMessageFromLine(input) {
    let m = input.match(/^(\S+)\stweets:\s?(.*)/);
    if (m) {
      return ["tweet", {
        text: m[2],
        user: { screen_name: m[1] },
        id_str: Math.random() + ''
      }];
    }

    return null;
  }
}

class MockUserTwitStream extends MockTwitStream {
  getMessageFromLine(input) {
    let m = input.match(/^(\S+)\sfollows/);
    if (m) {
      return ["follow", {
        source: {
          name: m[1],
          screen_name: m[1]
      }}];
    }

    return null;
  }
}

const TWEET_STREAMS = {
  'statuses/filter': MockStatusTwitStream,
  'user': MockUserTwitStream
}

class MockTwit {
  constructor() {
  }

  stream(type) {
    return new TWEET_STREAMS[type]();
  }

  post(type, payload, cb) {
    console.log("Mock Tweet", type, payload);
    if (type == "media/upload") {
      cb(null, { media_id_string: Math.random() + '' })
    } else {
      cb(null, null);
    }
  }
}

if (process.env.DEBUG) {
  module.exports = MockTwit;
} else {
  let Twit = require('twit');
  if (process.env.MUTE_TWEETS) {
    Twit.prototype.post = (type, payload, cb) => {
      if (type == "media/upload") {
        console.log("Muted media upload");
        cb(null, { media_id_string: Math.random() + '' })
      } else {
        console.log("Muted tweet:", type, payload);
        cb(null, null);
      }
    };
  }

  module.exports = Twit;
}