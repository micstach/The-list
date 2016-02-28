var express = require('express') ;
var session = require('express-session') ;
var cookieParser = require('cookie-parser') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;
var moment = require('moment');

var environment = require('./environment.js') ;
var utils = require('./utils.js');

var MongoClient = mongodb.MongoClient ;

var app = express() ;

app.set('views', __dirname + '/public/views');  
app.set('view engine', 'ejs');  
  
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());  

app.use(bodyParser.urlencoded({
  extended:true
}));

app.use(cookieParser('cookie-guid'));  

app.use(session({
  secret: 'super-secret',
  resave: false,
  saveUninitialized: true
}));

var authorize = function(req, res, next) {
  console.log('autohrize, session user: %s', req.session.user)
  if (req.session.user != undefined)
    return next();
  else
    return res.redirect('/login');
};

app.get('/messages', authorize, function(req, res) {

  var mongoUrl = environment.config.db();  
  var userid = req.session.user.toString();

  console.log(userid) ;

  MongoClient.connect(mongoUrl, function(err, db) {
    var collection = db.collection(userid).find().toArray(function(err, result){
      console.log("mongo result: %s", JSON.stringify(result));

      MongoClient.connect(mongoUrl, function(err, _db) {
        _db.collection('users').findOne({_id: mongodb.ObjectID(userid)}, function(err, item){
          res.render('messages', {userid:userid, messages:result}) ;
          _db.close();
        }) ;
      });

      db.close();
    });
  }) ;

}) ;

app.get('/', authorize, function(req, res) {
  if (req.session.user === undefined) {
    res.redirect('/login') ;
  }
  else {
    console.log("ui: user %s", req.session.user) ;
    console.log("ui: user-agent: " + req.headers['user-agent']);

    var desktopClient = (req.headers['user-agent'] === 'desktop client') ;
    var downloadLink = null ;
    console.log("desktopClient: " + desktopClient);

    if (req.headers['user-agent'].indexOf('Windows') != -1) {
      downloadLink = '/clients/windows/TheListClientPackage.zip';
    }
    else if (req.headers['user-agent'].indexOf('Android') != -1) {
      downloadLink = '/clients/android/TheListClient.apk';
    }

    var mongoUrl = environment.config.db();  
    
    console.log("DbUrl: %s", mongoUrl);

    MongoClient.connect(mongoUrl, function(err, db) {
      var collection = db.collection(req.session.user).find().toArray(function(err, result){
        console.log("mongo result: %s", JSON.stringify(result));

        MongoClient.connect(mongoUrl, function(err, _db) {
          _db.collection('users').findOne({_id: mongodb.ObjectID(req.session.user)}, function(err, item){
            res.render('index', {desktopClient: desktopClient, downloadLink:downloadLink, username: item.name, userid:req.session.user, messages:result}) ;
            _db.close();
          }) ;
        });

        db.close();
      });
    }) ;
  }
});

app.get('/login', function(req, res) {
  if (req.session.user !== undefined){
    res.redirect('/');
  }
  else {
    res.render('login', {error:null}) ;
  }
}) ;

app.get('/register', function(req, res) {
  res.render('register', {user: null, error:null}) ;
}) ;

app.post('/register', function(req, res) {
  console.log('api register: %s, %s, %s', req.body.user, pwd, retypedPwd); 

  if (req.body.user.length == 0) {
    res.render('register', {user: req.body.user, user_error:"Niepoprawna nazwa użytkownika !"});      
  }

  var pwd = utils.security.hashValue(req.body.pwd) ;
  var retypedPwd = utils.security.hashValue(req.body['re-pwd']) ;

  var mongoUrl = environment.config.db() ;  
  
  // register if not exists
  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection('users').findOne({name: req.body.user}, function(err, user) {
      if (user == null) {
        if (pwd == retypedPwd) {
          db.collection('users').save({name: req.body.user, password: pwd}) ;
          db.close() ;
        }
        else {
          db.close() ;
          res.render('register', {user: req.body.user, error:"Hasła nie pasują !"});
        }

        res.redirect('/login');
      }
      else {
        db.close() ;
        res.render('register', {user: req.body.user, user_error:"Użytkownik o tej nazwie już istnieje !"});      
      }
    });
  }) ;
}) ;

app.get('/logoff', function(req, res){
  req.session.destroy();
  res.redirect('/login');
}) ;

app.post('/login', function(req, res) {
  console.log('login user: %s, %s', req.body.user, req.body.pwd);

  if (req.body.user.length == 0 || req.body.pwd.length == 0) {
    res.render('login', {error: "Niepoprawny użytkownik lub hasło !"}); 
  }
  else {
    var mongoUrl = environment.config.db();
    var pwd = utils.security.hashValue(req.body.pwd) ;

    MongoClient.connect(mongoUrl, function(err, db) {
      db.collection('users').findOne({name: req.body.user, password: pwd}, function(err, user) {
          console.log("mongo err: %s", JSON.stringify(err));
          console.log("mongo user: %s", JSON.stringify(user));

          if (user !== null) {
            req.session.user = user._id ;
            res.redirect('/');
          }
          else {
            console.log("user not verified !") ;
            req.session.destroy();
            res.render('login', {error: "Niepoprawny użytkownik lub hasło !"}); 
          }
          db.close();
        });
    }) ;
  }
}) ;

app.post('/api/message/create', authorize, function(req, res){
  console.log("api: message delete");
  var mongoUrl = environment.config.db() ;  
  var userid = req.session.user ;

  if (req.body.message.length == 0) {
    res.redirect('/') ;
  }
  else {

    MongoClient.connect(mongoUrl, function(err, db) {
      
      db.collection(userid).save({
        text: req.body.message, 
        status: 'unchecked',
        timestamp: moment().valueOf() 
      }) ;

      db.close() ;

      res.redirect('/');
    }) ;
  }
}) ;

app.post('/api/message/delete/:id', authorize, function(req, res){
  console.log("api: delete message: %d", req.params.id) ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.user ;

  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection(userid).remove({_id: mongodb.ObjectID(req.params.id)}) ;
    db.close() ;
    res.redirect('/');
  }) ;
}) ;

app.post('/api/message/removeall', authorize, function(req, res){
  console.log("api: remove all message(s)") ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.user ;

  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection(userid).drop() ;
    db.close() ;
    res.redirect('/');
  }) ;
}) ;

app.put('/api/message/:status/:id', authorize, function(req, res){
  console.log("api: message status: " + JSON.stringify(req.params));
  var userid = req.session.user ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection(userid).findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, item){
      item.status = req.params.status ;
      item.timestamp = moment().valueOf() ;
      db.collection(userid).save(item) ;
      db.close() ;
      res.sendStatus(200); 
    }) ;
  }) ;
});

app.get('*', function(req, res){
  res.redirect('/');
});

app.listen(environment.config.port(), environment.config.ip(), function(){
  console.log('Server started: %s:%s', environment.config.ip(), environment.config.port()) ;
}) ;
