const memDb = {
  followSet: new Set(),
  followQueue: [],
  tweetQueue: []
}

class Queue {
  constructor(redisClient) {
    this.client = redisClient;
  }

  isAlreadyFollowed(screenName) {
    if (!this.client) {
      return Promise.resolve(memDb.followSet.has(screenName));
    }

    return Promise.resolve();
  }

  addToFollowed(screenName) {
    if (!this.client) {
      memDb.followSet.add(screenName);
      return Promise.resolve();
    }

    return Promise.resolve();
  }

  pushToFollowedQueue(data) {
    if (!this.client) {
      memDb.followQueue.unshift(data);
      return Promise.resolve();
    }

    return Promise.resolve();
  }

  popFromFollowedQueue() {
    if (!this.client) {
      return Promise.resolve(memDb.followQueue.pop());
    }

    return Promise.resolve("");
  }

  pushToTweetQueue(data) {
    if (!this.client) {
      memDb.tweetQueue.unshift(data);
      return Promise.resolve();
    }

    return Promise.resolve();
  }

  popFromTweetQueue() {
    if (!this.client) {
      return Promise.resolve(memDb.tweetQueue.pop());
    }

    return Promise.resolve({});
  }
}

module.exports = Queue;