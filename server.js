var express = require('express') ;
var session = require('express-session') ;
var cookieParser = require('cookie-parser') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;
var moment = require('moment');
var nodemailer = require('nodemailer') ;
var locale = require("locale") ;
var supportedLanguages = ["en-US", "pl-PL"] ;
var languages = {
  "en-US": "English (United States)",
  "pl-PL": "Polski"
} ;
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
  saveUninitialized: true,
  HttpOnly: true
}));

var redirectSec = function(req, res, next) {
  if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
    if (req.headers['x-forwarded-proto'] == 'http') {
      var safeUrl = 'https://' + req.headers.host + req.path ;

      if (req.query.length > 0)
        safeUrl += '?' + req.query ;

      res.redirect(safeUrl);
    } else {
        return next();
    }
  }
  else
  {
    return next();
  }
}

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

app.use(locale(supportedLanguages)) ;

app.get('/', redirectSec, function(req, res) { 
    
  var locale = req.locale ;  
  if (req.cookies['locale'] === undefined) {
    res.cookie('locale', locale) ;
  }
  else {
    locale = req.cookies['locale'] ;
  }

  if (req.session.userid === undefined) {

    console.log("launguage: " + locale + ", " + req.locale) ;

    var downloadLink = null ;
    var systemDetected = null ;

    if (req.headers['user-agent'].indexOf('Windows') !== -1) {
      downloadLink = '/clients/windows/2do.zip';
      systemDetected = "Windows";
    }
    else if (req.headers['user-agent'].indexOf('Android') !== -1) {
      downloadLink = '/clients/android/2do.apk';
      systemDetected = "Android";
    } 
    else if (req.headers['user-agent'].indexOf('Mac OS X') !== -1) {
      downloadLink = '/clients/osx/2do.app.zip';
      systemDetected = "Mac OS X";
    }
    
    var resourcePath = './private/landing.' + locale + '.js' ;
    console.log('Resource path: ' + resourcePath) ;
    res.render('landing', {language: languages[locale], resources: require(resourcePath).resources, downloadLink:downloadLink, systemDetected: systemDetected}) ;
  }
  else {
    res.redirect('/home') ;
  }
});

app.post('/locale/:locale', function(req, res){
  console.log("POST: /locale/" + req.params.locale) ;
  res.cookie('locale', req.params.locale).send();
}) ;

app.get('/home', authorize, function(req, res) {

  var locale = req.locale ;  
  if (req.cookies['locale'] === undefined) {
    res.cookie('locale', locale) ;
  }
  else {
    locale = req.cookies['locale'] ;
  }

  var desktopClient = (req.headers['user-agent'] === 'desktop client') ;

  var parameters = {
    resources: require('./private/home.' + locale + '.js').resources,
    desktopClient: desktopClient
  }

  console.log("ui: user %s", req.session.userid) ;
  console.log("ui: user-agent: " + req.headers['user-agent']);

  console.log("desktopClient: " + desktopClient);

  var mongoUrl = environment.config.db();  
  var userid = req.session.userid ;

  MongoClient.connect(mongoUrl, function(err, db) {
    db.collection('users').findOne({_id: mongodb.ObjectID(userid)}, function(err, user){
      parameters.username = user.name;
      parameters.userid = user.userid;
      
      res.render('home', parameters) ;
      db.close();
    }) ;
  });
});

app.get('/login', redirectSec, function(req, res, next) {
 
  var locale = req.locale ;  
  if (req.cookies['locale'] === undefined) {
    res.cookie('locale', locale) ;
  }
  else {
    locale = req.cookies['locale'] ;
  }

  if (req.session.userid !== undefined) {
    if (req.query.user !== undefined) {
      if (req.query.user === req.session.username) {
        res.redirect('/home') ;
        return ;
      }
      else {
        req.session.destroy();
      }
    }
    else
    {
      res.redirect('/home') ;
      return ;
    }
  }

  console.log("Login request parameters: " + JSON.stringify(req.query));
  console.log("Locale: " + locale) ;

  var parameters = {
    error: null,
    user: req.query.user,
    path: req.query.path,
    resources: require('./private/login.' + locale + '.js').resources,
    language: languages[locale]
  } ;

  res.render('login', parameters) ;
  
}) ;

