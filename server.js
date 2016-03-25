var express = require('express') ;
var session = require('express-session') ;
var cookieParser = require('cookie-parser') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;
var moment = require('moment');
var nodemailer = require('nodemailer') ;

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
  secret: '8637DA5C-F544-4132-AE53-309005ECC4D0',
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

    res.render('landing', {downloadLink:downloadLink, userAgent:req.headers['user-agent']}) ;
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
    res.redirect('/home');
  }
  else {
    console.log("Request parameters: " + JSON.stringify(req.query));

    var parameters = {
      error: null,
      user: req.query.user
    } ;
    res.render('login', parameters) ;
  }
}) ;

app.get('/register', function(req, res) {
  res.render('register', {user: null, error:null}) ;
}) ;

app.post('/register', function(req, res) {
  console.log('api register: %s, %s, %s', req.body.user, req.body.pwd, req.body['re-pwd']); 

  if (req.body.user.length == 0) {
    res.render('register', {user: req.body.user, user_error:"Niepoprawna nazwa użytkownika !"});      
  }

  var pwd = utils.security.hashValue(req.body.pwd) ;
  var retypedPwd = utils.security.hashValue(req.body['re-pwd']) ;

  var mongoUrl = environment.config.db() ;  
  
  // register if not exists
  MongoClient.connect(mongoUrl, function(err, db) {

    var users = db.collection('users') ;

    users.findOne({name: req.body.user}, function(err, user) {
      if (user == null) {
        if (pwd == retypedPwd) {
          var usr = {name: req.body.user, password: pwd} ;
          
          users.save(usr, null, function(err, result) {           
            users.findOne(usr, function(err, user) {
              utils.helpers.storeUserInSession(req, res, user) ;
              db.close();
            }) ;
          }) ;
        }
        else {
          db.close() ;
          res.render('register', {user: req.body.user, error:"Hasła nie pasują !"});
        }
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
  res.redirect('/');
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
          
          utils.helpers.storeUserInSession(req, res, user) ;
          
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

app.post('/api/note/create', authorizeAPI, function(req, res){
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

app.post('/api/note/delete/:id', authorizeAPI, function(req, res){
  console.log("api: delete note: " + req.params.id) ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection('notes').remove({_id: mongodb.ObjectID(req.params.id)}) ;
    db.close() ;
    
    res.writeHead(200);
    res.end();
  }) ;
}) ;

app.put('/api/note/update/:id', authorizeAPI, function(req, res){
  console.log("api: update note: " + req.params.id) ;

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

app.post('/api/notes/removeall', authorizeAPI, function(req, res){
  console.log("api: remove all notes(s)") ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(mongoUrl, function(err, db) {
    var query = {owner: userid} ;//{users: {$elemMatch: {$eq:userid}}} ;

    db.collection('notes').drop(query) ;
    db.close() ;
    res.redirect('/');
  }) ;
}) ;

app.put('/api/note/check/:id/:state', authorizeAPI, function(req, res){
  console.log("api: note check: " + JSON.stringify(req.params));
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, item){
      item.checked = (req.params.state === "true") ;
      //item.timestamp = moment().valueOf() ;
      db.collection('notes').save(item) ;
      db.close() ;
      res.sendStatus(200); 
    }) ;
  }) ;
});

app.put('/api/note/pin/:id/:state', authorizeAPI, function(req, res){
  console.log("api: note pin: " + JSON.stringify(req.params));
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

app.get('/api/user/config', authorizeAPI, function(req, res) {
  console.log("api: get user config");

  MongoClient.connect(environment.config.db(), function(err, db) {
     db.collection('users').findOne({_id: mongodb.ObjectID(req.session.userid)}, function(err, user) {
      console.log("User config: " + JSON.stringify(user.config)) ;
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({config:user.config}));
      db.close() ;
    }) ;
  }) ;
}) ;

app.put('/api/user/config', authorizeAPI, function(req, res) {
  console.log("api: put user config: " + JSON.stringify(req.body));

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('users').findOne({_id: mongodb.ObjectID(req.session.userid)}, function(err, user) {
      
      user.config = {
        tags: req.body.tags
      } ;

      console.log("Saving user: " + JSON.stringify(user));

      db.collection('users').save(user) ;
      db.close() ;
      res.sendStatus(200); 
    }) ;
  }) ;
}) ;

app.post('/api/reset', function(req, res){
  var response = {
    email: req.query.email
  };

  if (process.env.LOCAL_NODEJS_IP !== undefined) {
    var transporter = nodemailer.createTransport('smtps://todo.noreply%40poczta.onet.pl:Stasiek1@smtp.poczta.onet.pl') ;

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: 'todo.noreply@poczta.onet.pl', // sender address
        to: req.query.email, // list of receivers
        subject: 'Hello !', // Subject line
        text: 'Hello world !', // plaintext body
        html: '<b>Hello world !</b>' // html body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
        
        response.info = info.response ;
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(response));
    });
  }
  else {
    response.info = "unavailable" ;
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(response));
  }
}) ;

app.get('*', function(req, res){
  res.redirect('/');
});

app.listen(environment.config.port(), environment.config.ip(), function(){
  console.log('2do server started: %s:%s', environment.config.ip(), environment.config.port()) ;
}) ;
