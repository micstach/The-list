angular.module('Index', ['ngAnimate', 'ui.bootstrap', 'linkify']) ;

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

angular.module('Index').controller('Notes', function($scope, $http, $location, $uibModal) {

  $scope.getItems = function() {
    $http.get('/api/notes')
      .success(function(data) { 

        var filteredItems = [] ;  
        
        data.notes
          .filter(function(note) { return note.status === 'unchecked';})
          .sort(function(a, b) { return b.timestamp - a.timestamp;})
          .forEach(function(note) { filteredItems.push(note);});

        data.notes
          .filter(function(note){return note.status === 'checked';})
          .sort(function(a, b) { return b.timestamp - a.timestamp;})
          .forEach(function(note) { filteredItems.push(note);}) ;

        filteredItems.forEach(function(note) {
          note.timestamp = getTimeString(note.timestamp);
        });

        data.notes = filteredItems;

        $scope.data = data ;
      })
      .error(function(data, status) {
        window.location = '/login' ;
      }) ;
  };

  $scope.addNewItem = function(noteText) {
    
    $http
      .post('/api/message/create', {message:noteText})
      .success(function(){
        $scope.getItems() ;
      });

    $scope.noteText = null;
  };

  $scope.deleteItem = function(note) {
      
    var note = $scope.data.notes.filter(function(x){return x._id === note._id;})[0] ;

    var modalInstance = $uibModal.open({
      animation: true,
      templateUrl: 'views/dialog-delete-note.html',
      controller: 'delete-note-controller',
      size: 'lg',
      resolve: {
        note: function () {
          return {text: note.text, timestamp: note.timestamp} ;
        }
      }
    });

    modalInstance.result.then(function () {
      $http
      .post('/api/message/delete/' + note._id)
      .success(function() { $scope.getItems(); });
    });
  }

  $scope.deleteAllItems = function() {
      
    var modalInstance = $uibModal.open({
      animation: true,
      templateUrl: 'views/dialog-delete-all-notes.html',
      controller: 'delete-all-notes-controller',
      size: 'lg'
    });

    modalInstance.result.then(function () {
      $http
        .post('/api/message/removeall')
        .success(function() { $scope.getItems(); });
      });
  }

  $scope.toggleItem = function(note){
    var status = (note.status === "checked" ? "unchecked" : "checked") ;

    $http
      .put('/api/message/' + status + '/' + note._id)
      .success(function(){});
  }

  $scope.refresh = function()
  {
    $scope.getItems() ;
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

angular.module('Index').controller('delete-all-notes-controller', function ($scope, $uibModalInstance)
{
  $scope.ok = function () {
    $uibModalInstance.close();
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});
