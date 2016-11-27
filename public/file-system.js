/**
 * Created by Administrator on 2015/7/1.
 */
//1.filesystem,file,filestream如何架构 2.webpeer中如何使用filesystem 3.减少重复渲染，减少渲染时间 4.动画优化
/*********************************************************************************
 * * 事件处理器
 * *****************************************************************************/

function EventHandler() {
    this.events = {};
}

function isArray(ob){
    return ob && typeof ob==="object" && ob instanceof Array;
}

EventHandler.prototype.addListener=function(eventName,callback){
    if(typeof callback != "function"){
        console.log("callback must be a function");
        throw new Error("callback must be a function");
    }
    this.events[eventName] = this.events[eventName] || [];
    this.events[eventName].push({callback:callback});
};

EventHandler.prototype.on = function (eventName,callback,pointer) {
    if(typeof callback != "function"){
        console.log("callback must be a function");
        throw new Error("callback must be a function");
    }
    this.events[eventName] = this.events[eventName] || [];
    this.events[eventName].push({callback:callback,pointer:pointer});
};

EventHandler.prototype.once=function(eventName,callback){
    var self=this;
    if(typeof callback != "function"){
        console.log("callback must be a function");
        throw new Error("callback must be a function");
    }
    function exCallBack(){
        self.removeListener(eventName,exCallBack);
        callback.apply(null,arguments);
    }
    this.on(eventName,exCallBack);
};

EventHandler.prototype.removeListener=function(eventName,callback){
    if(typeof callback!=="function"){
        console.log("callback must be a function");
        throw new Error("callback must be a function");
    }
    if(!this.events[eventName]){
        console.log("the event %s is not been listened",eventName);
    }else if(isArray(this.events[eventName])){
        this.events[eventName].filter(function(element){
            return element!==callback;
        })
    }
};

EventHandler.prototype.removeAllListeners=function(eventName){
    if(!this.events[eventName]){
        console.log("the listeners of %s has already been removed",eventName);
    }else{
        delete this.events[eventName];
    }
};

EventHandler.prototype.off=EventHandler.prototype.removeEventListener;

EventHandler.prototype.emit = function (eventName, _) {
    var events = this.events[eventName];
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < events.length; i++) {
        if(undefined==events[i].pointer){
            events[i].callback.apply(this, args);
        }else{
            events[i].callback.apply(events[i].pointer, args);
        }
    }
};

/**********************************************************/
/*                                                        */
/*                     文件读写管理类                      */
/*                                                        */
/**********************************************************/

function FileHandler() {
    this.fileSystem = null;
    EventHandler.call(this);
}

//继承事件处理器
FileHandler.prototype=new EventHandler();
FileHandler.prototype.constructor=FileHandler;

//初始化文件系统
    FileHandler.prototype.initFileSystem = function (fileSpace,callback) {
        var self = this;
        navigator.webkitPersistentStorage.requestQuota(fileSpace * 1024 * 1024,
            function (grantedBytes) {
                window.webkitRequestFileSystem(PERSISTENT,
                    grantedBytes,
                    function (fs) {
                        self.fileSystem = fs;
                        console.log("the filesystem has been initial");
                        if(callback){
                            callback();
                        }
                    }, self.errorHandler)
            }, self.errorHandler)
    };

