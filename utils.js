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
	storeUserInSessionAndRedirect: function(req, res, user) {
    console.log("User settings: %s", JSON.stringify(user));

	  if (user !== null) {
	    req.session.userid = user._id ;
	    console.log("storeUserInSessionAndRedirect, session: " + JSON.stringify(req.session)) ;
      console.log("storeUserInSessionAndRedirect, params: " + JSON.stringify(req.query)) ;

      if (req.query.path !== undefined)
  	    res.redirect(req.query.path);
      else
        res.redirect('/home')
	  }
	  else {
	    req.session.destroy();
	    res.render('login', {error: "Niepoprawny użytkownik lub hasło !"}); 
	  }		
	}
}
