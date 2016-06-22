var express = require('express') ;
var session = require('express-session') ;
var cookieParser = require('cookie-parser') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;
var moment = require('moment');
var nodemailer = require('nodemailer') ;
var locale = require("locale") ;
var request = require("request") ;

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

var http2https = function(req, res, next) {
  if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
    if (req.headers['x-forwarded-proto'] == 'http') {
      var safeUrl = 'https://' + req.headers.host + req.path ;

      if (req.query.length > 0)
        safeUrl += '?' + req.query ;

      res.redirect(safeUrl);

      // upgrade protocol function
      environment.config.protocol = function() { 
        return 'https';
      };

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
    return next() ;
  else
  {
    console.log('Unauthorized access: ' + req.url + ', please login!') ;

    return res.redirect('/login?path=' + req.url);
  }
};

app.use(locale(supportedLanguages)) ;
app.use(http2https);

app.get('/', function(req, res) { 
    
  var locale = utils.helpers.getLocale(req, res) ;

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

  var locale = utils.helpers.getLocale(req, res) ;

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

app.get('/login/github', function(req, res){
  var url = 'https://github.com/login/oauth/authorize';
  url += '?client_id=17da81822abb58babb72';
  var host = 'todo-micstach.rhcloud.com' ;
  //var host = environment.config.ip();
  var redirect_uri = 'https://' + host + '/auth/github/callback';
  url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
  res.redirect(url);
});

app.get('/auth/github/callback', function(req, res) {
  console.log('get: callback');

  request.post(
    'https://github.com/login/oauth/access_token',
    { 
      form: { 
        client_id: '17da81822abb58babb72',
        client_secret: '1fd316d8dfa147d6a487e3ac30157ca594b12a96',
        code: req.query.code
      } 
    },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
          
        var parameters = body.split('&');
        var values = {} ;
        for (var i=0; i<parameters.length; i++) {
          var keyValues = parameters[i].split('=');
          values[keyValues[0]]=keyValues[1];
        }

        var access_token = values['access_token'];

        request.get({
          url: 'https://api.github.com/user?access_token=' + access_token,
          headers: {
            'User-Agent': '2do-server'
            }
          },
          function(error, response, body) {
            console.log(body);
            var githubUser = JSON.parse(body);
	          
            var mongoUrl = environment.config.db() ;  
            var locale = utils.helpers.getLocale(req, res) ;
            var resources = require('./private/register.' + locale + '.js').resources ;

            // register if not exists
            MongoClient.connect(mongoUrl, function(err, db) {

              var users = db.collection('users') ;
              var projects = db.collection('projects') ;

              users.findOne({name: githubUser.name, email: githubUser.email}, function(err, user) {
                if (user === null) {
                
                  var defaultProject = {
                    name: resources.defaultProjectName,
                    users: [
                      { name: githubUser.name, role: "owner"}
                    ]
                  }

                  projects.insert(defaultProject, function(err, result) {
                    var project = result.ops[0] ;

                    console.log('Project created: ' + JSON.stringify(project)) ;

                    var newUser = {
                      email: githubUser.email, 
                      name: githubUser.name, 
                      password: '',
                      configuration: {
                        project_id: project._id,
                        tags:[]
                      }
                    } ;

                    users.insert(newUser, function(err, result) {           
                      var user = result.ops[0];

                      console.log('User created: ' + JSON.stringify(user)) 

                      utils.helpers.storeUserInSessionAndRedirect(req, res, user, resources) ;
                      
                      // sendEmail(user, getRegisterEmailContent(user), null, null);
                    }) ;
                  }) ;
                } else {
                  req.session.userid = user._id ;
                  req.session.project_id = user.configuration.project_id ;
                  req.session.username = user.name ;

                  res.redirect('/home');
                }
              });
            });
          }
        );
      } else {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({queryCode: req.query.code, error: error}));
        res.send();
      }
    }
  );  
});

app.get('/login/facebook', function(req, res){
  var url = 'https://www.facebook.com/dialog/oauth';
  url += '?client_id=1689283628023344';
  var host = environment.config.host();
  var redirect_uri = 'http://' + host + '/auth/facebook/callback';
  url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
  res.redirect(url);
});

