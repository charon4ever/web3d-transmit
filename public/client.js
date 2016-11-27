/**
 * Created by Administrator on 2015/7/3.
 * 待处理的问题：事件绑定函数的重复调用
 *             类的功能耦合
 *             循环与递归
 *             去掉不必要的参数
 *             异步：回调，事件与轮询
 *
 *             回调函数如何传参数
 *             函数绑定与解绑
 *
 *             多线程+回调+闭包
 *             注意所有事件都放在顶部注册，以免在函数重复执行时被重复注册
 */

var webglRTC=function() {
    var PeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
    var iceServer = {
        iceServers: [{
            "url": "stun:stun.l.google.com:19302"
        }]
    };
    var nativeRTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
    var nativeRTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription);
    var packetSize=2000;

    function EventHandler() {
        this.events = {};
    }

    EventHandler.prototype.on = function (eventName,callback,pointer) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push({callback:callback,pointer:pointer});
    };

    EventHandler.prototype.off=function(eventName){
        this.events[eventName].pop();
    };

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

    function RtcClient() {
        var self = this;
//存储用户自己的socketId
        this.socketId = null;
//存储与用户所处同一区域（聊天室）的其他用户的socketId
        this.othersSocketId = [];
//存储用户与其他用户建立的peerConnection连接,稀疏数组
        this.peerConnections = [];
//存储用户在peerConnection之上建立的dataChannel，稀疏数组
        this.dataChannels = [];
//每一个用户都有一个与服务器连接的webSocket
        this.socket = null;
//每一个用户都有一个文件管理器
        this.fileAddressor=new FileHandler();
//保存当前正在传输的文件，文件保存完毕后清空,考虑多通道多文件多碎片传输的情况
        this.fileChannel={};
//保存每一个文件碎片的个数
        this.packageQuantity={};
//这个二维数组维护了一个表：什么资源在什么节点手上
        this.tempCandidates=[];

        /*涉及webrtc信道建立的事件*******/
        /*this.on("message",function(){

        });*/
        this.on("_ice_candidate", function (data) {
            var socketId = data.socketId;
            var pc = self.peerConnections[socketId];
            if(undefined==pc){
                console.log("pc hasn't been built 1");
            }else{
                console.log("pc has been built 1");
            }
            var candidate = new nativeRTCIceCandidate(data);
            pc.addIceCandidate(candidate);
        });
        this.on("_peers", function (data) {
            console.log("_peers");
            self.othersSocketId = data.connections;
            self.socketId = data.you;
            self.createPeerConnections();
            self.addDataChannels();   //强烈注意：这里先send offer再add datachannel就不行了，不知道为什么
            self.sendOffers();
        });
        this.on("_new_peer", function (data) {
            console.log("_new_peer");
            var socketId = data.socketId;
            self.othersSocketId.push(socketId);
            self.createPeerConnection(socketId);
            self.emit("new peer");
        });
        this.on("_offer",function(data){
            self.receiveOffer(data);
            console.log("_offer");
        });
        this.on("_answer",function(data){
            self.receiveAnswer(data);
            console.log("_answer");
        });
    }

    RtcClient.prototype = new EventHandler();

    RtcClient.prototype.join=function(){
        var self = this;
        var sendMessage = {
            eventName: "__join",
            data: ""
        };
        self.socket.send(JSON.stringify(sendMessage));
    };

    RtcClient.prototype.initSocket = function (server) {
        var self = this;
        this.socket = new WebSocket(server);
        this.socket.onopen = function () {
           console.log("socket open success");
            var sendMessage = {
                eventName: "__askMateNum",
                data: ""
            };
            self.socket.send(JSON.stringify(sendMessage));

        };
        this.socket.onmessage = function (e) {
            var json = JSON.parse(e.data);
            if (json.eventName) {
                self.emit(json.eventName, json.data);
            } else {
                self.emit("message",self.socket,json);
            }
        };
        this.socket.onerror = function () {
            console.log("socket error");
        };
        this.socket.onclose = function () {
            self.socketId = '';
            self.othersSocketId = [];
            self.peerConnections = [];
            self.dataChannels=[];
        };
    };

    /****     对于新加入节点向所有老节点创建peerConnection     ****/
    RtcClient.prototype.createPeerConnections = function () {
       var self=this;
        for (var i = 0; i < self.othersSocketId.length; i++) {
            self.createPeerConnection(self.othersSocketId[i]);
            console.log("ok1");
        }
    };

    //老节点指定创建与新节点的peerConnection
    RtcClient.prototype.createPeerConnection = function (socketId) {
       var self = this;
        var pc = new PeerConnection(iceServer);
        self.peerConnections[socketId] = pc;
        console.log("pc ok");
        pc.onicecandidate = function (e) {
            if(e.candidate) {
                var sendMessage = {
                    eventName: "__ice_candidate",
                    data: {
                        "label": e.candidate.sdpMLineIndex,
                        "candidate": e.candidate.candidate,
                        "socketId": socketId
                    }
                };
                self.socket.send(JSON.stringify(sendMessage));
               console.log("send icecandidate");
            }
        };
        pc.onopen = function () {
           console.log("build peerConnection with",socketId,"success");
        };
        pc.ondatachannel = function (e) {
            self.addDataChannelEvents(e.channel,socketId);
           console.log("i receive datachannel from",socketId);
        };
    };

    /*******  交换session信息   *****/
    RtcClient.prototype.sendOffers = function () {
        var self=this;
        var createOfferSuccess=function(pc,socketId){
            return function(session_desc){
                /*var Bandwidth = 50000;*/
                console.log(session_desc);
                //session_desc.sdp=session_desc.sdp.replace(/b=AS:([0-9]+)/g, 'b=AS:'+Bandwidth+'\r\n');
                //session_desc.sdp=session_desc.sdp.replace("webrtc-datachannel 1024","webrtc-datachannel 2048");
                pc.setLocalDescription(session_desc);
                var sendMessage={
                    eventName:"__offer",
                    data:{
                        socketId:socketId,
                        sdp:session_desc
                    }
                };
                self.socket.send(JSON.stringify(sendMessage));
                console.log("send offers");
            }
        };
        var createOfferError=function(e){
            console.log(e);
        };
       for(var connection in self.peerConnections){
           self.peerConnections[connection].createOffer(createOfferSuccess(self.peerConnections[connection],connection),createOfferError);
       }
    };

    RtcClient.prototype.receiveOffer=function(data){
       var self=this;
        var pc=self.peerConnections[data.socketId];
        if(undefined==pc){
            console.log("pc hasn't been built 2");
        }else{
            console.log("pc has been built 2");
        }
        pc.setRemoteDescription(new nativeRTCSessionDescription(data.sdp));
        self.sendAnswer(data.socketId);
    };

    RtcClient.prototype.sendAnswer=function(socketId){
       var self=this;
        var pc=self.peerConnections[socketId];
        var createOfferSuccess=function(pc){
            return function(session_desc){
                var Bandwidth = 2000;
                console.log(session_desc);
                //session_desc.sdp=session_desc.sdp.replace("webrtc-datachannel 1024","webrtc-datachannel 2048");
                //session_desc.sdp=session_desc.sdp.replace(/b=AS:([0-9]+)/g, 'b=AS:'+Bandwidth);
                pc.setLocalDescription(session_desc);
                var sendMessage={
                    eventName:"__answer",
                    data:{
                        sdp:session_desc,
                        socketId:socketId
                    }
                };
                self.socket.send(JSON.stringify(sendMessage));
                console.log("send answer");
            }
        };
        var createOfferError=function(e){
            console.log(e);
        };
        pc.createAnswer(createOfferSuccess(pc),createOfferError);
    };

    RtcClient.prototype.receiveAnswer=function(data){
        var self=this;
        var pc=self.peerConnections[data.socketId];
        if(undefined==pc){
            console.log("pc hasn't been built 3");
        }else{
            console.log("pc has been built 3");
        }
        pc.setRemoteDescription(new nativeRTCSessionDescription(data.sdp));
    };

    /*******   创建dataChannel  ******/
    RtcClient.prototype.addDataChannels = function () {
       var self=this;
        var connection;
        for (connection in self.peerConnections) {
            this.createDataChannel(connection);
        }
    };

    RtcClient.prototype.createDataChannel = function (socketId, label) {
        var self=this;
        var dataChannelOptions = {
            ordered: false, // do not guarantee order
            maxRetransmitTime: 3000 // in milliseconds
        };
        var pc = self.peerConnections[socketId];
        var channel = pc.createDataChannel(label);
        self.addDataChannelEvents(channel, socketId);
        console.log("create data Channel");
    };

    RtcClient.prototype.addDataChannelEvents = function (channel, socketId) {
        var self=this;
        channel.onopen = function () {
            console.log("dataChannel open success");
            self.emit("channel_ready");
        };
        channel.onmessage = function (e) {
            console.log("wcy");
            var json=JSON.parse(e.data);
            if("message"==json.type){
              self.emit("receive_message", json.data,socketId);
                console.log("receive message!");
            }else if("file"==json.type){
                self.receiveFileEntity(json,socketId);
            }else if("signal"==json.type){
                switch(json.data){
                    case "ask for scene data":
                        console.log("receive signal:ask for scene data");
                        self.fileAddressor.checkFile("sceneData/sceneData.json",function(){
                            var sendMessage={
                                type:"signal",
                                data:"sceneFile exist"
                            };
                            self.dataChannels[socketId].send(JSON.stringify(sendMessage));
                        },function(){
                            console.log("i don't have scene file");
                        });
                        break;
                    case "send scene data now":
                        var splitCount=json.count;
                        var splitSequence=json.sequence;
                        self.fileAddressor.readFile("sceneData/sceneData.json",function(result){
                            self.sendFile(socketId,"sceneData/sceneData.json",splitCount,splitSequence,result);
                        });
                        break;
                    case "ask for model data":
                        console.log("receive signal:ask for model data");
                        var splitCount=json.count;
                        var splitSequence=json.sequence;
                        self.fileAddressor.readFile("modelData/"+json.meshID+".json",function(result){
                            self.sendFile(socketId,"modelData/"+json.meshID+".json",splitCount,splitSequence,result);
                        });
                        break;
                    case "file not found":
                        console.log("the peer don't have the file");
                        break;
                    case "sceneFile exist":
                        self.tempCandidates["scene.json"][socketId]=true;
                        break;
                    default:
                        console.log("receive signal:error");
                        break;
                }
            }else if("file_chunks"==json.type){
                var fileUrl=json.url;
                var fileName=fileUrl.split('/')[1];
                  if(self.packageQuantity[fileName]){
                      self.packageQuantity[fileName]++;
                  }else{
                      self.packageQuantity[fileName]=1;
                  }
                console.log(fileName);
                  self.receiveFileChunks(json,socketId,self.packageQuantity[fileName]);
            }
        };
        channel.onerror = function () {
            console.log("dataChannel error");
        };
        channel.onclose = function (e) {
            console.log(e);
            console.log("dataChannel close");
            delete self.dataChannels[socketId];
        };
        self.dataChannels[socketId] = channel;
        console.log("i build datachannel with",socketId);
    };

    RtcClient.prototype.broadCast=function(message){
        var self=this;
        for(var i=0;i<self.othersSocketId.length;i++){
            var socketId=self.othersSocketId[i];
            self.sendMessages(message,socketId);
        }
    };

    RtcClient.prototype.sendMessages=function(message,socketId){
        var self=this;
        var sendMessage={
            type:"message",
            data:message
        };
        if("open"===self.dataChannels[socketId].readyState.toLowerCase()){
            self.dataChannels[socketId].send(JSON.stringify(sendMessage));
            //console.log(self.dataChannels[socketId].readyState);
            console.log("send message success");
        }
        else{
            console.log("the channel hasn't been open,please try again later");
        }
    };

    /*****************     传输文件    *****************/
    /*RtcClient.prototype.shareFile=function(fileUrl){
        var self=this;
        self.fileAddressor.readFile(fileUrl);
        self.fileAddressor.on("readSceneFileDone",function(){
            if(self.fileAddressor.tempFile.length<packetSize){
                    for(var i in self.dataChannels){
                        self.sendFileEntity(i);
                    }
            }else{
                    for(var i in self.dataChannels){
                        self.sendFileChunks(i);
                    }
            }
            self.fileAddressor.off("readSceneFileDone");
        });
    };*/

    RtcClient.prototype.sendFile=function(socketId,fileUrl,splitCount,splitSequence,sendString){
        var self=this;
        if(sendString.length<packetSize){
            console.log(sendString.length);
            self.sendFileEntity(socketId,fileUrl,sendString);
        }else{
            self.sendFileChunks(socketId,fileUrl,splitCount,splitSequence,sendString);
        }
    };

    RtcClient.prototype.sendFileEntity=function(socketId,fileUrl,sendString){
        var self=this;
        var sendMessage={
            type:"file",
            data:sendString,
            url:fileUrl
        };
        if("open"===self.dataChannels[socketId].readyState.toLowerCase()) {
            self.dataChannels[socketId].send(JSON.stringify(sendMessage));
            console.log("send file ok");
        }else{
            console.log("the channel hasn't been open,please try again later");
        }
    };

    RtcClient.prototype.sendFileChunks=function(socketId,fileUrl,splitCount,splitSequence,sendString){
        console.log(splitCount,splitSequence);
        var self=this;
        var packageToSend=Math.ceil(sendString.length/packetSize);
        var startPoint=(Math.floor(packageToSend/splitCount))*(splitSequence-1);
        var endPoint=(splitCount===splitSequence?packageToSend-1:(Math.floor(packageToSend/splitCount))*(splitSequence)-1);
        var sequenceId=startPoint;
        console.log(startPoint,endPoint,packageToSend,packetSize);
        //console.log(sendString);
        sendString=sendString.slice(startPoint*packetSize);
       // console.log(sendString);
        while(sequenceId<endPoint){
            var sendMessage={
                type:"file_chunks",
                sequenceId:sequenceId,
                data:sendString.slice(0,packetSize),
                packageToSend:packageToSend,
                url:fileUrl
            };
            sequenceId++;
            if("open"===self.dataChannels[socketId].readyState.toLowerCase()) {
                self.dataChannels[socketId].send(JSON.stringify(sendMessage));
                console.log("send file chunk ok");
            }else{
                console.log("the channel hasn't been open,please try again later");
            }
            sendString=sendString.slice(packetSize);
            delay(2000000);
        }
        if(splitCount===splitSequence){
            sendMessage={
                type:"file_chunks",
                sequenceId:sequenceId,
                data:sendString.slice(0,packetSize),
                packageToSend:packageToSend,
                url:fileUrl
            };
        }else{
            sendMessage={
                type:"file_chunks",
                sequenceId:sequenceId,
                data:sendString.slice(0,packetSize),
                packageToSend:packageToSend,
                url:fileUrl
            };
        }
        if("open"===self.dataChannels[socketId].readyState.toLowerCase()) {
            self.dataChannels[socketId].send(JSON.stringify(sendMessage));
            console.log("send file last chunk ok");
        }else{
            console.log("the channel hasn't been open,please try again later");
        }
    };

    function delay(x){
        var sum=1;
        for(var i=0;i<x;i++){
            sum=sum*i;
        }
    }

    RtcClient.prototype.receiveFileEntity=function(json,socketId){
        var tempString=json.data;
        var fileName=json.url.split('/')[1];
        console.log("receive a file");
        if(self.tempCandidates[fileName].isExist==false){
            self.fileAddressor.writeFile(tempString,json.url,function(fileUrl){
                self.emit("writeFileAndLoad",fileUrl);
            });
        }
        self.tempCandidates[fileName][socketId]=true;
        self.tempCandidates[fileName].isExist=true;
    };

    RtcClient.prototype.receiveFileChunks=function(json,socketId,packageQuantity){
        var self=this;
        var sequenceId=json.sequenceId;
        var fileUrl=json.url;
        var fileName=fileUrl.split('/')[1];
        if(!self.fileChannel[fileName]){
            self.fileChannel[fileName]=[];
        }
        self.fileChannel[fileName][sequenceId]=json.data;
        console.log("receive a chunk");
        if(packageQuantity==json.packageToSend){
            console.log("file chunks all together");
            (function(socketId,fileName,fileUrl){
                var tempString="";
                for(var i=0;i<self.fileChannel[fileName].length;i++){
                    tempString+=self.fileChannel[fileName][i];
                }
                self.fileAddressor.writeFile(tempString,fileUrl,function(fileUrl){
                    self.emit("writeFileAndLoad",fileUrl,tempString);
                });
            })(socketId,fileName,fileUrl);
        }else{
            console.log(packageQuantity,json.packageToSend);
        }
    };

    return new RtcClient();
};