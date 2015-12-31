# redis-messenger
Insanely Fast Communication Library For Node.js Services Using Redis

============
Installation

    npm install shimo-messenger

What is redis-messenger
------------------
redis-messenger is a library that makes network communication via Redis dead simple and insanely fast!
It support multi responses and easy to use:

`client.send(data).then(returnArray => console.log(returnArray))`

Example:

```javascript
var messenger = require('redis-messenger');

client = new messenger.Speaker();
server = new messenger.Listener();
server2 = new messenger.Listener();

server.on('give it to me', function(message, response){
  response({you: 'get 1'});
});

server2.on('give it to me', function(message, response){
  response({you: 'get 2'});
});

// Wait for redis initialize
setTimeout(function(){
  client.send('give it to me', {hello:'world'}).then(result => {
    console.log(result);
  });
}, 100);
```

Output:

```javascript
> [{'you':'got 1'}, {'you':'got 2'}]
```