app.post('/login', redirectSec, function(req, res) {
  console.log('login user, request: ', JSON.stringify(req.params));
  
  var resources = require('./private/login.' + req.locale + '.js').resources ;
  
  var locale = req.locale ;  
  if (req.cookies['locale'] === undefined) {
    res.cookie('locale', locale) ;
  }
  else {
    locale = req.cookies['locale'] ;
  }

  var errorParameters = {
    error: resources.errorInvalidUserOrPassword,
    user: req.body.user,
    path: req.query.path,
    resources: resources,
    language: languages[locale]
  } ;

  if (req.body.user.length == 0 || req.body.pwd.length == 0) {
    res.render('login', errorParameters); 
  }
  else {
    var mongoUrl = environment.config.db();
    var pwd = utils.security.hashValue(req.body.pwd) ;

    MongoClient.connect(mongoUrl, function(err, db) {
      db.collection('users').findOne({name: req.body.user, password: pwd}, function(err, user) {
          
          utils.helpers.storeUserInSessionAndRedirect(req, res, user, errorParameters) ;
          
          db.close();
        });
    }) ;
  }
}) ;

app.get('/register', redirectSec, function(req, res) {

  var locale = req.locale ;  
  if (req.cookies['locale'] === undefined) {
    res.cookie('locale', locale) ;
  }
  else {
    locale = req.cookies['locale'] ;
  }

  console.log("Locale: " + locale) ;

  var parameters = {
    user: null, 
    error: null,
    language: languages[locale],
    resources: require('./private/register.' + locale + '.js').resources
  };

  if (req.query.id !== undefined) {
    var mongoUrl = environment.config.db() ;  
    MongoClient.connect(mongoUrl, function(err, db) {
      var registerRequest = db.collection('registerRequest') ;

      try
      {
        var id = mongodb.ObjectID(req.query.id);
        
        registerRequest.findOne({_id: id}, function(err, request) {
          console.log("Registration request: " + JSON.stringify(request)) ;
          if (request !== null) {
            db.close();
            parameters.id = req.query.id ;
            parameters.email = request.email ;
            res.render('register', parameters);
          }
          else
          {
            parameters.invalidRequestId = true ;
            res.render('register', parameters);
          }
        });
      }
      catch (ex)
      {
        console.log("Register exception");
        parameters.invalidRequestId = true ;
        res.render('register', parameters);               
      }
    });
  }
  else {
    res.render('register', parameters) ;
  }
 
}) ;

