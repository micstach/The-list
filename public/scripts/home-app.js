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

  $scope.userId = undefined;
  $scope.userName = undefined ;
  $scope.lastTag = undefined;
  $scope.tags = [] ;
  $scope.selectedTags = new Map([]);
  $scope.selectedProjectId = null ;
  $scope.selectedProject = null;
  $scope.fromServer = []
  $scope.searchText = "" ;
  $scope.searchTextBoxVisible = true ;
  $scope.autoRefreshTimer = null;
  $scope.adding = false ;

  $scope.InternalTags = {
    Flagged: 'status:flagged',
    Checked: 'status:checked',
    Unchecked: 'status:unchecked',
    toArray: function() { 
      return [this.Flagged, this.Checked, this.Unchecked]; 
    }
  } ;

  $scope.getSelectedTags = function() {
    if ($scope.selectedTags[$scope.selectedProjectId] !== undefined)
      return $scope.selectedTags[$scope.selectedProjectId] ;
    else {
      $scope.selectedTags[$scope.selectedProjectId] = [] ;
      return $scope.selectedTags[$scope.selectedProjectId] ;
    }    
  }

  $scope.IsInternalTag = function(tag) {
    if (tag === $scope.InternalTags.Flagged)
      return true ;
    else if (tag === $scope.InternalTags.Checked)
      return true ;
    else if (tag === $scope.InternalTags.Unchecked)
      return true ;
    else
      return false ;
  }

  $scope.getOwnerNames = function(project) {
    if (project !== null)
      if (project.users !== undefined)
        return project.users.filter(function(user) { return user.role == "owner"})    

    return []
  }

  $scope.getUserRole = function(project) {
    if (project !== null) 
      if (project.users !== undefined) {
        var user = project.users.filter(function(user) { return user.name === $scope.userName})[0];
        return user.role ;
      }
    
    return ""
  }

  $scope.hasWriteAccess = function(project) {
    var role = $scope.getUserRole(project)
    return (role === "read-write" || role === "owner")
  }

  $scope.isOwner = function(project) {
    return ($scope.getOwnerNames(project).filter(function(user) { return user.name === $scope.userName}).length > 0);
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
  
  $scope.keyUp = function(note, event) {

    // CTRL+ENTER
    if (event.keyCode === 13 && event.ctrlKey) {
      $scope.acceptChanges(note);
    }
    // ESC
    else if (event.keyCode === 27 ) {
      $scope.cancelChanges(null, note)
    }
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
    $scope.organizeNotes($scope.fromServer.notes, false) ;
  }
  
  $scope.searchTextChanged = function(searchText) {
    $scope.organizeNotes($scope.fromServer.notes, false) ;
  }

  $scope.sortSelectedTags = function(tags) {
    if (tags === undefined) return ;
    if (tags === null) return ;

    tags.sort(function(a, b) {
      if (a.indexOf("status:") === b.indexOf("status:"))
        return a.toLowerCase().localeCompare(b.toLowerCase());
      else if (a.indexOf("status:") !== -1)
        return -1 ;
      else if (b.indexOf("status:") !== -1)
        return 1 ;
      else
        return 0 ;
    }) ;  
  }

  $scope.selectProject = function(project) {
    if (project == null) {
      $scope.selectedProjectId = null ;
      $scope.selectedProject = null ;
    }
    else {
      $scope.selectedProjectId = project._id ;
      $scope.selectedProject = $scope.fromServer.projects.filter(function(project) { return project._id == $scope.selectedProjectId })[0];
    }

    $('.search-box').outerWidth(0) ;
    $scope.organizeNotes($scope.fromServer.notes, false) ;
    $timeout(repositionSearchBar, 0) ;
    
    $http.put('/api/user/config', {project_id: $scope.selectedProjectId}).success(function() {});    
  }

  $scope.selectTag = function(tag) {
    
    var update = false ;

    if (tag === null) {
      $scope.selectedTags[$scope.selectedProjectId] = [] ;
      update = true ;
    }
    else if (Object.prototype.toString.call(tag) === '[object Array]')
    {
      $scope.selectedTags[$scope.selectedProjectId] = tag.slice() ;
      update = true ;
    }
    else if (Object.prototype.toString.call(tag) === '[object String]') {
      if ($scope.selectedTags[$scope.selectedProjectId].indexOf(tag) === -1) {
        $scope.selectedTags[$scope.selectedProjectId].push(tag);
        update = true ;
      }
    }

    if (update) {
      $scope.sortSelectedTags($scope.selectedTags[$scope.selectedProjectId]) ;

      $('.search-box').outerWidth(0) ;
  
      $scope.organizeNotes($scope.fromServer.notes, false) ;
      
      $timeout(repositionSearchBar, 0) ;
  


      $http.put('/api/user/config', {tags: JSON.stringify($scope.selectedTags)}).success(function() {});
    }
  }

  $scope.notesCount = function() {
    if ($scope.data !== undefined)
      return $scope.data.notes.filter(function(note){return note._id !== undefined;}).length ;
    else
      return 0 ;
  }

  $scope.cancelFilter = function(tag) {
    $scope.selectedTags[$scope.selectedProjectId].splice($scope.selectedTags[$scope.selectedProjectId].indexOf(tag), 1);  

    $scope.organizeNotes($scope.fromServer.notes, false) ;

    $timeout(repositionSearchBar, 1000);
  
    $http.put('/api/user/config', {tags: {x: $scope.selectedTags}}).success(function() {});
  }

  $scope.transformTagForView = function(tag) {
    if (tag === $scope.InternalTags.Flagged)
      return $sce.trustAsHtml("<span class='special-tag glyphicon glyphicon-flag'></span>") ;
    if (tag === $scope.InternalTags.Checked)
      return $sce.trustAsHtml("<span class='special-tag glyphicon glyphicon-check'></span>") ;
    if (tag === $scope.InternalTags.Unchecked)
      return $sce.trustAsHtml("<span class='special-tag glyphicon glyphicon-unchecked'></span>") ;
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

    note.outputText = detectBoldText(note.outputText);
    note.outputText = detectItalicText(note.outputText);
    note.outputText = detectPreformatedText(note.outputText);
    if ($scope.searchText !== null && $scope.searchText.length > 0)
      note.outputText = detectSubText(note.outputText, $scope.searchText);

    note.outputText = note.outputText.replace(/\n/g, '<br/>');  
    note.outputText = $sce.trustAsHtml(linkify.normal(note.outputText)) ;
    
    note.timeVerbose = getTimeString(note.timestamp);

    if (note.tags !== undefined && note.tags !== null) {
      note.tags.sort(function(a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });      
    }
  }

  $scope.getAuthorName = function(note) {
    if ($scope.selectedProject !== null) {
      if (note.user.name !== $scope.userName) {
        return note.user.name + ", " ;
      }
      else {
        var projectNotes = $scope.fromServer.notes.filter(function(note) { 
          if ($scope.selectedProjectId == null)
            return true ;
          else
            return note.project_id == $scope.selectedProjectId ;
          }) 

        var noteAuthors = [] ;
        projectNotes.forEach(function(n) {
          if (noteAuthors.indexOf(n.user.name) == -1)
            noteAuthors.push(n.user.name)
        })

        if (noteAuthors.length > 1) {
          return note.user.name + ", " ;
        }
      }
    }

    return ""
  }

  $scope.countUnselectedNoteTags = function(note) {
    var tags = note.tags.slice() ;

    if (!note.editing) {
      $scope.selectedTags[$scope.selectedProjectId].forEach(function(selectedTag) {
        removeElementFromArray(tags, selectedTag) ;
      }) ;
    }

    return tags.length ;
  }

  $scope.extractTagsFromNotes = function(notes) {
    
    $scope.internalTags = [] ;

    var addCheckedTag = false ;
    var addUncheckedTag = false ;
    var addFlaggedTag = false ;

    notes.forEach(function(note) {
      if (note.checked)
        if ($scope.internalTags.indexOf($scope.InternalTags.Checked) === -1)
          addCheckedTag = true ;

      if (!note.checked)
        if ($scope.internalTags.indexOf($scope.InternalTags.Unchecked) === -1)
          addUncheckedTag = true ;

      if (note.pinned)
        if ($scope.internalTags.indexOf($scope.InternalTags.Flagged) === -1)
          addFlaggedTag = true ;
    }) ;

    if (addCheckedTag && notes.filter(function(n){return n.checked}).length < notes.length)
      $scope.internalTags.push($scope.InternalTags.Checked);
    if (addUncheckedTag && notes.filter(function(n){return !n.checked}).length < notes.length)
      $scope.internalTags.push($scope.InternalTags.Unchecked);
    if (addFlaggedTag && notes.filter(function(n){return n.pinned}).length < notes.length)
      $scope.internalTags.push($scope.InternalTags.Flagged);

    $scope.tags = [] ;
    notes.forEach(function(note) {
      if ($scope.getSelectedTags().length > 0) {

        var foundTagsCount = $scope.selectedTags[$scope.selectedProjectId].filter(function(tag) {
          if (tag === $scope.InternalTags.Flagged)
            return note.pinned ;
          
          if (tag === $scope.InternalTags.Checked)
            return note.checked ;
          
          if (tag === $scope.InternalTags.Unchecked)
            return !note.checked ;

          if (note.tags === undefined)
            return false ;
          else if (note.tags != null) {
            return (note.tags.indexOf(tag) != -1) ;
          }
          else
            return false ;
        }).length ;    

        if (foundTagsCount == $scope.getSelectedTags().length) {
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
    $scope.selectedTags[$scope.selectedProjectId].forEach(function(tag){
      $scope.tags.splice($scope.tags.indexOf(tag), 1) ;
    }) ;
  }

  $scope.filterNotes = function(notes, fromServer) {
    
    var projectNotes = notes.filter(function(note) { 
      if ($scope.selectedProjectId == null)
        return true ;
      else
        return note.project_id == $scope.selectedProjectId ;
    }) ;

    var taggedNotes = [] ;

    if ($scope.getSelectedTags().length > 0) {       
      projectNotes.forEach(function(note) {
        
        var foundTagsCount = $scope.getSelectedTags().filter(function(tag) {
          if (tag === $scope.InternalTags.Flagged)
            return note.pinned ;
          
          if (tag === $scope.InternalTags.Checked)
            return note.checked ;
          
          if (tag === $scope.InternalTags.Unchecked)
            return !note.checked ;

          if (note.tags === undefined)
            return false ;
          else if (note.tags != null) {
            return (note.tags.indexOf(tag) != -1) ;
          }
          else
            return false ;
        }).length ;    

        if (foundTagsCount === $scope.getSelectedTags().length)
          taggedNotes.push(note) ;
      }) ;
    }
    else
    {
      projectNotes.forEach(function(note) { taggedNotes.push(note) ;}) ;
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
      .filter(function(note){return note.checked === true;})
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
        $scope.getSelectedTags().length === 0 )
    {
      $scope.createNewNote();
    }

    $scope.cancelTimer($scope.autoRefreshTimer) ;       
  }

  $scope.initialize = function() {
    $http.get('/api/user')
      .success(function(user) { 
        
        $scope.userName = user.name ;

        if (user.configuration.project_id !== undefined) {
          $scope.selectedProjectId = user.configuration.project_id;
        }
        else {
          $scope.selectedProjectId = null ;
        }

        if (user.configuration !== undefined) {
          
          if (user.configuration.tags !== undefined) {
            try {
              $scope.selectedTags = JSON.parse(user.configuration.tags);
            }
            catch (err) {
              $scope.selectedTags = new Map([])
            }
            $scope.sortSelectedTags($scope.getSelectedTags()) ;
          }
        }

        $scope.getItems() ;
      })
      .error(function(user, status) {
        window.location = '/login' ;
      }) ;
  }

  $scope.getItems = function(fromServer, onSuccess) {

    if (fromServer === undefined)
      fromServer = true ;

    if (fromServer) {
      $http.get('/api/notes')
        .success(function(data) { 

          var filteredProjects = [] ;

          data.projects.filter(function(project) { return $scope.getUserRole(project) === "owner" }).forEach(function(project) { filteredProjects.push(project) })
          data.projects.filter(function(project) { return $scope.getUserRole(project) === "read-write" }).forEach(function(project) { filteredProjects.push(project) })
          data.projects.filter(function(project) { return $scope.getUserRole(project) === "read-only" }).forEach(function(project) { filteredProjects.push(project) })

          $scope.fromServer = {
            userid: data.userid,
            notes: data.notes, 
            projects: filteredProjects
          } ;

          var findSelectedProject = $scope.fromServer.projects.filter(function(project) { return project._id === $scope.selectedProjectId });
          if (findSelectedProject.length > 0)
            $scope.selectedProject = findSelectedProject[0]
          else 
            $scope.selectProject($scope.fromServer.projects[0])
          
          $scope.organizeNotes(data.notes, fromServer) ;

          if (onSuccess !== undefined)
            onSuccess();
        })
        .error(function(data, status) {
          window.location = '/login' ;
        }) ;
      }
      else {
        $scope.organizeNotes($scope.data.notes, fromServer);
      }
  };

  $scope.getOwnerName = function(project) {
    if (project == null) {
      return "All projects" ;
    }
    else {
      if (project.users !== undefined) {
        if ($scope.isOwner(project))
          return "" ;
        else
          return $scope.getOwnerNames(project)[0].name ;
      }
      else
        return null ;
    }  
  }

  $scope.createNewNote = function() {
    $scope.cancelTimer($scope.autoRefreshTimer) ;  
    $scope.cancelDeleyedRefresh();

    var tags = $scope.selectedTags[$scope.selectedProjectId].slice() ;

    $scope.InternalTags.toArray().forEach(function(internalTag) {
      removeElementFromArray(tags, internalTag) ;
    }) ;

    var note = {
        text: '', 
        checked: false,
        pinned: ($scope.selectedTags[$scope.selectedProjectId].indexOf($scope.InternalTags.Flagged) !== -1),
        tags: tags,
        timestamp: Date.now(),
        editing: true,
        user: {
          name: $scope.userName
        },
        removedTags: []
      } ;

      note.timeVerbose = "" ;

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

  $scope.transferNote = function(note, project) {
    $http
      .put('/api/note/' + note._id + '/transfer/' + project._id)
      .then(function() {
          $scope.getItems() ;
        }, 
        function(){
          var locale = getCookie('locale') ;
      
          var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'views/dialog-transfer-note.' + locale + '.html',
            controller: 'note-transfer-controller',
            size: 'lg',
            resolve: {
              transferState : function() {
                return { authorName: note.user.name, projectName: project.name }
              }
            }
          });

          modalInstance.result.then(function () {
          });
        }
      )
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

    var noteTags = note.tags.slice() ;
    if (note.pinned) 
      noteTags.push($scope.InternalTags.Flagged);
    //if (note.checked)
    //  noteTags.push($scope.InternalTags.Checked);
    //if (!note.checked)
    // noteTags.push($scope.InternalTags.Unchecked);

    $scope.selectTag(noteTags) ;

    if (note._id === undefined) {
      $http
        .post('/api/note/create', {project_id: $scope.selectedProjectId, text: note.text, tags: note.tags, pinned: note.pinned})
        .success(function(){
          $scope.getItems() ;
        });
    }
    else {      
      $http
        .put('/api/note/' + note._id + '/update', {text: note.text, tags: note.tags})
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

  $scope.projectName = "" ;

  $scope.createProject = function() {
    var locale = getCookie('locale') ;

    var createProjectModal = $uibModal.open({
      animation: true,
      templateUrl: 'views/dialog-create-project.' + locale + '.html',
      controller: 'create-project-controller',
      size: 'lg',
      resolve: {
        projectName: function() {
          return $scope.projectName ;
        }
      }
    });

    createProjectModal.result.then(function (name) {
       $http
       .post('/api/project', {projectName: name})
       .success(function() { 
         $scope.getItems(true, function(){
          var project = $scope.fromServer.projects.filter(function(project) { return project.name == name })[0] ;
          $scope.selectProject(project) ;
         }); 
       });
    });
  }

  $scope.deleteItem = function(note) {
    var locale = getCookie('locale') ;
    var modalInstance = $uibModal.open({
      animation: true,
      templateUrl: 'views/dialog-delete-note.' + locale + '.html',
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
      .delete('/api/note/' + note._id)
      .success(function() { 
        $scope.getItems(); 
      });
    });
  }

  $scope.deleteAllItems = function() {
    var locale = getCookie('locale') ;
    var modalInstance = $uibModal.open({
      animation: true,
      templateUrl: 'views/dialog-delete-all-notes.' + locale + '.html',
      controller: 'delete-all-notes-controller',
      size: 'lg'
    });

    modalInstance.result.then(function () {
      $http
        .delete('/api/notes')
        .success(function() { 
          $scope.getItems(); 
        });
      });
  }

  $scope.toggleItem = function(note){
    note.checked = (note.checked !== undefined) ? !note.checked : true ;
    
    $scope.deleyedRefresh() ;

    $http
      .put('/api/note/' + note._id + '/check/' + note.checked)
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
        .put('/api/note/' + note._id + '/pin/' + note.pinned)
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


angular.module('Index').controller('note-transfer-controller', function ($scope, $uibModalInstance, transferState)
{
  $scope.authorName = transferState.authorName 
  $scope.projectName = transferState.projectName
  
  $scope.ok = function () {
    $uibModalInstance.close();
  };
})

angular.module('Index').controller('create-project-controller', function ($scope, $uibModalInstance, projectName)
{
  $scope.projectName = projectName ;

  $scope.ok = function () {
    $uibModalInstance.close($scope.projectName);
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
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
