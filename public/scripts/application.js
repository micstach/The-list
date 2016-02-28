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

angular.module('Index').controller('Notes', function($scope, $http, $uibModal) {
	
	$scope.delNoteText = {value: "text"} ;

	$scope.getItems = function() {
		$http.get('/api/messages', {cache: false})
			.success(function(data) { 

				data.messages.forEach(function(note) {
					note.timestamp = getTimeString(note.timestamp);
				});

				data.messages = data.messages.reverse();

				$scope.data = data ;
			});
	};

	$scope.addNewItem = function(noteText) {
		
		$http
			.post('/api/message/create', {message:noteText})
			.success(function(){
				$scope.getItems() ;
			});

		$scope.noteText = null;
	};

	$scope.deleteItem = function(item) {
			
		var messageId = item.currentTarget.getAttribute('data-message-id')

		var message = $scope.data.messages.filter(function(item){return item._id.toString() === messageId;})[0] ;

		var userId = item.currentTarget.getAttribute('data-user-id')

		$scope.delNoteText.value = messageId ;

	    var modalInstance = $uibModal.open({
	      animation: false,
	      templateUrl: 'delete-note-template.html',
	      controller: 'delete-note-controller',
	      size: 'lg',
	      resolve: {
	        note: function () {
	          return {text: message.text, timestamp: message.timestamp} ;
	        }
	      }
	    });

	    modalInstance.result.then(function () {
			$http
				.post('/api/message/delete/' + messageId)
				.success(function(){
					$scope.getItems() ;
				});
	    });


	}

	$scope.getItems() ;
}) ;

angular.module('Index').controller('delete-note-controller', function ($scope, $uibModalInstance, note)
{
  $scope.note = note;

  $scope.ok = function () {
    $uibModalInstance.close();
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});
