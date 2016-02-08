var express = require('express') ;
//var mongoose = require('mongoose') ; 

var port = 80 ;

var app = express() ;

app.set('views', __dirname + '/views');  
app.set('view engine', 'ejs');  

app.get('*', function(req, res){
	res.render('index', {title:'Welcome page'}) ;
}) ;

app.listen(port, function(){
	console.log('Server started, port: %s', port) ;
}) ;
