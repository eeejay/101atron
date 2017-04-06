const imageCache = new Map();

class Images {
  constructor(redisClient) {
    this.client = redisClient;
  }

  getImage(url) {
    let chunks = [];
    return new Promise((resolve, reject) => {
      request.get(url)
        .on('error', reject)
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => {
          resolve(Buffer.concat(chunks).toString('base64'));
      });
    });
  }

  get(url) {
    let b64url = new Buffer(url).toString('base64');var chunks = [];
    if (!this.client) {
      if (imageCache.has(b64url)) {
        return Promise.resolve(imageCache.get(b64url));
      }

      return this.getImage(url).then(b64Content => {
        imageCache.set(b64url, b64Content);
        return b64Content;
      });
    }

    return Promise.resolve();
  }
}