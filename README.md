# 101atron

101atron is a general purpose bot that listens for authorized users to "invoke" its knowledge base. It's meant to save activists time so you don't have to dig up the same old 101-level articles whenever well-meaning people on Twitter ask you to explain basic concepts to them. Instead you say, "@101atron, tell @thisRandomPerson about human rights" and it'll reply with a link that you've previously associated with the key phrase "human rights".

The key phrases, the authorized users, and even the language it uses to respond are configured via a Google Spreadsheet. While you need a technical person to **run** the bot, you don't need to be technical to **edit** the bot and give it more vocabulary, concepts, etc. You just need to be able to run a Google Spreadsheet.

For a general overview of its use, [check out this article](http://feeltrain.com/blog/stay-woke/).

## Installation prerequisites

To install and run 101atron you need the following software:

* [Node.js](https://nodejs.org/) v0.10+.
* [redis](https://redis.io/topics/quickstart). This is the database software used to track state (optional).

## Redis installation and notes

_This step may not be necessary. Check out the database section below_

Download and compile Redis:

`$ wget http://download.redis.io/redis-stable.tar.gz`

`$ tar xvzf redis-stable.tar.gz`

`$ cd redis-stable`

`$ make`

Copy redis-server and redis-cli into the correct places:

`$ sudo cp src/redis-server /usr/local/bin/`

`$ sudo cp src/redis-cli /usr/local/bin/`

To kill the Redis server:

`$ redis-cli shutdown` in a separate terminal window

## Installation
Clone this repository locally:

`$ git clone git@github.com:dariusk/101atron.git`

or just [download the zip](https://github.com/dariusk/101atron/archive/master.zip) and extract it.

Next enter the project directory and install the dependencies using `npm`, which comes with Node.js:

```bash
$ cd 101atron/
$ npm install
```

## Overview

Before you run the bot, it's useful to understand how it's architected. The bot listens to Twitter, when it is invoked by either a tweet or follow it composes a tweet that is then added to a queue. For rate limiting reasons, the queue is pumped at a regualr interval longer than one minute.

This can all happen in one process, or you can split the tasks into two processes. One that watches Twitter and runs continuously. Another one can be started as a cron job and pumps the queue at a given interval.

## Set up your bot's Twitter account

At this point you need to register a Twitter account and also get its "app info".

So create a Twitter account for your bot. Twitter doesn't allow you to register multiple twitter accounts on the same email address. I recommend you create a brand new email address (try using Gmail) for the Twitter account. Once you register the account to that email address, wait for the confirmation email.

Next, open the Twitter profile for the bot and *associate a mobile phone number with it*. You have to do this in order to register an application. If you only have one mobile phone number and it's already used on a different account, don't sweat it: just disconnect the phone from the other account and connect it to the bot for now. Once you're done registering the app, you can disconnect again and reconnect the phone to the previous account.

Once you've connected a phone number, go here and log in as the Twitter account for your bot:

https://apps.twitter.com/apps/new

Once you're there, fill in the required fields: name, description, website. None of it really matters at all to your actual app, it's just for Twitter's information. Do the CAPTCHA and submit.

Next you'll see a screen with a "Details" tab. Click on the "Settings" tab and under "Application Type" choose "Read and Write", then hit the update button at the bottom.

Then go back to the Details tab, and at the bottom click "create my access token". Nothing might happen immediately. Wait a minute and reload the page. Then there should be "access token" and "access token secret", which are both long strings of letters and numbers.

Now use a text editor to open up the `userconfig.json` file. It should look like this:

```json
{
  "consumer_key":         "blah",
  "consumer_secret":      "blah",
  "access_token":         "blah",
  "access_token_secret":  "blah",
  "redis_port":            6379,
  "bot_name":              "@AccountNameOfYourBotGoesHere",
  "spreadsheet_key":       "1kTohpjjl8i0GFUdvIUc1HLv0hV_JbOaMav7nKVWc7AY"
}
```

In between those quotes, instead of `'blah'`, paste the appropriate info from the Details page. This is essentially the login information for the app that runs your bot.

## Run the database and configure the bot

_You don't need to run the redis server anymore. It is only necessary when your bot is set up to tweet via cron job, so that the scheduled task can grab the queue from persistant storage. If you don't provide a redis port or address, the bot will use a memory-based queue_

So the first thing we need to make this run is our database. Run a Redis server as a background process if you're not already running one:

`$ redis-server &`

This code assumes that Redis is running on its default port of 6379. If you're running it on a different port, just edit `userconfig.json` and change the value of `redis_port` to the right port.

If the Redis host is anything but localhost

Next, update the `bot_name` field in `userconfig.json` to the username of your actual Twitter account for the bot, along with the '@' symbol. If the account name is '@myFirstBot' then set `bot_name` to exactly that.

## Set up the spreadsheet

Take a look at the [default 101atron spreadsheet](https://docs.google.com/spreadsheets/d/1kTohpjjl8i0GFUdvIUc1HLv0hV_JbOaMav7nKVWc7AY/edit?usp=sharing). It consists of four tabs: Links, Users, Responses, and Follow Rewards. The spreadsheet itself is pretty well documented -- just open up each tab and read the description of what it does to familiarize yourself with it.

Right now the bot is set up to use this exact spreadsheet. You can see in the URL that there is a long string of characters -- this is the "spreadsheet key", and it matches what's currently set in `userconfig.json` for `spreadsheet_key`.

You can use this existing spreadsheet to test things out, but eventually you'll want to make a copy of the spreadsheet and enter the new spreadsheet key into `userconfig.json`, then go to "File --> Publish to the web..." and publish the entire spreadsheet to the web. This allows the bot to view the spreadsheet and read the data you put in there.

## Your first test run

Once you have a spreadsheet set up and published (or you're just using the default one), run:

`$ node index.js`

This will make the bot start "watching" for input.

Next, use a Twitter account that you've authorized to invoke the bot in the "Users" tab of the spreadsheet and tweet at the bot with a phrase that includes "about" followed by one of the keywords, along with another user's name.

"@mybot_name, tell @twitter about cats"

This should almost immediately cause the terminal window running `index.js` to write some text to the screen confirming that it saw you talk to it and that it put a tweet in the Redis DB.

After a period less than the set interval (61 seconds by default), the tweet will be retrieved from the Redis DB and published.

## Tweet via cron job

If, for some reason you would like to split the bot into two separate tasks: watching and tweeting, you can start the watcher with the following command:

`$ node index.js --watcher`

You can then schedule the following command via a `cron` or similar scheduler:

`$ node index.js --pop-queue`

This will pop the queue of tweets and follows in the Redis DB and post them to Twitter.

## Permanent setup

If you want this to run reliably and permanently, I recommend the following setup:

* run the bot on a remote server of some kind so it can run 24/7.
* use a process monitoring program like [forever](https://www.npmjs.com/package/forever) to run `index.js`. This will automatically restart `index.js` if it crashes for some reason.
* run your redis DB and `index.js` (via `forever` or similar) on reboot.

## Development

You can run this bot and interact with it on the command line without having it interact with Twitter. This is good for testing. Just set the environment variable `DEBUG` to `1`.

For example:

`$ DEBUG=1 node index.js --interval 1`

You can interact with the bot from standard input and output. To test an example tweet do:

`userfoo tweets: tell @userbar about cats.`

To test a follow:

`userbar follows`

You will see logging output from these inputs that will show how the bot responds.

## Questions

This is pretty complex, so feel free to post any questions you might have in our [issues page](https://github.com/dariusk/101atron/issues).

## License
Copyright (c) 2015 Kazemi, Darius
Licensed under the MIT license.