app.post('/register', redirectSec, function(req, res) {
  console.log('Register api'); 
  
  var locale = req.locale ;  
  if (req.cookies['locale'] === undefined) {
    res.cookie('locale', locale) ;
  }
  else {
    locale = req.cookies['locale'] ;
  }

  var resources = require('./private/register.' + locale + '.js').resources ;

  var parameters = {
    language: languages[locale],
    resources: resources
  }

  if (req.query.id === undefined)
  {
    if (utils.helpers.validateEmail(req.body.email))
    {
      var mongoUrl = environment.config.db() ;  
      MongoClient.connect(mongoUrl, function(err, db) {
        var registerRequest = db.collection('registerRequest') ;

        registerRequest.findOne({email: req.body.email}, function(err, request) {
          if (request === null) {
            var newRequest = {email: req.body.email} ;
            
            registerRequest.save(newRequest, null, function(err, result) {           
              registerRequest.findOne(newRequest, function(err, request) {
                db.close();

                sendEmail(request, getPreRegisterEmailContent(request), null, null);

                parameters.verificationSent = 'true' ;
                parameters.email = request.email ;

                res.render('register', parameters);
              }) ;
            }) ;
          }
          else {
            db.close() ;
            
            console.log('Registeration request already defined, id: ' + request._id);

            parameters.verificationSent = 'true' ;
            parameters.email = request.email ;

            res.render('register', parameters);
          }
        });
      });
    }
    else
    {
      console.log("Invalid email address") ;
     
      parameters.verificationSent = 'false';
      parameters.email = req.body.email ;
      res.render('register', parameters);
    }
  }
  else 
  {
    console.log("Registration confirmation") ;

    if (req.body.user.length == 0) {
      parameters.id = req.query.id ;
      parameters.email = req.body.email ;
      parameters.user = req.body.user ;
      parameters.user_error = resources.errorInvalidUserName
  
      res.render('register', parameters);      
    }
    else
    {
      var pwd = utils.security.hashValue(req.body.pwd) ;
      var retypedPwd = utils.security.hashValue(req.body['re-pwd']) ;
      
      if (req.body.pwd.length === 0)
      {
        parameters.id = req.query.id ;
        parameters.email = req.body.email ;
        parameters.user = req.body.user ;
        parameters.user_error = resources.errorPasswordNotSet ;         

        res.render('register', parameters);
      }
      else if (pwd !== retypedPwd) {
        parameters.id = req.query.id ;
        parameters.email = req.body.email ;
        parameters.user = req.body.user ;
        parameters.user_error = resources.errorPasswordsDoesNotMatch ;      

        res.render('register', parameters);
      }
      else
      {
        var mongoUrl = environment.config.db() ;  
        
        // register if not exists
        MongoClient.connect(mongoUrl, function(err, db) {

          var users = db.collection('users') ;

          users.findOne({name: req.body.user, email: req.body.email}, function(err, user) {
            if (user === null) {
              db.collection('registerRequest').remove({_id: mongodb.ObjectID(req.query.id)}) ;
              var usr = {email: req.body.email, name: req.body.user, password: pwd} ;
              
              users.save(usr, null, function(err, result) {           
                users.findOne(usr, function(err, user) {
                  utils.helpers.storeUserInSessionAndRedirect(req, res, user, resources) ;
                  db.close();

                  sendEmail(user, getRegisterEmailContent(user), null, null);
                }) ;
              }) ;
            }
            else {
              db.close() ;
              parameters.id = req.query.id;
              parameters.email = req.body.email;
              parameters.user = req.body.user;
              parameters.user_error = resources.errorUserNameExists;

              res.render('register', parameters);      
            }
          });
        }) ;
      }
    }
  }
}) ;

app.get('/logoff', function(req, res){
  req.session.destroy();
  res.redirect('/');
}) ;

