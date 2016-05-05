angular.module('Index', ['ngAnimate', 'ui.bootstrap']) ;

angular.module('Index').config(['$httpProvider', function($httpProvider) {

    if (!$httpProvider.defaults.headers.get) {
        $httpProvider.defaults.headers.get = {};    
    }    
 	
    //disable IE ajax request caching
    $httpProvider.defaults.headers.get['If-Modified-Since'] = 'Mon, 26 Jul 1997 05:00:00 GMT';
    // extra
    $httpProvider.defaults.headers.get['Cache-Control'] = 'no-cache';
    $httpProvider.defaults.headers.get['Pragma'] = 'no-cache';
}]);

angular.module('Index').controller('Project', function($window, $scope, $timeout, $http, $location, $uibModal, $sce) {

	$scope.userName = ""

	$scope.user = {
		name: "",
		role: "read-only"
	} ;

	$scope.project = {
		name: "",
		_id: "",
		users: []
	};

	$scope.isOwnerView = function() {
		return $scope.project.users.filter(function(user){return user.name === $scope.userName && user.role === "owner"}).length > 0 ;
	}

	$scope.isOwner = function(user) {
		return $scope.project.users.filter(function(u){return u.name === user.name && user.role === "owner"}).length == 1 ;
	}

	$scope.isOnlyOneOwner = function() {
		return $scope.project.users.filter(function(user){return user.role === "owner"}).length == 1 ;
	}

	$scope.setUserRole = function(user, role)
	{
		user.role = role ;

		if (user !== $scope.user) {
		 	$http.put('/api/project/' + $scope.project._id + '/user', user).success(function() {});   
		}
	}

	$scope.refresh = function()
	{
    	$http.get('/api/project/' + $scope.project._id).success(function(data) { 
			$scope.project = data
		})
	}

	$scope.deleteProject = function()
	{
	    $http.delete('/api/project/' + $scope.project._id).success(function() {
	    	window.location = '/home' ;
	    });
	}

	$scope.projectChanged = function()
	{
		$http.put('/api/project/' + $scope.project._id, {projectName: $scope.project.name}).success(function() {
	    	$scope.project.currentName = $scope.project.name 
		});   
	}

	$scope.userAdd = function(user)
	{
		var projectId = $scope.project._id ;

		$http.post('/api/project/' + projectId + '/user', user).success(function() {
	    	$scope.refresh(); 
	    	$scope.user.name = ""
		});   
	}

	$scope.userRemove = function(user)
	{
		var projectId = $scope.project._id ;

		$http.delete('/api/project/' + projectId + '/user/' + user.name).success(function() {
	    	$scope.refresh(); 
		});   
	}

	$scope.initalize = function()
	{
	    $http.get('/api/user')
	      .success(function(user) { 
	        
	        $scope.userName = user.name ;
	
			var url = new URL($location.absUrl()) ;
			var projectId = url.pathname.split('/').pop() ;
			$http.get('/api/project/' + projectId).success(function(data) { 
				$scope.project = data
				
				// add view fields				
				$scope.project.currentName = $scope.project.name
			})

	      })
	      .error(function(user, status) {
	        window.location = '/login' ;
	      }) ;
	}

	$scope.initalize() ;
});
