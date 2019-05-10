const fs  = require('fs')
var express = require('express')
var app = express()
var cors = require('cors');
app.use(cors());
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header('Access-Control-Allow-Methods', 'DELETE, PUT, GET, POST');
   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
   next();
});

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/wishful');

const db = mongoose.connection;

var userSchema = new mongoose.Schema({
  nick: String,
  password: String,
  lists: {
    title: String,
    items: [
      {
        text: String
      }
    ]
  }
});

const User = mongoose.model('user', userSchema);

app.listen(4000, function () {
  console.log('Example app listening on port 4000!');
});