app.get('/auth/facebook/callback', function(req, res) {
  console.log('get: callback');

  var host = environment.config.ip();
  var redirect_uri = 'http://' + host + '/auth/facebook/callback';
  //url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
  console.log('redirect_uri: ' + redirect_uri);

  var url = 'https://graph.facebook.com/v2.3/oauth/access_token' ;
  url += '?client_id=1689283628023344';
  url += '&client_secret=0fa323261a660265fa447f3cd67d90fe';
  url += '&code=' + req.query.code;
  url += '&redirect_uri=' + encodeURIComponent(redirect_uri);

  request.get(url, function (error, response, body) {
      console.log('token request:' + body);

      if (!error && response.statusCode == 200) {
          
        var parameters = body.split('&');
        var values = {} ;
        for (var i=0; i<parameters.length; i++) {
          var keyValues = parameters[i].split('=');
          values[keyValues[0]]=keyValues[1];
        }

        var access_token = values['access_token'];

        request.get({
          url: 'https://graph.facebook.com/v2.5/me?access_token=' + access_token,
          headers: {
            'User-Agent': '2do-server'
            }
          },
          function(error, response, body) {
            console.log('facebook user api:' + body);

            if (!error && response.statusCode == 200) {
              console.log(body);
              var githubUser = JSON.parse(body);
              
              var mongoUrl = environment.config.db() ;  
              var locale = utils.helpers.getLocale(req, res) ;
              var resources = require('./private/register.' + locale + '.js').resources ;

              // register if not exists
              MongoClient.connect(mongoUrl, function(err, db) {

                var users = db.collection('users') ;
                var projects = db.collection('projects') ;

                users.findOne({name: githubUser.name, email: githubUser.email}, function(err, user) {
                  if (user === null) {
                  
                    var defaultProject = {
                      name: resources.defaultProjectName,
                      users: [
                        { name: githubUser.name, role: "owner"}
                      ]
                    }

                    projects.insert(defaultProject, function(err, result) {
                      var project = result.ops[0] ;

                      console.log('Project created: ' + JSON.stringify(project)) ;

                      var newUser = {
                        email: githubUser.email, 
                        name: githubUser.name, 
                        password: '',
                        configuration: {
                          project_id: project._id,
                          tags:[]
                        }
                      } ;

                      users.insert(newUser, function(err, result) {           
                        var user = result.ops[0];

                        console.log('User created: ' + JSON.stringify(user)) 

                        utils.helpers.storeUserInSessionAndRedirect(req, res, user, resources) ;
                        
                        // sendEmail(user, getRegisterEmailContent(user), null, null);
                      }) ;
                    }) ;
                  } else {
                    req.session.userid = user._id ;
                    req.session.project_id = user.configuration.project_id ;
                    req.session.username = user.name ;

                    res.redirect('/home');
                  }
                });
              });
            } else {
              res.writeHead(200, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({body: body, error: error}));
              res.send();
            }
          }
        );
      } else {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({queryCode: req.query.code, error: error}));
        res.send();
      }
    }
  );  
});

