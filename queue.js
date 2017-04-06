const { promisifyAll } = require("bluebird");
const memDb = {
  followSet: new Set(),
  followQueue: [],
  tweetQueue: []
}

class Queue {
  constructor(botName, redisClient) {
    this.client = promisifyAll(redisClient);
    this.botName = botName;
  }

  isAlreadyFollowed(screenName) {
    if (!this.client) {
      return Promise.resolve(memDb.followSet.has(screenName));
    }

    return this.client.sismemberAsync(this.botName + '-followed-set', screenName);
  }

  addToFollowed(screenName) {
    if (!this.client) {
      memDb.followSet.add(screenName);
      return Promise.resolve();
    }

    return this.client.saddAsync(this.botName + '-followed-set', screenName);
  }

  pushToFollowedQueue(data) {
    if (!this.client) {
      memDb.followQueue.unshift(data);
      return Promise.resolve();
    }

    return this.client.rpushAsync(this.botName + '-follow-queue', data);
  }

  popFromFollowedQueue() {
    if (!this.client) {
      return Promise.resolve(memDb.followQueue.pop());
    }

    return this.client.lpopAsync(this.botName + '-follow-queue').then(reply => {
      return JSON.parse(reply);
    });
  }

  pushToTweetQueue(data) {
    if (!this.client) {
      memDb.tweetQueue.unshift(data);
      return Promise.resolve();
    }

    console.log("pushToTweetQueue");
    return this.client.rpushAsync(this.botName + '-queue', data);
  }

  popFromTweetQueue() {
    if (!this.client) {
      return Promise.resolve(memDb.tweetQueue.pop());
    }

    return this.client.lpopAsync(this.botName + '-queue').then(reply => {
      return JSON.parse(reply);
    });
  }
}

module.exports = Queue;