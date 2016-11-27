/**
 * Created by Administrator on 2015/3/17.
 */


onmessage=function(e){
   loadModel(e.data);
};

function loadModel(q) {
   // var FLOOR=-250;
    q.positionvec = [];
    var pos = q.position;
    var trans= q.transform;
    var m = new THREE.Matrix4(pos.xPosition, 0, 0, 0, pos.yPosition, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0);
    var index=0;
    //$.each(q.transform, function (index, t)
        for (t in trans) {
        var m1 = new THREE.Matrix4(trans[t][0], trans[t][4], trans[t][8], trans[t][12], trans[t][1], trans[t][5], trans[t][9], trans[t][13], trans[t][2], trans[t][6],trans[t][10], trans[t][14], trans[t][3], trans[t][7], trans[t][11], trans[t][15]);
        m1.multiply(m);
        var a = m1.elements[0];
        var b = m1.elements[1];
        var pv = {xp: a, yp: b};
        q.positionvec[index++] = pv;
    }

    THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader() );
    var loader = new THREE.JSONLoader();
        loader.load("../obj/models/" + q.docID + "/" + q.meshID + ".js", function (geometry, materials) {
            var jsonModel = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
            jsonModel.position.set(q.position.xPosition, FLOOR, q.position.yPosition);
            postMessage(jsonModel);
           // $.each(q.positionvec, function (index, r)
            for (var r=0;r< q.positionvec.length;r++)
            {
                jsonModel.position.set(q.positionvec[r].xp, FLOOR, q.positionvec[r].yp);
                postMessage(jsonModel);
            }
        });
}




