var crypto = require('crypto') ;

exports.security = {
  hashValue:  function(text)
  {
    const hash = crypto.createHash('sha256');
    hash.update(text) ;
    return hash.digest('hex') ;
  }
}

exports.helpers = {
	storeUserInSessionAndRedirect: function(req, res, user, resources) {
    console.log("User settings: %s", JSON.stringify(user));

	  if (user !== null) {
	    req.session.userid = user._id ;
      req.session.username = user.name ;
	    console.log("storeUserInSessionAndRedirect, session: " + JSON.stringify(req.session)) ;
      console.log("storeUserInSessionAndRedirect, params: " + JSON.stringify(req.query)) ;

      if (req.query.path !== undefined)
  	    res.redirect(req.query.path);
      else
        res.redirect('/home')
	  }
	  else {
	    req.session.destroy();
	    res.render('login', {resources: resources, user: req.body.user, error: resources.errorInvalidUserOrPassword}); 
	  }		
	},
  validateEmail: function(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  }
}