//�从服务器下载文件(模型文件或者场景描述文件)�
    FileHandler.prototype.downloadFile = function (fileDownLoadUrl,fileStoreUrl,callback) {
        var self = this;
        self.writeFlag = true;
        var tempArray=fileStoreUrl.split('/');
        var dirUrl=tempArray[0];
        var fileName=tempArray[1];
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (200 == xhr.status && 4 == xhr.readyState) {
                self.fileSystem.root.getDirectory(dirUrl,
                    {
                        create: true,
                        exclusive: false
                    },
                    function (dirEntry) {
                        dirEntry.getFile(fileName,
                            {
                                create: true,
                                exclusive: true
                            },
                            function (fileEntry) {
                                fileEntry.createWriter(
                                    function (writer) {
                                        var fileBlob = new Blob([xhr.responseText], [{type: "text/plain;charset=UTF-16"}]);
                                        writer.write(fileBlob);
                                        writer.onwriteend = function () {
                                            console.log("download completed");
                                            if(callback){
                                                callback(fileStoreUrl);
                                            }
                                            self.writeFlag = false;
                                        };
                                        writer.onerror = function () {
                                            console.log("downloadFileError");
                                            self.writeFlag = false;
                                        };
                                    }, self.errorHandler
                                );
                            }, function (e) {
                                self.errorHandler(e);
                                if (FileError.INVALID_MODIFICATION_ERR == e.code) {
                                    self.fileSystem.root.getFile(fileStoreUrl,
                                        {create: false},
                                        function (fileEntry) {
                                            fileEntry.remove(
                                                function () {
                                                    self.downloadFile(fileDownLoadUrl,fileStoreUrl,callback);
                                                }, self.errorHandler
                                            );
                                        }, self.errorHandler
                                    );
                                }
                            }
                        );
                    }, self.errorHandler
                )
            }
        };
        xhr.open('GET', fileDownLoadUrl);
        xhr.send();
    };

//读取文件到内存，以字符串形式(模型文件或者场景描述文件)
    FileHandler.prototype.readFile = function (fileUrl,callback) {
        var self = this;
        self.fileSystem.root.getFile(fileUrl,
            {create:false},
            function (fileEntry) {
                fileEntry.file(function (file) {
                    var reader = new FileReader();
                    reader.readAsText(file);
                    reader.onload = function () {
                        console.log("read file ok");
                        if(callback){
                            callback(reader.result);
                        }
                        return reader.result;
                    }
                });
            },function(e){
                self.errorHandler(e);
                if( FileError.NOT_FOUND_ERR== e.code){
                    console.log("can't find file");
                }
            }
        );
    };

//把内存里的字符串写成场景描述文件
   FileHandler.prototype.writeFile=function(tempString,fileUrl,callback){
      var self=this;
       var tempArray=fileUrl.split('/');
       var dirUrl=tempArray[0];
       var fileName=tempArray[1];
      self.fileSystem.root.getDirectory(dirUrl,
          {create:true,
          exclusive:false},
          function(dirEntry){
              dirEntry.getFile(fileName,
                  {create:true,
                  exclusive:true},
                  function(fileEntry){
                      fileEntry.createWriter(function(fileWriter){
                          var fileBlob=new Blob([tempString],[{type: "text/plain;charset=UTF-16"}]);
                          fileWriter.write(fileBlob);
                          fileWriter.onwriteend=function(){
                              console.log("write file completed");
                              self.writeFlag = false;
                              if(callback){
                                  callback(fileUrl);
                              }
                          };
                          fileWriter.onerror=function(){
                              console.log("write file failed");
                              self.writeFlag = false;
                          };
                      },self.errorHandler);
                  },function(e){
                      self.errorHandler(e);
                      if(FileError.INVALID_MODIFICATION_ERR==e.code){
                          dirEntry.getFile(fileName,
                              {create:false,
                              exclusive:false},
                              function(fileEntry){
                                  fileEntry.remove(function(){
                                      self.writeFile(tempString,fileUrl,callback);
                                  },self.errorHandler);
                              },function(e) {
                                  self.errorHandler(e);
                              }
                          )
                      }
                  }
              );
          },self.errorHandler
      );
   };

//复制本地文件到date文件夹下�
   FileHandler.prototype.copyFile=function(fileChoose){
       var self=this;
       self.writeFlag = true;
       self.fileSystem.root.getDirectory("data",
           {create:true,
           exclusive:false},
           function(dirEntry){
               dirEntry.getFile(fileChoose.name,
                   {create:true,
                   exclusive:true},
                   function(fileEntry){
                       fileEntry.createWriter(function(fileWriter){
                           fileWriter.write(fileChoose);
                           fileWriter.onwriteend=function(){
                               console.log("copy completed");
                               self.writeFlag = false;
                           };
                           fileWriter.onerror=function(){
                               console.log("copy file failed");
                               self.writeFlag = false;
                           };
                       },self.errorHandler);
                   },function(e){
                       self.errorHandler(e);
                       if (FileError.INVALID_MODIFICATION_ERR == e.code) {
                           self.fileSystem.root.getFile("data/"+fileChoose.name,
                               {create: false},
                               function (fileEntry) {
                                   fileEntry.remove(
                                       function () {
                                           self.copyFile(fileChoose);
                                       }, self.errorHandler
                                   );
                               }, self.errorHandler
                           );
                       }
                   }
               );
           },self.errorHandler
       );
   };

