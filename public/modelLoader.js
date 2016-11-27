/**
 * Created by Administrator on 2015/7/27.
 */

onmessage=function(event){
    switch(event.data.type){
        case "superNode":
            var q=event.data.node;
            loadAjaxJson("data/modelData/" + q.meshID + ".json",handleData(q));
            break;
        case "node":
            var modelData=event.data.modelData;
            var index=event.data.index;
            var result=parseSingleModel(modelData);
            postMessage({geometryData:result.geometryData,index:index});
            break;
        default:
            break;
    }
};

function handleData(q){
    return function(geometryData,content){
        postMessage({geometryData:geometryData,node:q,content:content})
    };
}

function parseSingleModel(content){
    var geometry={faceVertexUvs:[],vertices:[],faces:[]};
    parseModel(content);

    function parseModel( json ) {
        var i, offset, zLength,
            vertex, face,
            faces = json.faces,
            vertices = json.verts,
            nUvLayers = 0;
        if ( json.uvs !== undefined ) {
            for ( i = 0; i < json.uvs.length; i ++ ) {
                if ( json.uvs[ i ].length ) nUvLayers ++;
            }
            for ( i = 0; i < nUvLayers; i ++ ) {
                geometry.faceVertexUvs[ i ] = [];
            }
        }
        offset = 0;
        zLength = vertices.length;
        while ( offset < zLength ) {
            vertex ={};
            vertex.x = vertices[ offset ++ ] ;
            vertex.y = vertices[ offset ++ ] ;
            vertex.z = vertices[ offset ++ ] ;
            geometry.vertices.push( vertex );
        }
        offset = 0;
        zLength = faces.length;
        while ( offset < zLength ) {
            face = {};
            face.a = faces[ offset ++ ];
            face.b = faces[ offset ++ ];
            face.c = faces[ offset ++ ];
            geometry.faces.push( face );
        }
    }
    return{geometryData:geometry,content:content};
}

function loadAjaxJson(url,callback){
    var xhr=new XMLHttpRequest();
    xhr.onreadystatechange=function(){
        if(xhr.readyState==4){
            if(xhr.status==200 || xhr.status==0) {
                if(xhr.responseText) {
                    var result = parseSingleModel(JSON.parse(xhr.responseText));
                    callback(result.geometryData,result.content);
                }else{
                    console.error('wJsonLoader:"'+url+'"seems to  be unreachable or the file is empty');
                }
            }else{
                console.error('wJsonLoader:couldn\'t load:"'+url+'"('+xhr.status+')');
            }
        }
    };
    xhr.open('GET',url,true);
    xhr.send(null);
}