var express = require('express') ;
var session = require('express-session') ;
var cookieParser = require('cookie-parser') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;

var environment = require('./environment.js') ;

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
    var mongoUrl = environment.configuration.dbHost + req.params.userid;  
    
    console.log("DbUrl: %s", mongoUrl);

    MongoClient.connect(mongoUrl, function(err, db) {
      var collection = db.collection('messages').find().toArray(function(err, result){
        console.log("mongo result: %s", JSON.stringify(result));
        res.render('index', {username: req.params.userid, userid:req.params.userid, messages:result}) ;
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
  res.render('/login') ;
});

app.get('/login', function(req, res) {
  res.render('login') ;
}) ;
 
app.post('/api/login', function(req, res) {
  console.log('login user: %s, %s', req.body.user, req.body.pwd);

  if (req.body.user === 'michal' && req.body.pwd === 'pwd'){
    console.log("user verified") ;
    req.session.user = req.body.user ;
    res.redirect('/user/' + req.body.user); 
  }
  else if (req.body.user === 'julek' && req.body.pwd === 'pwd'){
    console.log("user verified") ;
    req.session.user = req.body.user ;
    res.redirect('/user/' + req.body.user); 
  }
  else if (req.body.user === 'tosia' && req.body.pwd === 'pwd'){
    console.log("user verified") ;
    req.session.user = req.body.user ;
    res.redirect('/user/' + req.body.user); 
  }
  else
  {
    console.log("user not verified !") ;
    req.session.destroy();
    res.redirect('/login'); 
  }
}) ;

app.post('/api/user/:userid/message/:action/:id?', function(req, res){
  console.log("api: %s message(s)", req.params.action) ;

  var mongoUrl = environment.configuration.dbHost + req.params.userid;  
  console.log("DbUrl: %s", mongoUrl);

  if (req.params.action == 'add') {
    if (req.body.message.length > 0) {

      MongoClient.connect(mongoUrl, function(err, db) {
        
        console.log("mongo client connected");
        console.log("mongo error: %s", err) ;

        var collection = db.collection('messages') ;
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
      db.collection('messages').remove({_id: mongodb.ObjectID(req.params.id)}) ;
      db.close() ;
      res.redirect('/user/' + req.params.userid);
    }) ;

  }
  else if (req.params.action == "removeall") {
    console.log("removeall") ;

    MongoClient.connect(mongoUrl, function(err, db) {
      db.collection('messages').drop() ;
      db.close() ;
      res.redirect('/user/' + req.body.userid);
    }) ;
  }
}) ;

app.listen(environment.configuration.port, function(){
  console.log('Server started, port: %s', environment.configuration.port) ;
}) ;
