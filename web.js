var express = require('express')

var activity = [];
var app = express();
app.use(express.static('public'));

app.get('/activity', (req, res) => {
  res.json(activity);
});

function start() {
  app.listen(process.env.PORT || 3000, function () {
    console.log('Example app listening on port 3000!')
  });
}

function activityToList() {
  let table = "<dl>";
  for (let item of activity) {
    let event = `${item[0].user.screen_name} tweeted<br/>${item[0].text}`;
    let response = `Bot responded: ${item[1].tweet}`;
    table += `<dt style="margin-top: 2rem; margin-bottom: 1rem">${event}</dt><dd>${response}</dd>`;
  }
  table += "</dl>";
  return table;
}

module.exports = { start, activity };