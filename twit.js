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

  post(type, payload) {
    console.log("Mock Tweet", type, payload);
  }
}

module.exports = process.env.DEBUG ? MockTwit : require('twit');