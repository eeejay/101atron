var GoogleSpreadsheet = require('google-spreadsheet');
var config = require('./config.js');

const LOOKUP_INTERVAL = 2 * 60 * 1000 // Two minutes in milliseconds

class GoogleSheet {
  constructor(spreadsheet_key) {
    this.gs = new GoogleSpreadsheet(spreadsheet_key);
    this.cache = {};
    this.lastFetch = {};
  }

  getRows(rowNum) {
    if (Date.now() - (this.lastFetch[rowNum] || 0) < LOOKUP_INTERVAL) {
      // We are trying to fetch this within the minimal time period.
      // Return cached version
      return Promise.resolve(this.cache[rowNum]);;
    }

    return new Promise((resolve, reject) => {
      this.gs.getRows(rowNum, (err, data) => {
        if (err) {
          reject(err);
        } else {
          this.cache[rowNum] = data;
          this.lastFetch[rowNum] = Date.now();
          resolve(data);
        }
      });
    });
  }

  getKeywords() {
    // get the first sheet, for Keywords
    // this.gs.getRows(worksheet_id, options, callback)
    // 'data' returns an array of row objects, like [{"x": "horse", "y":"horse.com"}]
    return this.getRows(1).then(data => {
      return new Map(data.map(e => [e.keyword.toLowerCase(), e.url]));
    });
  }

  getUsers() {
    // get the second sheet, for Users
    return this.getRows(2).then(data => {
      return new Set(data.map(e => e.user.toLowerCase()));
    });
  }


  getReplies() {
    // get the third sheet, for Replies
    return this.getRows(3).then(data => {
      return data.map(e => e.text).filter(e => e != "");
    });
  }

  getRewards() {
    // get the fourth sheet, for Follow Rewards
    return this.getRows(4).then(data => {
      let filtered = data.filter(e => e.text != "" && e.text.length <= 140);
      return filtered.map(e => {
        return { text: e.text, url: e.image, link: e.link };
      });
    });
  }
}

module.exports = GoogleSheet;

if (require.main === module) {
  const config = require('./config.js');
  let gs = new GoogleSheet(config.spreadsheet_key);
  Promise.all([gs.getKeywords(), gs.getUsers(), gs.getReplies(), gs.getRewards()])
    .catch(console.error.bind(console)).then(res => {
      console.log("keywords", res[0]);
      console.log("\nusers", res[1]);
      console.log("\nreplies", res[2]);
      console.log("\nrewards", res[3]);
    });
}