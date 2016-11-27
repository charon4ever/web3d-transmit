/**
 * Created by Administrator on 2016/1/5.
 * This is the server of the dve system,which provide the function of downloading,signaling and tracking
 */
//var tracker=require('bittorrent-tracker/server');
var fs=require('fs');
var express=require('express');
var path=require('path');

//var localAddress=require('network-address');//获取本机的内部IP地址
//var publicAddress=require('lib/public-address');//获取本机的外部IP地址

/*静态网页服务器*/
var app=express();
app.listen(80);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/node', function(req, res) {
    res.sendfile(__dirname + '/node.html');
});
app.get('/peer', function(req, res) {
    res.sendfile(__dirname + '/peer.html');
});
app.get('/send', function(req, res) {
    res.sendfile(__dirname + '/sendPeer2.html');
});
app.get('/testS', function(req, res) {
    res.sendfile(__dirname + '/testServer.html');
});
app.get('/testP', function(req, res) {
    res.sendfile(__dirname + '/testP2P.html');
});
app.get("/data/sceneData/sceneData.json",function(req,res){
    var url=req.url;
    fs.readFile(url,function(err,data){
        res.send(data);
    });
});
app.get("/data/modelData/"+/\d{4,5}/+".json",function(req,res){
    var url=req.url;
    fs.readFile(url,function(err,data){
        res.send(data);
    });
});

/*tracker服务器*/
/*var trackerServer=new tracker({
    udp:true,
    http:true,
    ws:true
});
var hostname=localAddress();
var port=3008;

trackerServer.listen(port);*/