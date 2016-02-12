var express = require('express') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;

var MongoClient = mongodb.MongoClient ;

var dbHost = 'mongodb://127.0.0.1/' ;
var port = 80 ;

var app = express() ;

app.set('views', __dirname + '/public/views');  
app.set('view engine', 'ejs');  
  
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded());  

app.get('/user/:userid', function(req, res) {

  var mongoUrl = dbHost + req.params.userid;  

  MongoClient.connect(mongoUrl, function(err, db) {
    var collection = db.collection('messages').find().toArray(function(err, result){
      console.log(result);
      res.render('index', {username: req.params.userid, userid:req.params.userid, messages:result}) ;
      db.close();
    });
  }) ;
}) ;

app.get('/login', function(req, res) {
  res.render('login') ;
}) ;

app.post('/api/user/:userid/message/:action/:id?', function(req, res){
  console.log("%s message(s)", req.params.action) ;

  var mongoUrl = dbHost + req.params.userid;  

  if (req.params.action == 'add') {
    if (req.body.message.length > 0) {

      MongoClient.connect(mongoUrl, function(err, db) {
        var collection = db.collection('messages') ;
        collection.save({text: req.body.message}) ;
        db.close() ;

        res.redirect('/user/' + req.params.userid);
      }) ;
    }
    else {
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

app.listen(port, function(){
  console.log('Server started, port: %s', port) ;
}) ;
