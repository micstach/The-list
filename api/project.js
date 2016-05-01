var mongodb = require('mongodb')
var mongoClient = mongodb.MongoClient ; 
var environment = require('../environment.js') ;

exports.api = {
	create: function(req, res) {
	  console.log("Create project: " + JSON.stringify(req.body)) ;

	  if (req.body.projectName === undefined) {
	    res.sendStatus(400);
	  }
	  else {
	    mongoClient.connect(environment.config.db(), function(err, db){
	      var project = {
	        name: req.body.projectName,
	        users: [
	          { name: req.session.username, role: "owner"}
	        ]
	      }

	      db.collection('projects').insert(project, function(err, result) {
	        var project = result.ops[0] ;
	        res.writeHead(200, {'Content-Type': 'application/json'});
	        res.end(JSON.stringify(project));
	        db.close() 
	      })
	    })
	  }	
	},
	delete: function(req, res) {
	  mongoClient.connect(environment.config.db(), function(err, db){

	    db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, project){
	      var ownerName = project.users.filter(function(user) { return user.role === "owner"})[0].name ;

	      if (ownerName === req.session.username) {
	        db.collection('projects').remove({_id: mongodb.ObjectID(req.params.id)}) ;
	        db.collection('notes').remove({project_id:mongodb.ObjectID(req.params.id)}) ;
	        db.close() ;
	        res.sendStatus(200);
	      }
	      else {
	        db.close() ;
	        res.sendStatus(401);
	      }
	    })
	  })
	},
	update: function(req, res) {
    var project = req.body ;
    
    console.log(project) ;

	  mongoClient.connect(environment.config.db(), function(err, db){
      var ownerName = project.users.filter(function(user) { return user.role === "owner"})[0].name ;
	    
      console.log("Owner name: " + ownerName) ;

      if (ownerName === req.session.username) {
        project._id = mongodb.ObjectID(project._id) ;
        
        console.log("Updating project")
        db.collection('projects').save(project);
	      db.close() ;
	      res.sendStatus(200);
	    }
	    else {
        console.log("Updating project")
	      db.close() ;
	      res.sendStatus(401);
	    }
	  })
	},
	read: function(req, res) {
	  mongoClient.connect(environment.config.db(), function(err, db) {
	    db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, project) {
	      db.close() ;
	      res.writeHead(200, {'Content-Type': 'application/json'});
	      res.end(JSON.stringify(project));
	    }) ;
	  }) ;
	}
}