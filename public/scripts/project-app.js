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

	$scope.newUserName = ""
	$scope.newUserRole = ""

	$scope.userClicked = function()
	{
		alert("hello") ;
	}

	$scope.deleteProject = function(projectId)
	{
	    $http.delete('/api/project/' + projectId).success(function() {$window.location.href = "/home" });
	}

	$scope.addUser = function(event)
	{
		var projectId = event.currentTarget.getAttribute('data-project-id') ; 
		$http.put('/api/project/' + projectId + '/user/' + $scope.newUserName).success(function() {$window.location.reload();});   
	}

	$scope.removeUser = function(projectId, userName)
	{
		$http.delete('/api/project/' + projectId + '/user/' + userName).success(function() {$window.location.reload();});   
	}
});