//复制本地场景描述文件�
FileHandler.prototype.copySceneFile=function(fileChoose){
    var self=this;
    self.writeFlag = true;
    self.fileSystem.root.getDirectory("sceneData",
        {create:true,
            exclusive:false},
        function(dirEntry){
            dirEntry.getFile(fileChoose.name,
                {create:true,
                    exclusive:true},
                function(fileEntry){
                    fileEntry.createWriter(function(fileWriter){
                        fileWriter.write(fileChoose);
                        fileWriter.onwriteend=function(){
                            console.log("copy scene data completed");
                            self.writeFlag = false;
                        };
                        fileWriter.onerror=function(){
                            console.log("copy file failed");
                            self.writeFlag = false;
                        };
                    },self.errorHandler);
                },function(e){
                    self.errorHandler(e);
                    if (FileError.INVALID_MODIFICATION_ERR == e.code) {
                        self.fileSystem.root.getFile("sceneData/"+fileChoose.name,
                            {create: false},
                            function (fileEntry) {
                                fileEntry.remove(
                                    function () {
                                        self.copySceneFile(fileChoose);
                                    }, self.errorHandler
                                );
                            }, self.errorHandler
                        );
                    }
                }
            );
        },self.errorHandler
    );
};

//复制本地模型文件�
FileHandler.prototype.copyModelFile=function(fileChoose){
    var self=this;
    self.writeFlag = true;
    self.fileSystem.root.getDirectory("modelData",
        {create:true,
            exclusive:false},
        function(dirEntry){
            dirEntry.getFile(fileChoose.name,
                {create:true,
                    exclusive:true},
                function(fileEntry){
                    fileEntry.createWriter(function(fileWriter){
                        fileWriter.write(fileChoose);
                        fileWriter.onwriteend=function(){
                            console.log("copy model data completed");
                            self.writeFlag = false;
                        };
                        fileWriter.onerror=function(){
                            console.log("copy file failed");
                            self.writeFlag = false;
                        };
                    },self.errorHandler);
                },function(e){
                    self.errorHandler(e);
                    if (FileError.INVALID_MODIFICATION_ERR == e.code) {
                        self.fileSystem.root.getFile("modelData/"+fileChoose.name,
                            {create: false},
                            function (fileEntry) {
                                fileEntry.remove(
                                    function () {
                                        self.copyModelFile(fileChoose);
                                    }, self.errorHandler
                                );
                            }, self.errorHandler
                        );
                    }
                }
            );
        },self.errorHandler
    );
};

/****************检查指定路径文件是否存在********************/
FileHandler.prototype.checkFile=function(fileUrl,exist,nExist){
    var self=this;
    self.fileSystem.root.getFile(fileUrl,
        {create:false,
        exclusive:false},
        function(){
            if(exist)
            exist();
        },function(e){
            self.errorHandler(e);
            if(FileError.NOT_FOUND_ERR== e.code){
                if(nExist)
                nExist();
            }
        }
    );
};

//错误处理器������
    FileHandler.prototype.errorHandler = function (e) {
        var msg = '';
        switch (e.code) {
            case FileError.QUOTA_EXCEEDED_ERR:
                msg = 'QUOTA_EXCEEDED_ERR';
                break;
            case FileError.NOT_FOUND_ERR:
                msg = 'NOT_FOUND_ERR';
                break;
            case FileError.SECURITY_ERR:
                msg = 'SECURITY_ERR';
                break;
            case FileError.INVALID_MODIFICATION_ERR:
                msg = 'INVALID_MODIFICATION_ERR';
                break;
            case FileError.INVALID_STATE_ERR:
                msg = 'INVALID_STATE_ERR';
                break;
            default:
                msg = 'Unknown Error';
                break;
        }
        console.log('Error: ' + msg);
    };
