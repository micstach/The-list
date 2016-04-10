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
  console.log('params:' + JSON.stringify(req.params));

  if (req.session.userid !== undefined)
    return next() ;//res.redirect(req.params.path);
  else
  {
    console.log('Unauthorized access: ' + req.url + ', please login!') ;

    return res.redirect('/login?path=' + req.url);
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
  console.log("ui: user %s", req.session.userid) ;
  console.log("ui: user-agent: " + req.headers['user-agent']);

  var desktopClient = (req.headers['user-agent'] === 'desktop client') ;
  console.log("desktopClient: " + desktopClient);

  var mongoUrl = environment.config.db();  
  var userid = req.session.userid ;

  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection('users').findOne({_id: mongodb.ObjectID(userid)}, function(err, user){
      res.render('home', {desktopClient: desktopClient, username: user.name, userid:userid}) ;
      db.close();
    }) ;
  });
});

app.get('/login', function(req, res, next) {
  if (req.session.userid !== undefined) {
    res.redirect('/home') ;
  }
  else {
    console.log("Login request parameters: " + JSON.stringify(req.query));

    var parameters = {
      error: null,
      user: req.query.user,
      path: req.query.path
    } ;

    res.render('login', parameters) ;
  }
}) ;

app.get('/register', function(req, res) {
  
  var parameters = {
    user: null, 
    error: null,
  };

  if (req.query.id !== undefined) {
    parameters.id = req.query.id ;
    parameters.email = req.query.email ;
  }
  else {
  }
 
  res.render('register', parameters) ;
}) ;

app.post('/register', function(req, res) {
  console.log('api register: %s', JSON.stringify(req.body)); 

  if (req.query.id === undefined || req.query.email === undefined)
  {
    var mongoUrl = environment.config.db() ;  
    MongoClient.connect(mongoUrl, function(err, db) {
      var registerRequest = db.collection('registerRequest') ;

      registerRequest.findOne({email: req.query.email}, function(err, request) {
        if (request === null) {
          var newRequest = {email: req.body.email} ;
          
          registerRequest.save(newRequest, null, function(err, result) {           
            registerRequest.findOne(newRequest, function(err, request) {
              db.close();
              sendEmail(request, getPreRegisterEmailContent(request)) ;
              res.render('register', {verificationSent: true, email: request.email});
            }) ;
          }) ;
        }
        else {
          db.close() ;
          // sendEmail(request, getPreRegisterEmailContent(request)) ;
          res.render('register', {verificationSent: true, email: request.email});
        }
      });
    });
  }
  else 
  {
    // check pair:
    // - req.query.id
    // - req.query.email
    // if found perform registration, remove from db {req.query.id, req.query.email}

    if (req.body.user.length == 0) {
      res.render('register', {user: req.body.user, user_error:"Niepoprawna nazwa użytkownika !"});      
    }

    var pwd = utils.security.hashValue(req.body.pwd) ;
    var retypedPwd = utils.security.hashValue(req.body['re-pwd']) ;

    var mongoUrl = environment.config.db() ;  
    
    // register if not exists
    MongoClient.connect(mongoUrl, function(err, db) {

      db.collection('registerRequest').remove({_id: mongodb.ObjectID(req.query.id)}) ;

      var users = db.collection('users') ;

      users.findOne({name: req.body.user, email: req.body.email}, function(err, user) {
        if (user == null) {
          if (pwd == retypedPwd) {
            var usr = {email: req.body.email, name: req.body.user, password: pwd} ;
            
            users.save(usr, null, function(err, result) {           
              users.findOne(usr, function(err, user) {
                utils.helpers.storeUserInSessionAndRedirect(req, res, user) ;
                db.close();

                sendEmail(user, getRegisterEmailContent(user)) ;
              }) ;
            }) ;
          }
          else {
            db.close() ;
            res.render('register', {id: req.query.id, email: req.query.email, user: req.body.user, error:"Hasła nie pasują !"});
          }
        }
        else {
          db.close() ;
          res.render('register', {id: req.query.id, email: req.query.email, user: req.body.user, user_error:"Użytkownik o tej nazwie już istnieje !"});      
        }
      });
    }) ;
  }
}) ;

app.get('/logoff', function(req, res){
  req.session.destroy();
  res.redirect('/');
}) ;

