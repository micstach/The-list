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


var authorizeAPI = function(req, res, next) {
  if (req.session.userid !== undefined)
    return next() ;
  else
  {
    res.writeHead(401);
    res.end();
    return res; 
  }
};

var authorize = function(req, res, next) {
  console.log('autohrize, session user: %s', req.session.userid)
  if (req.session.userid != undefined)
    return next();
  else
  {
    return res.redirect('/login');
  }
};

app.get('/', function(req, res) {
  if (req.session.userid === undefined) {
    
    var downloadLink = null ;
   
    if (req.headers['user-agent'].indexOf('Windows') != -1) {
      downloadLink = '/clients/windows/TheListClientPackage.zip';
    }
    else if (req.headers['user-agent'].indexOf('Android') != -1) {
      downloadLink = '/clients/android/TheListClient.apk';
    }

    res.render('landing', {downloadLink:downloadLink}) ;
  }
  else {
    res.redirect('/home') ;
  }
});

app.get('/home', authorize, function(req, res) {
  if (req.session.userid === undefined) {
    res.redirect('/login') ;
  }
  else {
    console.log("ui: user %s", req.session.userid) ;
    console.log("ui: user-agent: " + req.headers['user-agent']);

    var desktopClient = (req.headers['user-agent'] === 'desktop client') ;
    console.log("desktopClient: " + desktopClient);

    var mongoUrl = environment.config.db();  
    var userid = req.session.userid ;

    MongoClient.connect(mongoUrl, function(err, db) {
      db.collection('users').findOne({_id: mongodb.ObjectID(userid)}, function(err, user){
        res.render('notes', {desktopClient: desktopClient, username: user.name, userid:userid}) ;
        db.close();
      }) ;
    });
  }
});

app.get('/login', function(req, res) {
  if (req.session.userid !== undefined){
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
            req.session.userid = user._id ;
            res.redirect('/home');
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

app.get('/api/notes', authorizeAPI, function(req, res) {
  console.log('GET: /notes') ;

  var userid = req.session.userid;

  MongoClient.connect(environment.config.db(), function(err, db) {
      var query = {owner: userid} ;//{users: {$elemMatch: {$eq:userid}}} ;

      db.collection('notes').find(query).toArray(function(err, result) {
    
      result.forEach(function(note){
        if (note.pinned === undefined) {
          note.pinned = false ;
        }
        if (note.checked === undefined) {
          note.checked = false ;
        }
      }) ;

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({userid:userid, notes:result}));

      db.close();
    });
  }) ;
}) ;

app.post('/api/note/create', authorize, function(req, res){
  console.log("api: note create:" + JSON.stringify(req.body));
   
  var userid = req.session.userid ;

  if (req.body.text.length == 0) {
    res.redirect('/') ;
  }
  else {
    MongoClient.connect(environment.config.db(), function(err, db) {
      db.collection('notes').save({
        text: req.body.text, 
        checked: false,
        pinned: req.body.pinned,
        owner: userid,
        users: [userid],
        tags: req.body.tags,
        timestamp: moment().valueOf() 
      }) ;
      db.close() ;
      res.writeHead(200);
      res.end();
    }) ;
  }
}) ;

app.post('/api/note/delete/:id', authorize, function(req, res){
  console.log("api: delete message: " + req.params.id) ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection('notes').remove({_id: mongodb.ObjectID(req.params.id)}) ;
    db.close() ;
    
    res.writeHead(200);
    res.end();
  }) ;
}) ;

app.put('/api/note/update/:id', authorize, function(req, res){
  console.log("api: update message: " + req.params.id) ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, item){
      item.text = req.body.text ;
      item.tags = req.body.tags ;
      db.collection('notes').save(item) ;
      db.close() ;
      res.sendStatus(200); 
    }) ;
  }) ;

}) ;

app.post('/api/message/removeall', authorize, function(req, res){
  console.log("api: remove all message(s)") ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(mongoUrl, function(err, db) {
    var query = {owner: userid} ;//{users: {$elemMatch: {$eq:userid}}} ;

    db.collection('notes').drop(query) ;
    db.close() ;
    res.redirect('/');
  }) ;
}) ;

app.put('/api/message/check/:id/:state', authorize, function(req, res){
  console.log("api: message check: " + JSON.stringify(req.params));
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, item){
      item.checked = (req.params.state === "true") ;
      item.timestamp = moment().valueOf() ;
      db.collection('notes').save(item) ;
      db.close() ;
      res.sendStatus(200); 
    }) ;
  }) ;
});

app.put('/api/message/pin/:id/:state', authorize, function(req, res){
  console.log("api: message pin: " + JSON.stringify(req.params));
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, item){
      item.pinned = (req.params.state === "true") ;
      db.collection('notes').save(item) ;
      db.close() ;
      res.sendStatus(200); 
    }) ;
  }) ;
});

app.get('*', function(req, res){
  res.redirect('/');
});

app.listen(environment.config.port(), environment.config.ip(), function(){
  console.log('2do server started: %s:%s', environment.config.ip(), environment.config.port()) ;
}) ;
