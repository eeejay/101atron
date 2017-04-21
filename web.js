var express = require('express')
const { promisifyAll } = require("bluebird");
var redis = require('redis')

var config = require('./config.js');
var redis_addr = config.redis_port || config.redis_url;
var client = redis_addr ? promisifyAll(redis.createClient(redis_addr)) : null;

const activity = {
  _list: [],

  push: function(data) {
    if (client) {
      client.lpushAsync("activity-" + config.bot_name, JSON.stringify(data)).then(() => {
        client.ltrimAsync("activity-" + config.bot_name, 0, 999); // Only store last 1,000 entries..
      });
    } else {
      this._list.unshift(data);
      this._list.splice(1000);
    }
  },

  list: function() {
    if (client) {
      return client.lrangeAsync("activity-" + config.bot_name, 0, 999)
        .then(r => r.map(JSON.parse));
    } else {
      return Promise.resolve(this._list);
    }
  }
}

var app = express();
app.use(express.static('public'));

app.get('/activity', (req, res) => {
  activity.list().then(list => {
    res.json(list);
  })
});

function start() {
  app.listen(process.env.PORT || 3000, function () {
    console.log('Example app listening on port 3000!')
  });
}

module.exports = { start, activity };