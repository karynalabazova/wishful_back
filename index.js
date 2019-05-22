const fs  = require('fs')
var express = require('express')
var app = express()
var shajs = require('sha.js');
var cors = require('cors');
const expressJwt = require('express-jwt');
const jwt = require('jsonwebtoken');
const config = {
    secret: `;dtn',kznm` //тот самый секретный ключ, которым подписывается каждый токен, выдаваемый клиенту
}
function jwtWare() {
    const { secret } = config;
    return expressJwt({ secret }).unless({ //блюдет доступ к приватным роутам
        path: [
            // public routes that don't require authentication
            '/login',
            '/'
        ]
    });
}
function errorHandler(err, req, res, next) {
    if (typeof (err) === 'string') {
        // custom application error
        return res.status(400).json({ message: err });
    }

    if (err.name === 'UnauthorizedError') { //отлавливает ошибку, высланную из expressJwt
        // jwt authentication error
        return res.status(401).json({ message: 'Invalid Token' });
    }

    // default to 500 server error
    return res.status(500).json({ message: err.message });
}

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/wishful');

const db = mongoose.connection;
const salt = "bigsecret";

var userSchema = new mongoose.Schema({
  nick: String,
  password: String
});
const User = mongoose.model('user', userSchema);

function setPassword(pw){
  var password = shajs('sha256').update(pw).update(salt).digest('hex')
  return password
}

var listSchema = new mongoose.Schema({
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    },
    readers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
      }
    ],
    title: String,
    deleted: Boolean,
    items: [
      {
        text: String,
        checked: Boolean
      }
    ]
});
const List = mongoose.model('list', listSchema);

async function authenticate({ username, password }) { //контроллер авторизации
    console.log(username, password)
    let user = await User.findOne({nick: username, password: shajs('sha256').update(password).update(salt).digest('hex')})
    if (user) {
        const token = jwt.sign({ sub: user.id }, config.secret); //подписывам токен нашим ключем
        const nick = user.nick
        const { password, ...userWithoutPassword } = user;
        return { //отсылаем интересную инфу
          nick,
          token
        };
    }
}

app.use(cors());
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header('Access-Control-Allow-Methods', 'DELETE, PUT, GET, POST');
   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
   next();
});

app.post('/login', async function (req, res, next) {
    authenticate(req.body)
        .then(user => user ? res.json(user) : res.status(400).json({ message: 'Username or password is incorrect' }))
        .catch(err => next(err));
});

app.use(jwtWare());
// (async () =>{
//   let newUser = new User
//   newUser.nick ="user"
//   newUser.password = setPassword("password")
//   await newUser.save()
//
//   let newList = new List
//   newList.owner = newUser._id;
//   newList.readers = ["5cd6d322ff78bf38f3901251", "5cd6d1e160cfec3862f66d79"]
//   newList.title = "title"
//   newList.deleted = false
//   newList.items = [{text: "text", checked: false},{text: "item", checked: true}]
//   await newList.save()
// })();

// List.find({})
//             .populate('owner')
//             .exec(function(error, lists) {
//                 console.log(JSON.stringify(lists, null, "\t"))
//             })

app.listen(4000, function () {
  console.log('Example app listening on port 4000!');
});
