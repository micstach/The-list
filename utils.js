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
	storeUserInSession: function(req, res, user) {
    console.log("User settings: %s", JSON.stringify(user));

	  if (user !== null) {
	    req.session.userid = user._id ;
	    console.log(JSON.stringify(req.session)) ;
	    res.redirect('/home');
	  }
	  else {
	    req.session.destroy();
	    res.render('login', {error: "Niepoprawny użytkownik lub hasło !"}); 
	  }		
	}
}
