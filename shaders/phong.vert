uniform mat4 mModelView;
uniform mat4 mNormals;
uniform mat4 mProjection;

attribute vec4 vPosition;
attribute vec3 vNormal;

varying vec3 fNormal;
varying vec3 fPos;

void main() {
    gl_Position = mProjection * mModelView * vPosition;
    // ignora-se w pq se sabe que e ponto, fpos e calculada
    // depois de phong.vert e antes de phong.frag(pos de cada fragmento)
    fPos = (mModelView * vPosition).xyz;
    //fnormal é a normal dum fragmento corrigida, mNormals
    // vai ser a matriz que vai corrigir as normais, vNormal
    // e a normal potencialmente distorcida
    fNormal = mat3(mNormals) * vNormal;
}
