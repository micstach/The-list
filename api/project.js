var mongodb = require('mongodb')
var mongoClient = mongodb.MongoClient ; 
var environment = require('../environment.js') ;

function getOwners(users) {
  return users.filter(function(user) { return user.role.toLowerCase() === "owner" }) ; 
}
function getProjectOwners(project) {
  return getOwners(project.users) ;
}

function isUserAProjectOwner(project, userName) {
  var owners = getProjectOwners(project)
  return owners.filter(function(owner) { return owner.name.toLowerCase() === userName.toLowerCase()}).length > 0 ;
}

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

	  mongoClient.connect(environment.config.db(), function(err, db){
      db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, project){

        var currentOwners = getProjectOwners(project) ;
        var sessionUserIsOwner = isUserAProjectOwner(project, req.session.username) ;

        if (sessionUserIsOwner) {
          project.name = req.body.projectName ;
          db.collection('projects').save(project);
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
	read: function(req, res) {
	  mongoClient.connect(environment.config.db(), function(err, db) {
	    db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, project) {
	      db.close() ;
	      res.writeHead(200, {'Content-Type': 'application/json'});
	      res.end(JSON.stringify(project));
	    }) ;
	  }) ;
	},
  userDelete: function(req, res) {
    mongoClient.connect(environment.config.db(), function(err, db) {
      db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, project) {
        
        if (isUserAProjectOwner(project, req.session.username))
        {
          var projectUsers = project.users.filter(function(user) { return user.name.toLowerCase() !== req.params.userName.toLowerCase()}) 

          if (getOwners(projectUsers).length > 0)
          {
            project.users = projectUsers
            db.collection('projects').save(project) ;
          }
          else
          {
            console.log('There is only owner, cannot remove user: ' + req.params.userName) ;
          }
          db.close() ;
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(project));
        }
        else
        {
          res.sendStatus(401);
        }
      }) ;
    }) ;
  },
  userUpdate: function(req, res){
    mongoClient.connect(environment.config.db(), function(err, db) {
      db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, project) {
        
        if (isUserAProjectOwner(project, req.session.username))
        {
          // modify user
          project.users.forEach(function(user){
            if (user.name.toLowerCase() == req.body.name.toLowerCase()) {
              user.role = req.body.role.toLowerCase() ;
            }
          })

          db.collection('projects').save(project) ;
          db.close() ;
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(project));
        }
        else
        {
          res.sendStatus(401);
        }
      }) ;
    }) ;
  },
  userAdd: function(req, res) {
    console.log("User add, request body: " + JSON.stringify(req.body)) ;

    mongoClient.connect(environment.config.db(), function(err, db) {
      db.collection('projects').findOne({_id: mongodb.ObjectID(req.params.id)}, function(err, project) {
        
        if (isUserAProjectOwner(project, req.session.username)) {

          var nameFound = false ;
          db.collection('users').findOne({name: req.body.name}, function(err, user) {
  
            if (user !== null) {  
              var userPresent = project.users.filter(function(user) { return user.name.toLowerCase() === req.body.name.toLowerCase()}).length > 0;

              if (!userPresent) {
                project.users.push(req.body) ;
                db.collection('projects').save(project) ;
              }
              else {
                console.log('User ' + req.body.name + ' already added')
              }
        
              db.close() ;
              res.writeHead(200, {'Content-Type': 'application/json'});
              res.end(JSON.stringify(project));

              nameFound = true
            }
          }) ;

          var emailFound = false ;

          db.collection('users').find({email: req.body.name}).toArray(function(err, results) {

            results.forEach(function(user) {
              if (user !== null) {  
                var userPresent = project.users.filter(function(pj) { return pj.name.toLowerCase() === user.name.toLowerCase()}).length > 0;

                if (!userPresent) {
                  project.users.push({name: user.name, role: req.body.role}) ;
                  db.collection('projects').save(project) ;
                }
                else {
                  console.log('User ' + req.body.name + ' already added')
                }
              }
            })
          
            if (results.length > 0) {
              res.writeHead(200, {'Content-Type': 'application/json'});
              res.end(JSON.stringify(project));
              emailFound = true
            }
            db.close() ;
  
            if (emailFound === false && nameFound === false) {
              console.log("User " + req.body.name + " found !")
              res.sendStatus(404);
            }            
          })
        }  
        else
        {
          console.log('User ' + req.session.username + ' is not an owner of the project') ;
          res.sendStatus(401);
          db.close();
        }
      }) ;
    }) ;
  }
}