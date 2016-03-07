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

angular.module('Index').controller('Notes', function($scope, $timeout, $http, $location, $uibModal) {

  $scope.lastTag = undefined;
  $scope.filterText = undefined;
  $scope.autoRefreshTimer = null;

  $scope.haveTags = function(noteText) {
    return (noteText.indexOf(': ') > 0 && 
            noteText
              .substr(0, noteText.indexOf(': '))
              .split(',')
              .filter(function(tag) { 
                return tag.trim().indexOf(' ') != -1;
              }).length == 0)
  }

  $scope.extractTags = function(text) {
    var tags = [] ;

    if ($scope.haveTags(text)) {
      text
        .substr(0, text.indexOf(': '))
        .split(',')
        .forEach(function(tag) { 
          tags.push(tag.trim().toLowerCase());
        });
    }

    return tags ;
  }

  $scope.extractNoteText = function(noteText) {
    if ($scope.haveTags(noteText)){
      var position = noteText.indexOf(': ') + 1 ;
      return noteText.substr(position, noteText.length - position).trim() ;
    }
    else
      return noteText ;
  }

  $scope.filterItems = function() {
    // detect tags
    if ($scope.haveTags($scope.noteText)) {
      $scope.filterText = $scope.noteText.substr(0, $scope.noteText.indexOf(': '));
      $scope.getItems();
    }
    else {
      if ($scope.filterText !== undefined) {
        $scope.filterText = undefined ;
        $scope.getItems() ;
      }
    }
  }

  $scope.setTag = function(tag) {
    $scope.noteText = tag + ": " ;
    $scope.filterItems() ;
  }

  $scope.getItems = function() {
    $http.get('/api/notes')
      .success(function(data) { 

        var filteredNotes = [] ;

        if ($scope.filterText !== undefined) {       
          var tags = [] ;
          $scope.filterText.split(',').forEach(function(tag) { tags.push(tag.trim().toLowerCase());});

          data.notes.forEach(function(note) {
            
            var tagsFound = tags.filter(function(tag){
              var tagPosition = note.text.toLowerCase().indexOf(tag) ;
              return (0 <= tagPosition && tagPosition < note.text.indexOf(':')) ;
            }).length ;    

            if (tagsFound > 0)
              filteredNotes.push(note) ;

          }) ;
        }
        else
        {
          data.notes.forEach(function(note) { filteredNotes.push(note) ;}) ;
        }

        var notes = [] ;  
        filteredNotes
          .filter(function(note) { return note.pinned === true;})
          .sort(function(a, b) { return b.timestamp - a.timestamp;})
          .forEach(function(note) { notes.push(note); });

        filteredNotes
          .filter(function(note) { return note.checked === false && note.pinned === false;})
          .sort(function(a, b) { return b.timestamp - a.timestamp;})
          .forEach(function(note) { notes.push(note);});

        filteredNotes
          .filter(function(note){return note.checked === true && note.pinned === false;})
          .sort(function(a, b) { return b.timestamp - a.timestamp;})
          .forEach(function(note) { notes.push(note);}) ;

        var refreshDelay = ((1000 * 60) * 60) ; // one hour
        var lowestRefreshDelay = (1000 * 15) ; 

        notes.forEach(function(note) {
          var delta = Date.now() - (new Date(note.timestamp)) ;
          if (delta < refreshDelay) {
            refreshDelay = delta ;

            if (refreshDelay < lowestRefreshDelay)
              refreshDelay = lowestRefreshDelay ;    
          }

          // transform unix timestamp into modified time
          note.timestamp = getTimeString(note.timestamp);
          note.originalText = note.text;
          note.tags = $scope.extractTags(note.text)  
          note.text = $scope.extractNoteText(note.text) ;
          note.editMode = false ;
        });

        data.notes = notes;

        $scope.data = data ;

        $scope.autoRefreshTimer = $timeout($scope.getItems, refreshDelay);
      })
      .error(function(data, status) {
        window.location = '/login' ;
      }) ;
  };

  $scope.addNewItem = function(noteText) {

    $http
      .post('/api/note/create', {text: noteText})
      .success(function(){
        $scope.getItems() ;
      });

    if ($scope.filterText !== undefined) {
      $scope.noteText = $scope.filterText + ': ' ;
    }
    else
      $scope.noteText = '';
  };

  $scope.enterModifyMode = function(note) {
    note.editMode = true ;

    if ($scope.autoRefreshTimer != null) {
      $timeout.cancel($scope.autoRefreshTimer) ;
      $scope.autoRefreshTimer = null ;
    } 
  }

  $scope.modifyItem = function(note){
    $http
      .put('/api/note/update/' + note._id, {text: note.originalText})
      .success(function(){
        note.editMode = false ;
        $scope.getItems() ;
      });
  };

  $scope.cancelModifyMode = function($event, note){
    if ($event.keyCode == 27) {
      note.editMode = false ;
    }
  }

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
            note.timestamp = getTimeString(Date.now());
            //$scope.getItems();
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
