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
          .filter(function(note) { return note.pinned === true;})
          .sort(function(a, b) { return b.timestamp - a.timestamp;})
          .forEach(function(note) { filteredItems.push(note); });

        data.notes
          .filter(function(note) { return note.checked === false && note.pinned === false;})
          .sort(function(a, b) { return b.timestamp - a.timestamp;})
          .forEach(function(note) { filteredItems.push(note);});

        data.notes
          .filter(function(note){return note.checked === true && note.pinned === false;})
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
      
    var modalInstance = $uibModal.open({
      animation: true,
      templateUrl: 'views/dialog-delete-note.html',
      controller: 'delete-note-controller',
      size: 'lg',
      resolve: {
        note: function () {
          return note;
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
    var state = (note.checked !== undefined) ? !note.checked : true ;
    
    $http
      .put('/api/message/check/' + note._id + '/' + state)
      .success(function(){
            note.checked = state ;
      });
  }

  $scope.pinItem = function(note) {
    var state = (note.pinned !== undefined) ? !note.pinned : true;

    $http
      .put('/api/message/pin/' + note._id + '/' + state)
      .success(function(){
            $scope.getItems();
      });
  };

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