app.post('/login', function(req, res) {
  console.log('login user, request: ', JSON.stringify(req.params));

  if (req.body.user.length == 0 || req.body.pwd.length == 0) {
    res.render('login', {error: "Niepoprawny użytkownik lub hasło !"}); 
  }
  else {
    var mongoUrl = environment.config.db();
    var pwd = utils.security.hashValue(req.body.pwd) ;

    MongoClient.connect(mongoUrl, function(err, db) {
      db.collection('users').findOne({name: req.body.user, password: pwd}, function(err, user) {
          
          utils.helpers.storeUserInSessionAndRedirect(req, res, user) ;
          
          db.close();
        });
    }) ;
  }
}) ;

app.get('/account', authorize, function(req, res) {
 
  MongoClient.connect(environment.config.db(), function(err, db) {
    var users = db.collection('users') ;
    users.findOne({_id: mongodb.ObjectID(req.session.userid)}, function(err, user) {
      if (user !== null) {
         var usr = {name: user.name, email: user.email, error: null} ;
         console.log("Account, user: " + JSON.stringify(usr)) ;
         res.render('account', usr) ;
       }
       db.close();
    });
  });
}) ;

app.post('/account', authorize, function(req, res) {
  console.log("POST, Account: " + JSON.stringify(req.body)) ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    var users = db.collection('users') ;
    users.findOne({_id: mongodb.ObjectID(req.session.userid)}, function(err, user) {
      
      if (user !== null) {
        user.email = req.body.email ;

        users.save(user, null, function(err, result) {           
          users.findOne(user, function(err, user) {
            utils.helpers.storeUserInSessionAndRedirect(req, res, user) ;
            db.close();

            sendEmail(user, getAccountChangedEmailContent(user)) ;
          }) ;
        }) ;
      }
      else
      {
        db.close();
      }
    });
  });
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
      item.timestamp = moment().valueOf() ;
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
      item.timestamp = moment().valueOf() ;
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

function getEmailSignature()
{
  var signature = "";
  signature += "Cheers, <br/>";
  signature += "2do Team" ;
  return signature ;
}

function getPreRegisterEmailContent(request)
{
  var subject = '2do service - verification step';

  var body = "" ;

  body += "Hi !"
  body += "<br/>";
  body += "<br/>";
  body += "This is 2do service verification email.";
  body += "<br/>";
  body += "<br/>";
  body += "Please click this link to contiunue registeration <a href='http://todo-micstach.rhcloud.com/register?id=" + request._id + "&email=" + request.email + "'>http://todo-micstach.rhcloud.com/register?id=" + request._id + "&email=" + request.email + "</a>" ;
  body += "<br/>";
  body += "<br/>";
  body += getEmailSignature() ;

  return {subject: subject, body: body} ;
}

function getRegisterEmailContent(user)
{
  var subject = '2do service - welcome!';

  var body = "" ;

  body += "Hi " + user.name + "!" ;
  body += "<br/>";
  body += "<br/>";
  body += "Please login at <a href='http://todo-micstach.rhcloud.com/login'>http://todo-micstach.rhcloud.com/login</a> and start working !" ;
  body += "<br/>";
  body += "<br/>";
  body += "Download desktop application or find more details at <a href='http://todo-micstach.rhcloud.com'>http://todo-micstach.rhcloud.com</a>" ;
  body += "<br/>";
  body += "<br/>";
  body += getEmailSignature() ;

  return {subject: subject, body: body} ;
}

function getAccountChangedEmailContent(user)
{
  var subject = '2do service - account changed';

  var body = "" ;

  body += "Hi " + user.name + "!" ;
  body += "<br/>";
  body += "<br/>";
  body += "Your 2do account email has been changed."
  body += "<br/>";
  body += "<br/>";
  body += "Please login at <a href='http://todo-micstach.rhcloud.com/login'>http://todo-micstach.rhcloud.com/login</a> and start working !" ;
  body += "<br/>";
  body += "<br/>";
  body += "Download desktop application or find more details at <a href='http://todo-micstach.rhcloud.com'>http://todo-micstach.rhcloud.com</a>" ;
  body += "<br/>";
  body += "<br/>";
  body += getEmailSignature() ;
  
  return {subject: subject, body: body} ;
}

function sendEmail(user, emailContent) {
  //if (process.env.LOCAL_NODEJS_IP !== undefined) {
    
    console.log(JSON.stringify(user)) ;

    var transporter = nodemailer.createTransport('smtps://todo.noreply%40poczta.onet.pl:Stasiek1@smtp.poczta.onet.pl') ;

    var mailOptions = {
        from: 'todo.noreply@poczta.onet.pl', // sender address
        to: user.email, // list of receivers
        subject: emailContent.subject, // Subject line
        html: emailContent.body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
  //}
}

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
