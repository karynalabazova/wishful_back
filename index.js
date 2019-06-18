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
            '/join',
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
    deleted: { type: Boolean, default: false },
    items: [
      {
        text: String,
        checked: { type: Boolean, default: false }
        //who
      }
    ]
});
const List = mongoose.model('list', listSchema);

async function authenticate({ username, password }) { //контроллер авторизации
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
async function join ({ username, password }) {
  let user = await new User({nick: username, password: shajs('sha256').update(password).update(salt).digest('hex')})
  await user.save()
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
        .then(user => user ? res.json(user) :
          res.status(400).json({ message: 'Username or password is incorrect' }))
        .catch(err => next(err));
});

app.post('/join', async function (req, res, next){
  let findUser = await User.find({nick: req.body.username})
  findUser.length > 1 ?
    res.status(400).json({ message: 'User already exists' }) :
      (join(req.body)
          .then(user =>  res.json(user))
          .catch(err => next(err)))
})

app.use(jwtWare());


app.route('/lists/:id')
.get(async function (req, res) {
  // let findUser = await User.findOne({_id: req.params.id})
  let arr = []
  let findOwnLists = await List.find({owner: req.params.id, deleted: false})
  let findOtherLists = await List.find({deleted: false}).populate('owner', 'nick _id')
  findOtherLists.map(x =>
    x.readers.includes(req.params.id) ? arr.push(x) : null
  )
  let data = {OwnList: findOwnLists.reverse(),
              OtherLists:arr.reverse()}
  res.send(data);
  })
.post(async function (req, res) {
  let readers =[]
  let findUser = await User.findOne({_id: req.params.id})
  let findList = await List.find({deleted: false, title: req.body.title, owner: {_id : req.params.id}}).populate('owner', ' _id')
  console.log(findList)
  if (findList.length < 1){
    let findReaders = await User.find({nick: {$in :req.body.shareWith}}).distinct('_id')
    let createdList = await new List({
      owner: req.params.id,
      title : req.body.title,
      readers: findReaders
    })
    await createdList.save()
    res.status(201).send(req.body)
  } else {
    res.status(400).json({ message: 'List already exists' })
  }

});

app.post('/delete/:nick/:listName', async function (req, res){
  let findUser = await User.findOne({nick: req.params.nick})
  let findLists = await List.updateOne({owner: findUser._id,
    title: req.params.listName, deleted: false},
    {deleted: true}, (err) => {});
  console.log(findLists)
  res.json(findLists)
})

app.route('/lists/:nick/:listName')
.get(async function (req, res) {
  let findLists = await List.findOne({owner: req.params.nick,
    title: req.params.listName, deleted: false})
  res.send(findLists.items.reverse());
  })
.post(async function (req, res) {
  console.log(req.body)
  let findUser = await User.findOne({nick: req.params.nick})
  let createdList = await List.findOne({owner: findUser._id,
    title: req.params.listName, deleted: false })
  createdList.items.push({text: req.body.title})
  await createdList.save()
  res.send(createdList.items)
});

app.post('/check/:nick/:listName', async function (req, res){
  let findLists = await List.findOne({owner: req.params.nick,
    title: req.params.listName, deleted: false})
  findLists.items.map(x =>
    (x.text === req.body.title ?
      (x.checked === false ? x.checked = true : null):
        null)
  )
  await findLists.save()
  console.log(findLists)
  res.json(findLists)
})
// ;(async () =>{
// //   let newUser = new User
// //   newUser.nick ="user"
// //   newUser.password = setPassword("password")
// //   await newUser.save()
// //
//   let newList = new List
//   newList.owner = '5cf18a8bfcc2eb13298a9804';
//   newList.readers = ["5ced761c485d4b548c0a26a9", "5cf18a8bfcc2eb13298a9804"]
//   newList.title = "Shared list(Karyna)"
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