app.get('/account', authorize, function(req, res) {
 
  var locale = req.locale ;  
  if (req.cookies['locale'] === undefined) {
    res.cookie('locale', locale) ;
  }
  else {
    locale = req.cookies['locale'] ;
  }

  MongoClient.connect(environment.config.db(), function(err, db) {
    var users = db.collection('users') ;
    users.findOne({_id: mongodb.ObjectID(req.session.userid)}, function(err, user) {
      if (user !== null) {

        var parameters = {
          resources: require('./private/account.' + locale + '.js').resources,
          language: languages[locale], 
          user: {
            name: user.name, 
            email: user.email
          }, 
          error: null
        } ;
        
        console.log("Account, user: " + JSON.stringify(parameters)) ;
        res.render('account', parameters) ;
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
      
      if (user !== null)
      {
        if (user.email !== req.body.email) {
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
          res.redirect('/home') ;
        }
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
      // item.timestamp = moment().valueOf() ;
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
    var query = {owner: userid} ;

    db.collection('notes').remove(query) ;
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

function getEmailSignature()
{
  var signature = "";
  signature += "Cheers, <br/>";
  signature += "2do Team" ;
  return signature ;
}

function getPreRegisterEmailContent(request)
{
  var hostName = "https://todo-micstach.rhcloud.com";
  
  if (process.env.LOCAL_NODEJS_IP !== undefined)
    hostName = "http://" + environment.config.ip() ;

  var subject = '2do service - invitation!';

  var body = "" ;

  body += "Hi !"
  body += "<br/>";
  body += "<br/>";
  body += "This is 2do's service invitation email.";
  body += "<br/>";
  body += "<br/>";
  body += "Please click this private link to continue registeration <a href='"+ hostName + "/register?id=" + request._id + "'>"+ hostName + "/register?id=" + request._id + "</a>" ;
  body += "<br/>";
  body += "<br/>";
  body += getEmailSignature() ;

  return {subject: subject, body: body} ;
}

function getRegisterEmailContent(user)
{
  var hostName = "https://todo-micstach.rhcloud.com";
  
  if (process.env.LOCAL_NODEJS_IP !== undefined)
    hostName = "http://" + environment.config.ip() ;

  var subject = '2do service - welcome!';

  var body = "" ;

  body += "Hi " + user.name + "!" ;
  body += "<br/>";
  body += "<br/>";
  body += "Please login at <a href='"+ hostName + "/login?user=" + user.name + "'>"+ hostName + "/login?user=" + user.name + "'</a> and start working !" ;
  body += "<br/>";
  body += "<br/>";
  body += "Download desktop application or find more details at <a href='"+ hostName + "'>"+ hostName + "</a>" ;
  body += "<br/>";
  body += "<br/>";
  body += getEmailSignature() ;

  return {subject: subject, body: body} ;
}

function getAccountChangedEmailContent(user)
{
  var hostName = "https://todo-micstach.rhcloud.com";
  
  if (process.env.LOCAL_NODEJS_IP !== undefined)
    hostName = "http://" + environment.config.ip() ;

  var subject = '2do service - account changed';

  var body = "" ;

  body += "Hi " + user.name + "!" ;
  body += "<br/>";
  body += "<br/>";
  body += "Your 2do account email has been changed."
  body += "<br/>";
  body += "<br/>";
  body += "Please login at <a href='"+ hostName + "/login?user=" + user.name + "'>"+ hostName + "/login?user=" + user.name + "'</a> and start working !" ;
  body += "<br/>";
  body += "<br/>";
  body += "Download desktop application or find more details at <a href='"+ hostName + "'>"+ hostName + "</a>" ;
  body += "<br/>";
  body += "<br/>";
  body += getEmailSignature() ;
  
  return {subject: subject, body: body} ;
}

function sendEmail(user, emailContent, onOk, onError) {
  console.log(JSON.stringify(user)) ;

  var transporter = nodemailer.createTransport('smtps://todo.noreply%40poczta.onet.pl:Stasiek1@smtp.poczta.onet.pl') ;

  var mailOptions = {
      from: 'todo.noreply@poczta.onet.pl', 
      to: user.email, 
      subject: emailContent.subject, 
      html: emailContent.body
  };

  transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        if (onError !== undefined && onError !== null)
          onError() ;

        return console.log("Sending error: " + error);
      }
      else {
        console.log('Message sent: ' + info.response);
        
        if (onOk !== undefined && onOk !== null)
          onOk() ;
      }
  });
}

// app.post('/api/reset', function(req, res){
//   var response = {
//     email: req.query.email
//   };

//   if (process.env.LOCAL_NODEJS_IP !== undefined) {
//     var transporter = nodemailer.createTransport('smtps://todo.noreply%40poczta.onet.pl:Stasiek1@smtp.poczta.onet.pl') ;

//     // setup e-mail data with unicode symbols
//     var mailOptions = {
//         from: 'todo.noreply@jamajka.com', // sender address
//         to: req.query.email, // list of receivers
//         subject: 'Hello !', // Subject line
//         text: 'Hello world !', // plaintext body
//         html: '<b>Hello world !</b>' // html body
//     };

//     // send mail with defined transport object
//     transporter.sendMail(mailOptions, function(error, info){
//         if(error){
//             return console.log(error);
//         }
//         console.log('Message sent: ' + info.response);
        
//         response.info = info.response ;
//         res.writeHead(200, {'Content-Type': 'application/json'});
//         res.end(JSON.stringify(response));
//     });
//   }
//   else {
//     response.info = "unavailable" ;
//     res.writeHead(200, {'Content-Type': 'application/json'});
//     res.end(JSON.stringify(response));
//   }
// }) ;

// app.get('*', function(req, res){
//   res.redirect('/');
// });

app.listen(environment.config.port(), environment.config.ip(), function(){
  console.log('2do server started: %s:%s', environment.config.ip(), environment.config.port()) ;
}) ;
