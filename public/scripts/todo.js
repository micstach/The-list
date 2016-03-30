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

angular.module('Index').controller('Notes', function($scope, $timeout, $http, $location, $uibModal, linkify, $sce) {

  $scope.userid = "";
  $scope.lastTag = undefined;
  $scope.tags = [] ;
  $scope.selectedTags = [];
  $scope.server = []
  $scope.searchText = "" ;
  $scope.searchTextBoxVisible = true ;
  $scope.autoRefreshTimer = null;
  $scope.adding = false ;

  $scope.InternalTags = {
    Flagged: 'status:flagged'
  } ;

  $scope.IsInternalTag = function(tag) {
    if (tag === $scope.InternalTags.Flagged)
      return true ;
    else
      return false ;
  }

  $scope.isNullOrUndefined = function(obj){
    return (obj === null || obj === undefined) ;
  }

  $scope.mergeTags = function(arr1, arr2) {
    
    if ($scope.isNullOrUndefined(arr1) && $scope.isNullOrUndefined(arr2)) {
      return [] ;
    } 
    else {
      
      if ($scope.isNullOrUndefined(arr1)) {
        arr1 = tagB ;
        arr2 = null ;
      }

      var tagsMerged = arr1 ;

      if (!$scope.isNullOrUndefined(arr2))
        tagsMerged = tagsMerged.concat(arr2) ;

      return tagsMerged.filter(function(tag, pos) { return tagsMerged.indexOf(tag) == pos && tag !== null; }) ;
    }
  }

  $scope.removeTags = function(text, tags) {

    tags.forEach(function(tag){
      text = text.replace('#' + tag, '') ;
    }) ;

    text = text.trim();

    return text ;
  }

  $scope.extractHashTags = function(text) {
    var tags = text.match(/([#][A-Za-z\d-]+)/g) ;

    if (tags == null)
      return [];
    else {
      for (var i=0; i<tags.length; i++)
        tags[i] = tags[i].replace('#', '');

      return tags;
    }
  }

  $scope.getNodeDOMId = function(note) {
    if (note._id !== undefined)
      return "note-id-" + note._id ;
    else
      return "note-id-undefined" ;
  }

  $scope.noteTextChanged = function(note) {
    note.modified = true ;
    note.newTags = $scope.extractHashTags(note.text) ;
    
    if (note.tags !== undefined)
      note.newTags = note.newTags.filter(function(tag) { return note.tags.indexOf(tag) === -1; });

    if (note.text.length == 0)
      note.modified = false ;

    resizeTextArea('#' + $scope.getNodeDOMId(note)) ;
  }

  $scope.searchButtonClicked = function() {
    $scope.searchTextBoxVisible = !$scope.searchTextBoxVisible ;
    $scope.organizeNotes($scope.server.notes, false) ;
  }
  
  $scope.searchTextChanged = function(searchText) {
    $scope.organizeNotes($scope.server.notes, false) ;
  }

  $scope.selectTag = function(tag) {
    
    var update = false ;

    if (tag === null) {
      $scope.selectedTags = [] ;
      update = true ;
    }
    else if (Object.prototype.toString.call(tag) === '[object Array]')
    {
      $scope.selectedTags = tag.slice() ;
      $scope.selectedTags.sort(function(a, b) {return a.toLowerCase().localeCompare(b.toLowerCase());})  
      update = true ;
    }
    else if (Object.prototype.toString.call(tag) === '[object String]') {
      if ($scope.selectedTags.indexOf(tag) === -1) {
        $scope.selectedTags.push(tag);
        $scope.selectedTags.sort(function(a, b) {return a.toLowerCase().localeCompare(b.toLowerCase());})  
        update = true ;
      }
    }

    if (update) {
      $('.search-box').outerWidth(0) ;
  
      $scope.organizeNotes($scope.server.notes, false) ;
      
      $timeout(repositionSearchBar, 0) ;
  
      $http
        .put('/api/user/config', {tags: $scope.selectedTags})
        .success(function() {
        });
    }
  }

  $scope.notesCount = function() {
    if ($scope.data !== undefined)
      return $scope.data.notes.filter(function(note){return note._id !== undefined;}).length ;
    else
      return 0 ;
  }

  $scope.cancelFilter = function(tag) {
    $scope.selectedTags.splice($scope.selectedTags.indexOf(tag), 1);  

    $scope.organizeNotes($scope.server.notes, false) ;

    $timeout(repositionSearchBar, 1000);
  
    $http
      .put('/api/user/config', {tags: $scope.selectedTags})
      .success(function() {
      });
  }

  $scope.transformTagForView = function(tag) {
    if (tag === $scope.InternalTags.Flagged)
      return $sce.trustAsHtml("<span class='glyphicon glyphicon-flag'></span>") ;
    else
      return $sce.trustAsHtml(tag) ;
  }

  $scope.transformNoteForView = function(note, clear) {
    note.editing = false ;
    note.modified = false ;
    note.removedTags = [] ;
    note.newTags = [] ;

    note.outputText = escapeHtmlEntities(note.text);
    note.outputText = note.outputText.replace(/\r\n/g, '\n');
    note.outputText = removeLeadingSpaces(note.outputText) ;

    note.outputText = detectPreformatedText(note.outputText);
    note.outputText = detectBoldText(note.outputText);
    note.outputText = detectItalicText(note.outputText);

    note.outputText = note.outputText.replace(/\n/g, '<br/>');  
    note.outputText = $sce.trustAsHtml(linkify.github(note.outputText)) ;
    
    note.timeVerbose = getTimeString(note.timestamp);

    if (note.tags !== undefined && note.tags !== null) {
      note.tags.sort(function(a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });      
    }
  }

  $scope.extractTagsFromNotes = function(notes) {
    
    $scope.internalTags = [] ;
    notes.forEach(function(note) {
      if (note.pinned)
        if ($scope.internalTags.indexOf($scope.InternalTags.Flagged) === -1)
          $scope.internalTags.push($scope.InternalTags.Flagged);
    }) ;

    $scope.tags = [] ;
    notes.forEach(function(note) {
      if ($scope.selectedTags.length > 0) {

        var foundTagsCount = $scope.selectedTags.filter(function(tag) {
          if (tag === $scope.InternalTags.Flagged)
            return note.pinned ;
          if (note.tags === undefined)
            return false ;
          else if (note.tags != null) {
            return (note.tags.indexOf(tag) != -1) ;
          }
          else
            return false ;
        }).length ;    

        if (foundTagsCount == $scope.selectedTags.length) {
          if (note.tags !== undefined && note.tags !== null) {
              $scope.tags = $scope.mergeTags($scope.tags, note.tags) ;
          }
        }
      }
      else {
        $scope.tags = $scope.mergeTags($scope.tags, note.tags) ;
      }
    }) ;

    $scope.tags.sort(function(a, b) {return a.toLowerCase().localeCompare(b.toLowerCase());});

    $scope.tags = $scope.mergeTags($scope.internalTags, $scope.tags);

    // remove from tags, tags from filterTags
    $scope.selectedTags.forEach(function(tag){
      $scope.tags.splice($scope.tags.indexOf(tag), 1) ;
    }) ;
  }

  $scope.filterNotes = function(notes, fromServer) {
    
    var taggedNotes = [] ;

    if ($scope.selectedTags.length > 0) {       
      notes.forEach(function(note) {
        
        var foundTagsCount = $scope.selectedTags.filter(function(tag) {
          if (tag === $scope.InternalTags.Flagged)
            return note.pinned;
          if (note.tags === undefined)
            return false ;
          else if (note.tags != null) {
            return (note.tags.indexOf(tag) != -1) ;
          }
          else
            return false ;
        }).length ;    

        if (foundTagsCount === $scope.selectedTags.length)
          taggedNotes.push(note) ;
      }) ;
    }
    else
    {
      notes.forEach(function(note) { taggedNotes.push(note) ;}) ;
    }

    var filteredNotes = [] ;  
    taggedNotes
      .filter(function(note) { return (note._id === undefined);})
      .forEach(function(note) { filteredNotes.push(note); });

    taggedNotes
      .filter(function(note) { return note.checked === false; })
      .sort(function(a, b) { return b.timestamp - a.timestamp;})
      .forEach(function(note) { filteredNotes.push(note);});

    taggedNotes
      .filter(function(note){return note.checked === true && note.pinned === false;})
      .sort(function(a, b) { return b.timestamp - a.timestamp;})
      .forEach(function(note) { filteredNotes.push(note);}) ;

    var refreshDelay = ((1000 * 60) * 60) ; // one hour
    var lowestRefreshDelay = (1000 * 15) ; 

    if ($scope.searchTextBoxVisible) {
      if ($scope.searchText !== null && $scope.searchText.length > 0) {
        filteredNotes = filteredNotes.filter(function(note) { 

          var textFoundInNoteText = note.text.toLowerCase().indexOf($scope.searchText.toLowerCase()) !== -1 ;
          var textFoundInNoteTags = false ;
          if (note.tags !== undefined && note.tags !== null) {
            textFoundInNoteTags = note.tags.filter(function(tag) { return tag.toLowerCase().indexOf($scope.searchText.toLowerCase()) !== -1;}).length > 0;
          }
          return textFoundInNoteText || textFoundInNoteTags ;

        }) ;
      }
    }

    filteredNotes.forEach(function(note) {
      var delta = Date.now() - (new Date(note.timestamp)) ;
      if (delta < refreshDelay) {
        refreshDelay = delta ;

        if (refreshDelay < lowestRefreshDelay)
          refreshDelay = lowestRefreshDelay ;    
      }

      $scope.transformNoteForView(note, fromServer);
    });

    $scope.extractTagsFromNotes(filteredNotes);

    return {refreshDelay: refreshDelay, notes: filteredNotes} ;
  }

  $scope.cancelTimer = function(timer) {
    if (timer !== null) {
      $timeout.cancel(timer) ;
      timer = null ;
    } 
  }

  $scope.organizeNotes = function(notes, fromServer) {
    var result = $scope.filterNotes(notes, fromServer) ;
    $scope.data = {notes: result.notes};

    if ($scope.data.notes.length === 0 && 
        $scope.searchText.length === 0 &&
        $scope.selectedTags.length === 0 )
    {
      $scope.createNewNote();
    }

    $scope.cancelTimer($scope.autoRefreshTimer) ;       
  }

  $scope.initialize = function() {
    $http.get('/api/user/config')
      .success(function(data) { 
        
        if (data.config !== undefined)
          if (data.config.tags !== undefined) {
              $scope.selectedTags = data.config.tags;
              $scope.selectedTags.sort(function(a, b) {return a.toLowerCase().localeCompare(b.toLowerCase());})  
            }

        $scope.getItems() ;
      })
      .error(function(data, status) {
        window.location = '/login' ;
      }) ;
  }

  $scope.getItems = function(fromServer) {

    if (fromServer === undefined)
      fromServer = true ;

    if (fromServer) {
      $http.get('/api/notes')
        .success(function(data) { 
          // save server data for future filtering
          $scope.server = {notes: data.notes} ;

          $scope.organizeNotes(data.notes, fromServer) ;
          $scope.userid = data.userid; 
        })
        .error(function(data, status) {
          window.location = '/login' ;
        }) ;
      }
      else {
        $scope.organizeNotes($scope.data.notes, fromServer);
      }
  };

  $scope.createNewNote = function() {
    $scope.cancelTimer($scope.autoRefreshTimer) ;  
    $scope.cancelDeleyedRefresh();

    var note = {
        text: '', 
        checked: false,
        pinned: false,
        tags: $scope.selectedTags.slice(),
        timestamp: Date.now(),
        editing: true,
        owner: $scope.userid,
        users: [],
        removedTags: []
      } ;

      note.timeVerbose = "nowa" ;

      // insert note stub
      $scope.data.notes.splice(0, 0, note);
      $scope.adding = true ;
  }

  $scope.enterEditingMode = function(note) {
    $scope.cancelTimer($scope.autoRefreshTimer) ;  
    $scope.cancelDeleyedRefresh();

    note.changeAccepted = false ;

    note.editing = true ;
    note.originalText = note.text ;
    note.originalTags = note.tags ;

    $scope.data.notes.forEach(function(item){
      if (note._id != item._id)
          item.editing = false ;
    });
  }

  $scope.acceptChanges = function(note) {
    note.changeAccepted = true ;

    if (note.newTags !== undefined)
    {
      if (note.tags !== undefined)
        note.tags = $scope.mergeTags(note.tags, note.newTags) ;
      else
        note.tags = note.newTags ;

      note.text = $scope.removeTags(note.text, note.tags) ;
    }

    $scope.transformNoteForView(note, true) ;
    $scope.extractTagsFromNotes($scope.data.notes) ;

    $scope.selectTag(note.tags) ;

    if (note._id === undefined) {
      $http
        .post('/api/note/create', {text: note.text, tags: note.tags, pinned: note.pinned})
        .success(function(){
          $scope.getItems() ;
        });
    }
    else {      
      $http
        .put('/api/note/update/' + note._id, {text: note.text, tags: note.tags})
        .success(function() {
        });
    }

    $scope.adding = false ;
    $scope.deleyedRefresh(0) ;
  };

  $scope.cancelChanges = function($event, note){
    note.changeAccepted = false ;
    $scope.adding = false ;

    if (note._id === undefined) {
      $scope.data.notes.splice($scope.data.notes.indexOf(note), 1);
    }
    else {
      note.text = note.originalText ;
      note.tags = note.originalTags ;
      note.removedTags = [];
      note.newTags = [] ;

      if ($event == null) {
        note.editing = false ;
        note.modified = false ;
      }
      else if ($event.keyCode == 27) {
        note.editing = false ;
        note.modified = false ;
      }
    }

    $scope.deleyedRefresh();
  }

  $scope.deleteTag = function(note, tag) {
    note.removedTags.push(tag);
    note.tags.splice(note.tags.indexOf(tag), 1) ;
    note.modified = true ;

    // $scope.cancelFilter(tag) ;
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
        .post('/api/notes/removeall')
        .success(function() { $scope.getItems(); });
      });
  }

  $scope.toggleItem = function(note){
    note.checked = (note.checked !== undefined) ? !note.checked : true ;
    
    $scope.deleyedRefresh() ;

    $http
      .put('/api/note/check/' + note._id + '/' + note.checked)
      .success(function(){
      });
  }

  $scope.pinItem = function(note) {

    if (note._id === undefined) {
      note.pinned = !note.pinned ;
    }
    else {
      note.pinned = (note.pinned !== undefined) ? !note.pinned : true;
 
      $http
        .put('/api/note/pin/' + note._id + '/' + note.pinned)
        .success(function(){
        });
    }
    $scope.deleyedRefresh() ;
  };

  $scope.cancelDeleyedRefresh = function() {
    if ($scope.delayedRefreshTimeout !== undefined) {
      if ($scope.delayedRefreshTimeout !== null) {
        $timeout.cancel($scope.delayedRefreshTimeout) ;  
        $scope.delayedRefreshTimeout = null ;
      }
    }
  }

  $scope.deleyedRefresh = function() {
    if ($scope.delayedRefreshTimeout === undefined)
        $scope.delayedRefreshTimeout = null ;

    $scope.cancelDeleyedRefresh();
      
    $scope.delayedRefreshTimeout = $timeout(function() {$scope.getItems(false)}, 5000) ;
  }

  $scope.refresh = function()
  {
    $scope.getItems() ;
  }

  $scope.initialize() ;
  $timeout(repositionSearchBar, 1000);
}) ;

angular.module('Index').directive('focus', function($timeout, $parse) {
  return {
    link: function(scope, element, attrs) {
      var model = $parse(attrs.focus);
      scope.$watch(model, function(value) {
        if(value === true) { 
          $timeout(function() {
            element[0].focus(); 
            resizeTextArea('#' + attrs.id);
          }, 0);
          $timeout(function() {
            element[0].focus(); 
            resizeTextArea('#' + attrs.id);
          }, 100);
        }
      });
      // element.bind('blur', function() {
      //    scope.$apply(model.assign(scope, false));
      // });
    }
  };
});

angular.module('Index').directive('focusSearch', function($timeout, $parse) {
  return {
    link: function(scope, element, attrs) {
      var model = $parse(attrs.focusSearch);
      scope.$watch(model, function(value) {
        if(value === true) { 
          $timeout(function() {
            element[0].focus(); 
          }, 0);
          $timeout(function() {
            element[0].focus(); 
          }, 100);
        }
      });
      // element.bind('blur', function() {
      //    scope.$apply(model.assign(scope, false));
      // });
    }
  };
});

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
