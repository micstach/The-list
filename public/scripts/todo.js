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

  $scope.userid = "";
  $scope.lastTag = undefined;
  $scope.filterTags = [];
  $scope.autoRefreshTimer = null;

  $scope.removeTags = function(text, tags) {

    tags.forEach(function(tag){
      text = text.replace('#' + tag + ' ', '') ;
      text = text.replace(' #' + tag, '') ;
    }) ;

    return text ;
  }

  $scope.extractHashTags = function(text) {
    var tags = text.match(/([#][a-z\d-]+)/g) ;

    if (tags == null)
      return [];
    else {
      for (var i=0; i<tags.length; i++)
        tags[i] = tags[i].replace('#', '');

      return tags;
    }
  }

  $scope.noteTextChanged = function(note) {
    note.modified = true ;
    if (note.tags !== undefined) {
      note.newTags = note.tags.concat($scope.extractHashTags(note.text)) ;
      note.newTags = note.newTags.filter(function(item, pos) { return note.newTags.indexOf(item) == pos}) ;
    }
    else {
      note.newTags = $scope.extractHashTags(note.text) ;
    }
    resizeTextArea('.note-edit-input') ;
  }
  
  $scope.filterItems = function() {
    $scope.filterTags = $scope.extractHashTags($scope.noteText)  ;
    $scope.getItems();
  }

  $scope.setTag = function(tag) {
    $scope.noteText = '#' + tag + ' ';  
    $scope.filterItems() ;
  }

  $scope.filterNotes = function(notes, fromServer) {
    var taggedNotes = [] ;

    if ($scope.filterTags.length > 0) {       
      notes.forEach(function(note) {
        
        var tagsFound = $scope.filterTags.filter(function(tag) {
          if (note.tags === undefined)
            return false ;
          else if (note.tags != null) {
            return (note.tags.indexOf(tag) != -1) ;
          }
          else
            return false ;
        }).length ;    

        if (tagsFound > 0)
          taggedNotes.push(note) ;

      }) ;
    }
    else
    {
      notes.forEach(function(note) { taggedNotes.push(note) ;}) ;
    }

    var filteredNotes = [] ;  
    taggedNotes
      .filter(function(note) { return (note.isNew !== undefined && note.isNew === true);})
      .forEach(function(note) { filteredNotes.push(note); });

    taggedNotes
      .filter(function(note) { return note.pinned === true;})
      .sort(function(a, b) { return b.timestamp - a.timestamp;})
      .forEach(function(note) { filteredNotes.push(note); });

    taggedNotes
      .filter(function(note) { return note.checked === false && note.pinned === false;})
      .sort(function(a, b) { return b.timestamp - a.timestamp;})
      .forEach(function(note) { filteredNotes.push(note);});

    taggedNotes
      .filter(function(note){return note.checked === true && note.pinned === false;})
      .sort(function(a, b) { return b.timestamp - a.timestamp;})
      .forEach(function(note) { filteredNotes.push(note);}) ;

    var refreshDelay = ((1000 * 60) * 60) ; // one hour
    var lowestRefreshDelay = (1000 * 15) ; 

    filteredNotes.forEach(function(note) {
      var delta = Date.now() - (new Date(note.timestamp)) ;
      if (delta < refreshDelay) {
        refreshDelay = delta ;

        if (refreshDelay < lowestRefreshDelay)
          refreshDelay = lowestRefreshDelay ;    
      }

      // extend model
      if (fromServer) {
        note.editing = false ;
        note.modified = false ;
        note.removedTags = [] ;
      }
      note.timeVerbose = getTimeString(note.timestamp);
    });

    return {refreshDelay: refreshDelay, notes: filteredNotes} ;
  }

  $scope.getItems = function() {

    $http.get('/api/notes')
      .success(function(data) { 
        var filteredNotes = $scope.filterNotes(data.notes, true) ;
        $scope.userid = data.userid; 
        $scope.notes = filteredNotes.notes ;
        $scope.autoRefreshTimer = $timeout($scope.getItems, filteredNotes.refreshDelay) ;
      })
      .error(function(data, status) {
        window.location = '/login' ;
      }) ;
  };

  $scope.createNewNote = function() {
    var note = {
        _id: "0",
        text: 'Zanotujmy coś...', 
        checked: false,
        pinned: false,
        tags: [],
        timestamp: Date.now(),
        editing: true,
        isNew: true,
        owner: $scope.userid,
        users: []
      } ;

      note.timeVerbose = getTimeString(note.timestamp) ;

      $scope.notes.splice(0, 0, note);
      // $scope.notes = $scope.filterNotes($scope.notes, false) ;
  }

  $scope.createNote = function(noteText) {

    var tags = $scope.extractHashTags(noteText) ;
    var text = $scope.removeTags(noteText, tags);

    $http
      .post('/api/note/create', {text: text, tags: tags})
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
    note.editing = true ;

    $scope.notes.forEach(function(item){
      if (note._id != item._id)
          item.editing = false ;
    });

    if ($scope.autoRefreshTimer != null) {
      $timeout.cancel($scope.autoRefreshTimer) ;
      $scope.autoRefreshTimer = null ;
    } 
  }

  $scope.acceptChanges = function(note) {

    if (note.isNew !== undefined && note.isNew == true) {
      var tags = $scope.extractHashTags(note.text) ;
      var text = $scope.removeTags(note.text, tags);

      $http
        .post('/api/note/create', {text: text, tags: tags})
        .success(function(){
          $scope.getItems() ;
        });

    }
    else {
      var tags = note.tags ;
      if (note.newTags !== undefined)
      {
        tags = note.newTags ;
        note.text = $scope.removeTags(note.text, note.newTags) ;
      }

      note.removedTags = [] ;

      $http
        .put('/api/note/update/' + note._id, {text: note.text, tags: tags})
        .success(function() {
          note.editing = false ;
          note.modified = false ;
        });
    }
  };

  $scope.cancelChanges = function($event, note){
    
    if (note.isNew !== undefined && note.isNew == true) {
      $scope.notes.splice($scope.notes.indexOf(note), 1) ;
    }
    else {
      // restore removedTags
      if (note.removedTags !== undefined && note.removedTags.length > 0) {
        note.tags = note.tags.concat(note.removedTags) ;
        note.removedTags = [];
      }

      if ($event == null) {
        note.editing = false ;
        note.modified = false ;
      }
      else if ($event.keyCode == 27) {
        note.editing = false ;
        note.modified = false ;
      }
    }
  }

  $scope.deleteTag = function(note, tag) {
    note.removedTags.push(tag);
    note.tags.splice(note.tags.indexOf(tag), 1) ;
    note.modified = true ;
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
      .post('/api/note/delete/' + note._id)
      .success(function() { 
        $scope.getItems(); 
      });
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

angular.module('Index').directive('focus', function($timeout, $parse) {
  return {
    link: function(scope, element, attrs) {
      var model = $parse(attrs.focus);
      scope.$watch(model, function(value) {
        if(value === true) { 
          $timeout(function() {
            element[0].focus(); 
            resizeTextArea('.note-edit-input');
          }, 1);
        }
      });
      // element.bind('blur', function() {
      //    scope.$apply(model.assign(scope, false));
      // });
    }
  };
});

// angular.module('Index').directive('elastic', [
//     '$timeout',
//     function($timeout) {
//         return {
//             restrict: 'A',
//             link: function($scope, element) {
//               $scope.initialHeight = $scope.initialHeight || element[0].style.height; 
//               var resize = function() { 
//                 element[0].style.height = $scope.initialHeight; 
//                 element[0].style.height = "" + element[0].scrollHeight + "px"; 
//               }; 

//               element.on("blur keyup change", resize); $timeout(resize, 0); 
//             }
//         };
//     }
// ]);

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
