exports.config = {
  
  db: function() 
  {
    var conn = 'mongodb://' ;
    if (process.env.OPENSHIFT_APP_NAME) 
    {
      conn += process.env.OPENSHIFT_MONGODB_DB_USERNAME + ':' + 
              process.env.OPENSHIFT_MONGODB_DB_PASSWORD + '@' + 
              process.env.OPENSHIFT_MONGODB_DB_HOST + ':' + 
              process.env.OPENSHIFT_MONGODB_DB_PORT +'/'+ 
              process.env.OPENSHIFT_APP_NAME ;
    }
    else {
      conn += '127.0.0.1/todo' ;
    }
    return conn ;
  },
  
  port: function() 
  {
    return process.env.OPENSHIFT_NODEJS_PORT || 80;
  },
  
  ip: function() 
  {
    return process.env.OPENSHIFT_NODEJS_IP || process.env.LOCAL_NODEJS_IP || '127.0.0.1';
  }
}