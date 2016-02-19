var express = require('express') ;
var session = require('express-session') ;
var cookieParser = require('cookie-parser') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;
var environment = require('./environment.js') ;
var utils = require('./utils.js');

var MongoClient = mongodb.MongoClient ;

var app = express() ;

app.set('views', __dirname + '/public/views');  
app.set('view engine', 'ejs');  
  
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded());
app.use(cookieParser('cookie-guid'));  
app.use(session({secret: 'super-secret'}));

var authorize = function(req, res, next) {
  console.log('autohrize, session user: %s', req.session.user)
  if (req.session.user != undefined)
    return next();
  else
    return res.redirect('/login');
};

// routes
app.get('/user/:userid', authorize, function(req, res) {
  console.log("ui: user %s", req.params.userid) ;

  if (req.session.user == req.params.userid) {
    var mongoUrl = environment.config.db();  
    
    console.log("DbUrl: %s", mongoUrl);

    MongoClient.connect(mongoUrl, function(err, db) {
      var collection = db.collection(req.params.userid).find().toArray(function(err, result){
        console.log("mongo result: %s", JSON.stringify(result));

        MongoClient.connect(mongoUrl, function(err, _db) {
          _db.collection('users').findOne({_id: mongodb.ObjectID(req.params.userid)}, function(err, item){
            res.render('index', {username: item.name, userid:req.params.userid, messages:result}) ;
            _db.close();
          }) ;
        });

        db.close();
      });
    }) ;
  }
  else
  {
    res.redirect('/login') ;
  }
}) ;

app.get('/', authorize, function(req, res){
  res.redirect('/login') ;
});

app.get('/login', function(req, res) {
  res.render('login', {error:null}) ;
}) ;

app.get('/register', function(req, res) {
  res.render('register', {user: null, error:null}) ;
}) ;

app.post('/register', function(req, res){
  var pwd = utils.security.hashValue(req.body.pwd) ;
  var retypedPwd = utils.security.hashValue(req.body['re-pwd']) ;

  console.log('api register: %s, %s, %s', req.body.user, pwd, retypedPwd); 

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

  var mongoUrl = environment.config.db();
  var pwd = utils.security.hashValue(req.body.pwd) ;

  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection('users').findOne({name: req.body.user, password: pwd}, function(err, user) {
        console.log("mongo err: %s", JSON.stringify(err));
        console.log("mongo user: %s", JSON.stringify(user));

        if (user !== null) {
          req.session.user = user._id ;
          res.redirect('/user/' + req.session.user);
        }
        else {
          console.log("user not verified !") ;
          req.session.destroy();
          res.render('login', {error: "Niepoprawny użytkownik lub hasło !"}); 
        }
        db.close();
      });
  }) ;
}) ;

app.post('/api/user/:userid/message/:action/:id?', function(req, res){
  console.log("api: %s message(s)", req.params.action) ;

  var mongoUrl = environment.config.db() ;  
  console.log("DbUrl: %s", mongoUrl);

  if (req.params.action == 'add') {
    if (req.body.message.length > 0) {

      MongoClient.connect(mongoUrl, function(err, db) {
        
        console.log("mongo client connected");
        console.log("mongo error: %s", err) ;

        var collection = db.collection(req.params.userid) ;
        collection.save({text: req.body.message}) ;
        db.close() ;

        res.redirect('/user/' + req.params.userid);
      }) ;
    }
    else {
      console.log('api: empty message typed') ;
      res.redirect('/user/' + req.params.userid);
    }
  } 
  else if (req.params.action == "delete") {
    console.log('message id: %s', req.params.id) ;

    MongoClient.connect(mongoUrl, function(err, db) {
      db.collection(req.params.userid).remove({_id: mongodb.ObjectID(req.params.id)}) ;
      db.close() ;
      res.redirect('/user/' + req.params.userid);
    }) ;

  }
  else if (req.params.action == "removeall") {
    console.log("removeall") ;

    MongoClient.connect(mongoUrl, function(err, db) {
      db.collection(req.params.userid).drop() ;
      db.close() ;
      res.redirect('/user/' + req.params.userid);
    }) ;
  }
}) ;

app.listen(environment.config.port(), environment.config.ip(), function(){
  console.log('Server started, port: %s', environment.config.port()) ;
}) ;