app.get('/login', function(req, res, next) {
 
  var locale = utils.helpers.getLocale(req, res) ;

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

app.post('/login', function(req, res) {
  console.log('login user, request: ', JSON.stringify(req.params));
  
  var resources = require('./private/login.' + req.locale + '.js').resources ;
  
  var locale = utils.helpers.getLocale(req, res) ;

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

app.get('/register', function(req, res) {

  var locale = utils.helpers.getLocale(req, res) ;

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
      var registerationRequest = db.collection('registerationRequest') ;

      try
      {
        var id = mongodb.ObjectID(req.query.id);
        
        registerationRequest.findOne({_id: id}, function(err, request) {
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

app.post('/register', function(req, res) {
  console.log('Register api'); 
  
  var locale = utils.helpers.getLocale(req, res) ;

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
        var registerationRequest = db.collection('registerationRequest') ;

        registerationRequest.findOne({email: req.body.email}, function(err, request) {
          if (request === null) {
            var newRequest = {email: req.body.email} ;
            
            registerationRequest.save(newRequest, null, function(err, result) {           
              registerationRequest.findOne(newRequest, function(err, request) {
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
          var projects = db.collection('projects') ;

          users.findOne({name: req.body.user, email: req.body.email}, function(err, user) {
            if (user === null) {
            
              var defaultProject = {
                name: resources.defaultProjectName,
                users: [
                  { name: req.body.user, role: "owner"}
                ]
              }

              projects.insert(defaultProject, function(err, result) {
                var project = result.ops[0] ;

                console.log('Project created: ' + JSON.stringify(project)) ;

                var newUser = {
                  email: req.body.email, 
                  name: req.body.user, 
                  password: pwd,
                  configuration: {
                    project_id: project._id,
                    tags:[]
                  }
                } ;

                users.insert(newUser, function(err, result) {           
                  var user = result.ops[0];

                  console.log('User created: ' + JSON.stringify(user)) 

                  utils.helpers.storeUserInSessionAndRedirect(req, res, user, resources) ;
                  
                  sendEmail(user, getRegisterEmailContent(user), null, null);

                  db.collection('registerationRequest').remove({_id: mongodb.ObjectID(req.query.id)}) ;
                  //db.close();
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
 
  var locale = utils.helpers.getLocale(req, res) ;

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

app.get('/project/:id', authorize, function(req, res){

  var locale = utils.helpers.getLocale(req, res) ;

  MongoClient.connect(environment.config.db(), 
    function(err, db) {
      db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, 
        function(err, project) {
          var parameters = {
            language: languages[locale],
            project: project,
            resources: require('./private/project.' + locale + '.js').resources
          } ;

          res.render('project', parameters)
        })
    })
})

app.get('/api/notes', authorizeAPI, function(req, res) {
  var userid = req.session.userid;
  var user_name = req.session.username;
  var project_id = req.session.project_id ;

  MongoClient.connect(environment.config.db(), function(err, db) {

      db.collection('projects').find().toArray(function(err, results) {
        
        var projects = [] 
        results.forEach(function(project) {
          if (project.users.filter(function(user) { return user.name == user_name ; }).length == 1) {
            projects.push(project) ;
          }
        }) ;

        db.collection('notes').find().toArray(function(err, results) {
        var notes = [] ;

        results.forEach(function(note){
          var projectsCount = projects.filter(function(project) { return project._id == note.project_id }).length ;

          if (projectsCount == 1) 
            notes.push(note) ;
        }) ;

        // backward compatibility fix
        notes.forEach(function(note){
          if (note.pinned === undefined) {
            note.pinned = false ;
          }
          if (note.checked === undefined) {
            note.checked = false ;
          }
        }) ;

        res.writeHead(200, {'Content-Type': 'application/json'});
        
        res.end(JSON.stringify({
          userid: userid, 
          notes: notes,
          projects: projects
        }));

        db.close();

      }) ;

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
      
      var note = {
        text: req.body.text, 
        checked: false,
        pinned: req.body.pinned,
        user: {
          id: userid, 
          name: req.session.username
        },
        tags: req.body.tags,
        timestamp: moment().valueOf(),
        project_id: req.body.project_id
      } ;

      console.log(JSON.stringify(note)) ;

      db.collection('notes').save(note) ;
      res.writeHead(200);
      res.end();
    }) ;
  }
}) ;

app.delete('/api/note/:id', authorizeAPI, function(req, res){
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

app.put('/api/note/:id/update', authorizeAPI, function(req, res){
  console.log("api: update note: " + req.params.id) ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, note){
      note.text = req.body.text ;
      note.tags = req.body.tags ;
      db.collection('notes').save(note) ;
      res.sendStatus(200); 
    }) ;
  }) ;

}) ;

app.put('/api/note/:id/transfer/:project_id', authorizeAPI, function(req, res){
  console.log("api: update note: " + req.params.id) ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection("projects").findOne({_id: mongodb.ObjectID(req.params.project_id)}, function(err, project) {
      db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, note){
        
        var users = project.users.filter(function(user){return user.name === note.user.name}) ;
        
        var role = (users.length > 0) ? users[0].role : ""
                
        if (role === "owner") {
          note.project_id = req.params.project_id
          db.collection('notes').save(note)
          res.sendStatus(200)
        }
        else {
          res.sendStatus(403)
        }
      })       
    })
  })
}) 

app.delete('/api/notes', authorizeAPI, function(req, res){
  console.log("DELETE /api/notes") ;

  var mongoUrl = environment.config.db() ;  
  var userid = req.session.userid ;

  MongoClient.connect(mongoUrl, function(err, db) {
    var query = {owner: userid} ;

    db.collection('notes').remove(query) ;
    db.close() ;
    res.sendStatus(200);
  }) ;
}) ;

app.put('/api/note/:id/check/:state', authorizeAPI, function(req, res){
  console.log("api: note check: " + JSON.stringify(req.params));
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, item){
      item.checked = (req.params.state === "true") ;
      db.collection('notes').save(item) ;
      res.sendStatus(200); 
    }) ;
  }) ;
});

app.put('/api/note/:id/pin/:state', authorizeAPI, function(req, res){
  console.log("api: note pin: " + JSON.stringify(req.params));
  var userid = req.session.userid ;

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('notes').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, item){
      item.pinned = (req.params.state === "true") ;
      db.collection('notes').save(item) ;
      res.sendStatus(200); 
    }) ;
  }) ;
});

app.get('/api/user', authorizeAPI, function(req, res) {
  console.log("api: get user config");

  MongoClient.connect(environment.config.db(), function(err, db) {
     db.collection('users').findOne({_id: mongodb.ObjectID(req.session.userid)}, function(err, user) {
      console.log("User configuration: " + JSON.stringify(user.configuration)) ;
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        name: req.session.username,
        configuration:user.configuration
      }));
      db.close() ;
    }) ;
  }) ;
}) ;

app.put('/api/user/config', authorizeAPI, function(req, res) {
  console.log("api: put user config: " + JSON.stringify(req.body));

  MongoClient.connect(environment.config.db(), function(err, db) {
    db.collection('users').findOne({_id: mongodb.ObjectID(req.session.userid)}, function(err, user) {
      
      if (req.body.tags !== undefined)
        user.configuration.tags = req.body.tags;

      if (req.body.project_id !== undefined)
        user.configuration.project_id = req.body.project_id ;

      console.log("Saving user: " + JSON.stringify(user));

      db.collection('users').save(user) ;
      //db.close() ;
      res.sendStatus(200); 
    }) ;
  }) ;
}) ;

var project = require('./api/project.js');

app.use(authorizeAPI);
app.post('/api/project', project.api.create)
app.put('/api/project/:id', project.api.update) ;
app.delete('/api/project/:id', project.api.delete)
app.get('/api/project/:id', project.api.read) ;
app.post('/api/project/:id/user', project.api.userAdd) ;
app.put('/api/project/:id/user', project.api.userUpdate) ;
app.delete('/api/project/:id/user/:userName', project.api.userDelete) ;


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

  var subject = '2do service - registeration';

  var body = "" ;

  body += "<a href='/''>";
  body += "<img width='64' height='64' src='" + hostName + "/res/todo_256_no_corners.png'>";
  body += "</a>";
  body += "<br/>";
  body += "<br/>";
  body += "Hi !"
  body += "<br/>";
  body += "<br/>";
  body += "This is 2do's service registeration message.";
  body += "<br/>";
  body += "<br/>";
  body += "Please click this link to continue registeration <a href='"+ hostName + "/register?id=" + request._id + "'>"+ hostName + "/register?id=" + request._id + "</a>" ;
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

  var subject = '2do service - welcome';

  var body = "" ;

  body += "<a href='/''>";
  body += "<img width='64' height='64' src='" + hostName + "/res/todo_256_no_corners.png'>";
  body += "</a>";
  body += "<br/>";
  body += "<br/>";
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

  body += "<a href='/''>";
  body += "<img width='64' height='64' src='" + hostName + "/res/todo_256_no_corners.png'>";
  body += "</a>";
  body += "<br/>";
  body += "<br/>";
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

  var transporter = nodemailer.createTransport('smtps://todo.noreply%40poczta.onet.pl:TodoPassword123@smtp.poczta.onet.pl') ;

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

app.listen(environment.config.port(), environment.config.ip(), function(){
  console.log('2do server started: %s:%s', environment.config.ip(), environment.config.port()) ;
}) ;
