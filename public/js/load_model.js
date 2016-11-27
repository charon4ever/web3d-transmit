/**
 * Created by Administrator on 2015/3/23.
 */

function load_model(q){
    q.positionvec = [];
    var pos = q.position;
    var m = new THREE.Matrix4(pos.xPosition, 0, 0, 0, pos.yPosition, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0);
    var n=0;
    $.each(q.transform, function (index, t)
     {

        var m1 = new THREE.Matrix4(t[0], t[4], t[8], t[12], t[1], t[5], t[9], t[13], t[2], t[6],t[10], t[14], t[3], t[7], t[11], t[15]);
        m1.multiply(m);
        var a = m1.elements[0];
        var b = m1.elements[1];
        var pv = {xp: a, yp: b};
        q.positionvec[n++] = pv;
    });

    THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader() );
    var loader = new THREE.JSONLoader();
    loader.load("../obj/models/" + q.docID + "/" + q.meshID + ".js", function (geometry, materials) {
        var jsonModel = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
        jsonModel.position.set(q.position.xPosition, FLOOR, q.position.yPosition);

        scene.add(jsonModel);
        // $.each(q.positionvec, function (index, r)
        for (var r=0;r< q.positionvec.length;r++)
        {
            jsonModel.position.set(q.positionvec[r].xp, FLOOR, q.positionvec[r].yp);
            scene.add(jsonModel);
        }
    });
}