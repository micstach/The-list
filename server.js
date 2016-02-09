var express = require('express') ;
var mongodb = require('mongodb') ; 
var bodyParser = require('body-parser') ;

var MongoClient = mongodb.MongoClient ;

var mongoUrl = 'mongodb://127.0.0.1/mymongodb' ;  
 
var port = 80 ;

var app = express() ;

app.set('views', __dirname + '/views');  
app.set('view engine', 'ejs');  
  
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded());  

app.get('*', function(req, res) {

	MongoClient.connect(mongoUrl, function(err, db) {
		var collection = db.collection('messages').find().toArray(function(err, result){
			console.log(result);
			res.render('index', {title:'Koledzy Julka', messages:result}) ;
			db.close();
		});
	}) ;
}) ;

app.post('/add', function(req, res){
	console.log("add: " + req.body.message) ;

	MongoClient.connect(mongoUrl, function(err, db){
		var collection = db.collection('messages') ;
		collection.save({text: req.body.message}) ;
		db.close() ;
		res.redirect('/');
	}) ;
}) ;

app.post('/clear', function(req, res){
	console.log("clear") ;

	MongoClient.connect(mongoUrl, function(err, db){
		db.collection('messages').drop() ;
		db.close() ;
		res.redirect('/');
	}) ;
}) ;

app.listen(port, function(){
	console.log('Server started, port: %s', port) ;
}) ;
