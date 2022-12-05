uniform mat4 mModelView;
uniform mat4 mNormals;
uniform mat4 mProjection;

attribute vec4 vPosition;
attribute vec3 vNormal;

varying vec3 fNormal;
varying vec3 fPos;

void main() {
    gl_Position = mProjection * mModelView * vPosition;
    fPos = (mModelView * vPosition).xyz;
    fNormal = mat3(mNormals) * vNormal;
}