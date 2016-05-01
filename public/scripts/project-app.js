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

	$scope.user = {
		name: "",
		role: "read-only"
	} ;

	$scope.project = {
		name: "",
		_id: ""
	};

	$scope.setUserRole = function(role)
	{
		$scope.user.role = role ;
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
		$http.put('/api/project', $scope.project).success(function() {
	    	//$scope.refresh(); 
		});   
	}

	$scope.addUser = function()
	{
		$scope.project.users.push($scope.user);

		$http.put('/api/project', $scope.project).success(function() {
	    	$scope.refresh(); 
		});   
	}

	$scope.removeUser = function(user)
	{
		$http.delete('/api/project/' + $scope.project._id + '/user/' + user.name).success(function() {
	    	$scope.refresh(); 
		});   
	}

	$scope.initalize = function()
	{
		var url = new URL($location.absUrl()) ;
		var projectId = url.pathname.split('/').pop() ;
		$http.get('/api/project/' + projectId).success(function(data) { 
			$scope.project = data
		})
	}

	$scope.initalize() ;
});
